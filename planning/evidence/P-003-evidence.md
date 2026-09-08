# P-003 Evidence — Pump.fun discovery feed

- Accessed: 2026-08-26

## Direct provider source

- Source: [PumpPortal real-time data API](https://pumpportal.fun/data-api/bonk-fun-data-api/)
- Finding: The provider documents a WebSocket endpoint for real-time token-creation and trading data. This can provide the narrow Pump.fun new-token discovery stream needed for the first MVP without implementing raw on-chain program decoding first.
- Decision effect: Prefer a managed WebSocket adapter for the MVP, while preserving an internal normalized event boundary so the feed can be replaced later.

## Direct provider terms / availability caveat

- Source: [PumpPortal fees](https://pumpportal.fun/fees/)
- Finding: The provider states that trading data will require an API key beginning May 1, 2026, while data received from the WebSocket is described separately.
- Decision effect: Before any deployment, verify the then-current key, pricing, rate-limit, and redistribution rules. The MVP should not assume a free or permanent feed.

## Limitation

- This evidence establishes an available documented feed, not its production latency, completeness, uptime, or suitability for a funded trading system. A bounded live observation test remains required.