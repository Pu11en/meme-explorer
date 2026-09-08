# DeepSeek Harness node/data + browser client-plugin architecture audit

_Date: 2026-08-26_

## Scope and source boundary

This audit used only the installed DeepSeek Harness checkout at:

`/home/drewp/.local/share/deepseek-harness/node_modules/.pnpm/@deepseek-ai+dsh-web-app@0.1.1-rc.2_ce3874dffedb66ab726b823cc1dadab8/`

For readable citations below, **`$CHECKOUT` means exactly that absolute directory**. No DSH file was modified. This is a published/install-shaped checkout: it contains built `lib/` artifacts, declarations, package manifests, and READMEs, but not the repository-root workspace scripts or package tests. Claims about unsupported commands are intentionally not filled in from memory.

## Executive recommendation

Build one **dual-face package** whose Loader row is mounted once for the life of the DSH host process:

- Node face: a process-singleton `PumpObserverService` owning the only PumpAPI WebSocket, the explicit start/stop state machine, optional stop timer, raw append store, ten-minute token windows, snapshot RPC, and a summary-only SSE stream.
- Browser face: a DSH client plugin that calls `ctx.connection.rpc.call('/pump-observer', ...)` for `status`, `start`, `stop`, and `snapshot`, subscribes to a same-origin `EventSource('/pump-observer/events')`, and registers a **`settings.section`** called “Pump Observer” as the narrowest supported dashboard seat.
- Persistence: use DSH `storageDomain`/JSON only for small control and summary records. Do **not** write every raw Pump event through the JSON domain backend: it rewrites the complete unit file on every write. Keep raw events in an app-owned append-only medium under a configured directory beneath the deployment’s `$DSH_HOME/storages` convention, with explicit append/flush semantics.
- Restart policy: always activate in `stopped` state and require a new Start click. Persist raw data and last summaries, not a claim that an external socket survived process death. If future product policy wants auto-resume, add it as an explicit durable setting and test it separately.

This slice does not require modifying DSH’s fixed API Remote assembly or adding a new shell router.

---

## 1. Exact package and file structure

### Canonical dual-face manifest

DSH discovers browser plugins from enabled Loader rows whose packages declare `dsh.client`; the package must export `./client`. The module host resolves that export, hashes and serves the built client artifact, and emits it into `window.__DSH_BOOT__` (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-modules/README.md:5-15`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:67-89,119-160,258-300,377-435`).

A canonical client package manifest has:

- ESM package: `"type": "module"`.
- Node entry: `main`/root export -> `lib/index.js`.
- Browser entry: `exports["./client"]` -> `lib/client.js` plus declarations.
- `dsh.client.platform: "web"`.
- `dsh.client.inject`: package IDs whose browser entries must activate first.
- Optional `dsh.client.immediately` and `dsh.client.external`.
- Published `lib/index.js`, `lib/client.js`, and `lib/types/**/*.d.ts`.

See `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-message-feedback/package.json:13-42,74-83` and `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-modules/package.json:13-38,46-61`.

`dsh.client.inject` is a **client package/module ordering declaration**. The browser module’s exported `inject` array is the Cordis **service dependency** list. They are related but not interchangeable (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-message-feedback/package.json:32-41`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-message-feedback/lib/client.js:655-678`).

### Recommended package tree

```text
packages/pump-observer/
  package.json
  src/
    index.ts                 # Node Cordis plugin exports: name/inject/Config/apply
    observer-service.ts      # singleton socket + state machine + timer
    raw-store.ts             # append-only durable writer and replay
    domain.ts                # small DSH storageDomain spec for summaries/settings
    protocol.ts              # browser-safe request/event schemas and constants
    client/
      index.tsx              # browser apply/inject + slot registration
      controller.ts          # snapshot store, RPC calls, SSE reconciliation
      PumpObserverSection.tsx
  lib/
    index.js                 # built Node entry
    client.js                # tsdown browser registration bundle
    types/**
```

The split mirrors ordinary client plugins: `src/index.ts` and `src/client/index.ts` are normal; the special split-project build used by `api-remotes` should **not** be copied merely because a package has both faces (`$CHECKOUT/node_modules/@deepseek-ai/dsh-api-remotes/README.md:19-27`). A browser-only package may use an empty Node face (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/index.js:1-5`), but Pump Observer should use its root entry for real Host behavior.

### Suggested manifest shape

```json
{
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./package.json": "./package.json"
  },
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-connection",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-locale"
      ]
    }
  },
  "scripts": {
    "bundle": "tsdown",
    "watch": "tsdown --watch"
  }
}
```

Exact dependency IDs must match the deployment’s Loader rows. Existing packages use package IDs in `dsh.client.inject`, not service names (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-settings-models/package.json:32-41`).

---

## 2. Node lifecycle and activation APIs

DSH plugins are Cordis plugins. A plugin exports an `apply(ctx, config)` function or a `Service` subclass, declares required services with `inject`, and may expose a schema as `Config`. `ctx.plugin()` creates a Fiber; required services delay activation; effects, listeners, and services are removed when the owning Fiber is disposed (`$CHECKOUT/node_modules/@deepseek-ai/cordis/README.md:18-67`).

Fiber states are `PENDING`, `LOADING`, `ACTIVE`, `FAILED`, `UNLOADING`, and `DISPOSED`. Disposers execute in reverse registration order and async cleanup is awaited (`$CHECKOUT/node_modules/@deepseek-ai/cordis/lib/types/fiber.d.ts:32-73,92-112,145-159`). A Fiber can be restarted or updated, but a disposed Fiber cannot restart (`$CHECKOUT/node_modules/@deepseek-ai/cordis/lib/types/fiber.d.ts:175-199`).

Host examples use:

- `ctx.provide(name, value)` / `Service` for a service.
- `ctx.inject([...], callback)` for optional/later service-dependent activation.
- `ctx.effect(() => disposer, label)` to own sockets, routes, timers, domains, and listeners.
- `ctx.webServer.register(...)` and `registerUpgrade(...)`, wrapped in an effect.

Examples: web-app provides `webRuntime` and mounts a child plugin at `$CHECKOUT/node_modules/@deepseek-ai/dsh-web-app/lib/index.js:172-193`; Connection owns HTTP and WebSocket registrations/teardown at `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js:530-585`; HMR owns a timer, route, open responses, and cleanup at `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/lib/index.js:38-159`.

### Recommended observer lifetime

The Loader row activates one `PumpObserverService` per Host process. **Start and Stop are methods on that service, not plugin mount/unmount operations.** This avoids creating multiple external sockets through repeated Fiber activation.

State machine:

```text
stopped -> starting -> running -> stopping -> stopped
                    \-> error -> stopped
```

Rules:

1. `start(durationMs?)` is serialized; it rejects or returns the current snapshot unless state is `stopped`.
2. Allocate exactly one `AbortController`, one socket reference, and at most one stop timer.
3. Set `running` only after the external socket is open and subscriptions are installed.
4. Every raw message enters one ordered append chain; derived windows and browser publication occur only after the selected durability boundary succeeds.
5. `stop()` cancels the timer, closes/terminates the socket, awaits the read loop and pending durable writes, then publishes `stopped`.
6. Fiber disposal closes admission, calls the same stop path, drains accepted writes, closes the small domain, destroys SSE responses, and removes routes.

The close-admission/drain/domain-close ordering directly follows the robust Host example in `$CHECKOUT/node_modules/@deepseek-ai/dsh-message-feedback/README.md:50-58` and `$CHECKOUT/node_modules/@deepseek-ai/dsh-message-feedback/lib/index.js:239-267`.

### Process restart behavior

Cordis manages cleanup within a running process; it does not preserve an external WebSocket or timer across process death. Client package metadata is cached by package name; plugin-set/manifest changes require a Host restart, while rebuilt client bundle bytes can be re-hashed for HMR (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:76-85,320-339`).

Recommended restart contract:

- On Host boot: load durable summaries/raw files, prune token windows older than ten minutes, expose `stopped`.
- Do not restore a previous in-memory timer.
- Do not report `running` until a new socket handshake succeeds.
- Require a Start click after every Host restart. Persist `lastStartedAt`, `lastStoppedAt`, and stop reason only as history.

---

## 3. Host API calls and live updates

### Narrow supported control API: generic Connection RPC

The Connection Host service exposes `ctx.connection.rpc.handle(channel, handler, { authority })`; the browser exposes `ctx.connection.rpc.call(channel, endpoint, payload, signal)`. It uses POST JSON envelopes, validates method/path correlation, and returns the existing `{ok: ...}` RPC result shape (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/lib/types/rpc.d.ts:1-49`; implementation at `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js:200-300` and browser caller at `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/lib/client.js:10196-10235`).

Recommended endpoints on `/pump-observer`:

- `status`
- `snapshot`
- `start` with `{ durationMs?: number }`
- `stop`

Use `{ authority: 'loopback' }` for Start/Stop in the first slice. DSH’s trusted-host fence is reachability/DNS-rebinding protection, not authentication; remote mutation should not be opened merely by selecting `trusted-host` (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/README.md:7-13`).

### Live dashboard: package-owned SSE

For this independent app domain, the narrowest supported live path is a package-owned SSE route, following HMR exactly:

- Node registers an exact GET route and writes `text/event-stream` frames.
- It sends an initial full snapshot, then small `state`, `token-upsert`, `token-expired`, and `stats` frames.
- The browser owns an `EventSource` inside `ctx.effect`; disposal calls `close()`.
- Reconnect always receives a fresh snapshot, so missed frames do not need replay IDs in the vertical slice.

Reference Host pattern: `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/lib/index.js:104-159`. Reference browser pattern: `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/lib/client.js:30-85`.

Security caveat: the HMR SSE stream carries only development bundle metadata and does not apply Connection’s `/api` trust fence. A Pump stream should publish only intentionally non-secret summaries. Keep controls on loopback RPC. If dashboard data later becomes sensitive or remote access is required, add a first-class authenticated boundary rather than treating same-origin or `trustedHosts` as authentication.

### Why not extend API Remotes first

The built-in Remote path is excellent for application-owned, generated Host capabilities and forwarded Cordis events: client code mounts generated contributions and consumes `ctx.remote.$on(...)` (`$CHECKOUT/node_modules/@deepseek-ai/dsh-api-remotes/README.md:5-17`). However, the capability set and forwarded-event allowlist are explicit build-time assembly choices; adding capabilities requires modifying that assembly (`$CHECKOUT/node_modules/@deepseek-ai/dsh-api-remotes/README.md:37-41`). That is wider than a standalone Pump plugin and conflicts with “do not modify DSH.” Generic Connection RPC plus an owned SSE route is therefore the narrower supported slice.

DSH’s standard browser transport itself uses HTTP POST for unary calls and two downlink-only WebSockets (`events.mux` and `events.host`); loss of either rebuilds the generation (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/README.md:5-13`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/lib/client.js:10117-10194`). Those fixed streams are not a general registration API for an arbitrary app event domain.

---

## 4. Browser activation and panel registration

The browser bundle exports `apply` and `inject`. The client module system materializes bundle factories lazily and gives Cordis Loader responsibility for Fiber lifecycle, dependency waiting, refresh, and disposal (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-modules/README.md:5-15`). Browser effects must own EventSource, subscriptions, locale dictionaries, and slot registrations.

There is no first-party route registry or React Router surface in the inspected shell. The React renderer performs one root slot render; feature composition happens through typed slots (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-renderer/README.md:5-7`). `ui-layout` occupies the single `root` slot and declares shell child seats (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js:392-435`).

The safest extension seat for a new independent dashboard is `settings.section`, a root-scoped list slot declared by the settings shell (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/client.js:536-595`). A feature registers with an id, order, label, injected controller/hooks, and component. The Models page is the canonical example (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js:2720-2790`).

Recommended browser plugin:

```ts
export const inject = ['slots', 'connection', 'locale']

export function apply(ctx) {
  const controller = new PumpObserverController(ctx.connection.rpc)
  ctx.effect(() => controller.connect(), 'pump-observer: rpc + events')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'pump-observer',
    order: 40,
    label: () => 'Pump Observer',
    inject: () => ({ controller, hooks: { snapshot: controller.store } }),
  }, PumpObserverSection))
}
```

Caveat: this is a **settings panel**, not a URL-addressable app route. A dedicated route/sidebar application mode would require a wider shell contract or a new declared slot; the inspected checkout does not provide one. Do not replace the single `root`, `sidebar`, `conversation`, or `details` owners for the first slice.

The UI should treat a full snapshot as authoritative and re-fetch on SSE open/error or Host reconnect. Existing client plugins explicitly resync on `connection/reset` (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-message-feedback/lib/client.js:678-718`).

---

## 5. Persistence conventions and raw-event caveat

Web composition mounts:

- `@deepseek-ai/dsh-storage`
- JSON backend rooted at `dshHomePath('storages')`
- domain form routed to backend `json`

at `$CHECKOUT/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:51-63`.

The storage hub is for non-session data and currently exposes a KV facet (`$CHECKOUT/node_modules/@deepseek-ai/dsh-storage/README.md:5-12`). `storageDomain` provides schema-validated in-memory state, serialized writes, durability-before-memory publication, and in-process `domain/changed`; the opening consumer must close its handle (`$CHECKOUT/node_modules/@deepseek-ai/dsh-storage-domain/README.md:5-5,32-35`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-storage-domain/lib/types/index.d.ts:48-103`). Workspace demonstrates `await ctx.storageDomain.open(spec)` plus an effect-owned `domain.close()` (`$CHECKOUT/node_modules/@deepseek-ai/dsh-workspace/lib/index.js:289-325`).

The JSON backend stores one `<unit>.json`, rewrites the complete unit on each primitive through temp-write, fsync, and atomic rename, has no cross-process locking, and rejects version mismatches without migration (`$CHECKOUT/node_modules/@deepseek-ai/dsh-storage-json/README.md:5-17,35-38`). The backend contract confirms that only KV exists and one put is durable once resolved (`$CHECKOUT/node_modules/@deepseek-ai/dsh-storage/lib/types/backend.d.ts:15-38,51-96`).

Therefore:

- **Good domain data:** observer metadata, last state transition, compact per-token summary/checkpoint, UI preferences.
- **Bad domain data:** every raw Pump event at stream rate. Whole-file rewrite makes this structurally unsuitable.
- **Raw store:** app-owned append-only NDJSON or equivalent under a configured `dataDir`, preferably composed as a `$DSH_HOME/storages/pump_observer_raw` path in the profile patch. Use date/size segments, a serialized writer, explicit flush policy, and replay validation.
- If “durable” means an acknowledged event must survive power loss, resolve the event write only after `fdatasync`/`fsync`. If batching is introduced, document the bounded loss window; do not call buffered append “durable” without that caveat.

Ten-minute window recommendation:

- Key by mint/token id.
- `windowStart = first observed qualifying event time`; `expiresAt = windowStart + 600_000`.
- Maintain one map plus one expiry heap/sweep timer, not one Node timer per token.
- Append raw first, then mutate the in-memory aggregate and emit SSE.
- On restart/reconnect, rebuild current windows from a bounded tail of raw segments or from compact durable checkpoints, then prune by event timestamp and current wall clock.

No first-party append-log storage facet or SQLite backend is present in this installed Web dependency set; the storage docs explicitly say KV is the current facet and describe SQLite as the scale direction rather than a mounted backend (`$CHECKOUT/node_modules/@deepseek-ai/dsh-storage/README.md:29-32`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-storage-json/README.md:5-11`).

---

## 6. Composition row

Add the package as one enabled Loader row in the application/profile patch, after Web’s storage, webserver, Connection, and settings-slot providers are available. The Web roster itself is an ordered Loader patch (`$CHECKOUT/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:43-67,99-180,182-209`). A minimal row is:

```yaml
- id: pump-observer
  name: '@local/pump-observer'
  config:
    dataDir: !!js dshHomePath('storages/pump_observer_raw')
    windowMs: 600000
```

The exact local package resolution mechanism belongs to the deployment profile/Loader config and is not specified in the inspected published checkout. The package must be resolvable from that config tree’s `baseUrl`, because client-modules resolves `<package>/package.json` from it (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:272-276,377-403`).

---

## 7. HMR, build, and verification

### Exact commands supported by inspected sources

- Full Web artifact build: `pnpm run build` from the DSH repository root. Missing frontend dist fails activation with that exact instruction (`$CHECKOUT/node_modules/@deepseek-ai/dsh-web-app/lib/index.js:106-114`).
- Client-plugin rebuild watcher needed for no-refresh reload: `pnpm run dev:web` from the same DSH checkout (`$CHECKOUT/node_modules/@deepseek-ai/dsh-web-app/lib/index.js:96-99`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/README.md:5-7`).
- Package-local browser bundle: `pnpm run bundle` -> `tsdown`.
- Package-local browser watch: `pnpm run watch` -> `tsdown --watch`.

The package-local scripts are evidenced at `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-message-feedback/package.json:80-83` and `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-modules/package.json:58-61`.

### HMR limitations

Client HMR watches built bundle mtimes/content, announces changes over SSE, invalidates/prefetches, tears down the old client Fiber/styles, and refreshes it (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/README.md:5-7`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/lib/client.js:35-85`). It is coarse: React state is lost; there is no rollback; Host data/runtime Fibers remain (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/README.md:17-21`).

Web’s ordinary/shared Host HMR row is explicitly disabled (`$CHECKOUT/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:21-23`). Thus:

- Browser `lib/client.js` changes can reload without page refresh only while the DSH `dev:web` rebuild watcher is actually rewriting the bundle.
- Node plugin changes require rebuilding and restarting the existing DSH process.
- Shell/plain-package changes require rebuilding affected Web artifacts and refreshing the existing GUI.
- Starting another Vite server does not update the running GUI; the Vite shell is not standalone because DSH injects `window.__DSH_BOOT__` (`$CHECKOUT/node_modules/@deepseek-ai/dsh-web-app/lib/index.js:96-99`).

### Objective vertical-slice proof

The installed checkout publishes no repository-root test script and omits tests from package files. Therefore there is **no source-backed exact DSH test command to quote** from this checkout. Do not invent one.

The Pump package should define its own test script and make these objective checks pass:

1. **Single-socket unit test:** concurrent/repeated Start calls produce at most one external socket; Stop is idempotent and awaits close.
2. **Timer test with fake clock:** duration expiry runs the same Stop path exactly once; manual Stop cancels it.
3. **Durability/reopen test:** after each acknowledged event boundary, close and reopen the store and verify byte-for-byte raw payload/order.
4. **Window test:** token windows expire exactly at ten minutes, late events follow an explicit policy, and restart replay reconstructs only unexpired windows.
5. **Host RPC contract test:** `status/start/stop/snapshot` validate payloads, return discriminated results, and reject non-loopback authority for controls.
6. **SSE contract test:** first frame is a full snapshot; reconnect repairs missed deltas; plugin disposal destroys open responses.
7. **Client component test:** Start/Stop disabled states follow the Host state, optional duration is validated, loading/empty/error/reconnecting states render, and disposal closes EventSource.
8. **Bundle test:** from the Pump package, run `pnpm run bundle`; verify both `lib/index.js` and `lib/client.js` plus declarations exist.
9. **DSH integration proof:** after full-root `pnpm run build`, restart the existing `dsh web`, refresh its existing URL, verify the Pump Observer settings section appears, Start opens one PumpAPI socket, live cards update, Stop closes it, and a Host restart returns `stopped` while raw records remain readable.

---

## 8. Existing examples to reuse

1. **`@deepseek-ai/dsh-message-feedback` — Host/data lifecycle.** Durable domain declaration, schema validation, `Service.init`, operation serialization, admission close, queue drain, and domain cleanup (`$CHECKOUT/node_modules/@deepseek-ai/dsh-message-feedback/README.md:5-58`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-message-feedback/lib/index.js:183-267,287-345`). Reuse its lifecycle discipline, not its Session-specific Remote or whole-row storage shape.
2. **`@deepseek-ai/dsh-client-ui-message-feedback` — browser Fiber and slot cleanup.** Client manifest, browser `inject`, observable controller, reconnect resync, slot registration, and disposal (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-message-feedback/package.json:13-42`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-message-feedback/lib/client.js:655-719`).
3. **`@deepseek-ai/dsh-client-hmr` — package-owned SSE.** Exact Host route/client EventSource lifecycle and reconnect-friendly initial snapshot pattern (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/lib/index.js:104-159`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-hmr/lib/client.js:30-85`).
4. **`@deepseek-ai/dsh-client-ui-settings-models` — full settings panel.** `settings.section` registration with label/order/controller/hooks (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js:2720-2790`).
5. **`@deepseek-ai/dsh-client-connection` — generic unary RPC and trust.** Use its owned channel rather than modifying the fixed `/api` Remote BFF (`$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/lib/types/rpc.d.ts:1-49`; `$CHECKOUT/node_modules/@deepseek-ai/dsh-client-connection/lib/index.js:200-300`).
6. **`@deepseek-ai/dsh-workspace` — open/close storage domain.** Async service initialization and effect-owned close (`$CHECKOUT/node_modules/@deepseek-ai/dsh-workspace/lib/index.js:289-325`).

## Final narrow vertical slice

Implement only:

- one dual-face package and one Loader row;
- stopped-by-default Host service;
- `status`, `snapshot`, `start(durationMs?)`, and `stop` loopback RPCs;
- one external PumpAPI WebSocket invariant;
- append-only raw records with an explicit flush boundary;
- in-memory ten-minute windows plus bounded restart replay;
- summary SSE with initial snapshot;
- one `settings.section` dashboard with Start, Stop, optional duration, connection state, aggregate counts, and active-token rows.

Defer authenticated remote controls, a dedicated top-level route, generated API Remote integration, cross-process writers, and a generalized DSH storage backend until the vertical slice proves socket ownership, durability, restart semantics, and UI reconciliation.