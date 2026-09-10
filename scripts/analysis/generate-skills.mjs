import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { FILTERS, definition } from '../../lib/analysis/catalog/filters.js'
import { digest } from '../../lib/analysis/filters/artifacts.js'
const root = fileURLToPath(new URL('../..', import.meta.url))
const check = process.argv.includes('--check')
const old = JSON.parse(await readFile(join(root, 'analysis/catalog.json'), 'utf8'))
const skills = FILTERS.map((f) => {
  const d = definition(f.id)
  return {
    id: f.id,
    version: d.version,
    type: 'filter',
    name: d.name,
    question: d.description,
    input: d.source_schema,
    output: 'pump.filter-cohort/1',
    human_output: 'first-minute-comparison-page',
    implementation_status: 'implemented',
    validation: 'Consult the versioned readiness receipt; runnable is not predictive validation.',
    window_ms: 60000,
    parameters: d.parameters,
    definition_hash: digest(d),
    data_requirements: [
      'finalized run',
      'recorded Pump creation',
      'complete first-minute coverage',
      ...(['buyer-diversity', 'repeat-buyer-concentration', 'new-buyer-arrival-rate'].includes(f.id)
        ? ['complete buyer identities']
        : []),
    ],
    model_policy: { raw_records_in_context: 0, maximum_receipt_bytes: 65536, maximum_preview_rows: 20 },
    examples: ['Run ' + d.name + ' on Batch 001.'],
    caveats: [
      'Incomplete values are not zero.',
      'Distinct wallets need not be distinct people.',
      'Filters describe cohorts; predictive performance is unvalidated.',
    ],
  }
})
const catalog = { ...old, skills: [...old.skills.filter((s) => s.type !== 'filter'), ...skills] }
async function output(path, text) {
  text = text.replace(/[ \t]+$/gm, '')
  if (check) {
    if ((await readFile(path, 'utf8')) !== text) throw Error('catalog/skill drift: ' + path)
  } else {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, text)
  }
}
function dirname(path) {
  return path.slice(0, path.lastIndexOf('/'))
}
await output(join(root, 'analysis/catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
for (const f of FILTERS) {
  const d = definition(f.id)
  await output(join(root, 'analysis/filters', f.id + '.json'), JSON.stringify(d, null, 2) + '\n')
  await output(
    join(root, '.agents/skills', f.id, 'SKILL.md'),
    `---
name: ${f.id}
description: ${JSON.stringify(d.description + ' Use for filtering a named Meme Explorer collection batch.')}
---

# ${d.name}

Use the deterministic first-minute analyzer and saved filter definitions. This is cohort analysis; no model training is involved.

Resolve the batch manifest and its absolute data root. For this iMac's Batch 001, read \`planning/evidence/batch-001-imac-import/README.md\`; keep new output outside the imported data tree. Build with \`pnpm build\` if needed. If pnpm is not on PATH, this iMac has \`/Users/drewp/.hermes/node/bin/corepack pnpm\`.

Generate the compatible feature result once:
\`pnpm analyze:60s -- --data-root <absolute-data-root> --batch <absolute-batch-json> --output-root <absolute-output>\`

Run this skill against the saved feature result:
\`pnpm analysis:filters -- --result <absolute-feature-result> --filter ${f.id} --output-root <absolute-output>\`

Default parameters: \`${JSON.stringify(d.parameters)}\`. Use \`--parameters '<JSON overrides>'\` for a requested threshold; save the resulting definition hash and parameters. ${f.id === 'launch-activity-shape' ? 'Other modes: {"mode":"opening-burst","min_opening_share":0.7} or {"mode":"building","growth_factor":2}.' : ''}

The feature window is fixed at [creation, creation + 60 seconds). Ten-second buckets only summarize that same minute. Keep missing data unobservable, preserve source and definition versions, and report members/rejected/unobservable counts. Read bounded receipts, not raw events, into model context. Complete results stay on disk.

Generate the human view with \`pnpm analysis:60s-page -- --result <absolute-feature-result> --output <absolute-page>\`; it compares all six default definitions. For a custom threshold, pass \`--cohort <absolute-cohort-result>\` to include its saved definition and membership in the view. Serve with \`pnpm analysis:serve -- --page <absolute-page> --port <available-port>\`.

Check \`planning/evidence/six-filter-validation/\` for validation evidence when available. Distinct wallets are not necessarily distinct people; operational validation does not establish predictive value.
`,
  )
}
console.log(JSON.stringify({ catalog_filters: skills.length, generated_skills: skills.length, check }))
