## Context

The ten-second skill saves one derived row per Pump.fun launch, including rank, mint, buy count, unique buyers, repeat ratio, exact volume, and ten one-second bars. The existing static PDF does not support comparison or drill-through. See `proposal.md` and the capability spec.

## Goals / Non-Goals

**Goals:**
- Keep the surface to one chart, one toolbar, and one table.
- Make line-shape comparison the primary action.
- Generate the page locally from derived results with no new runtime dependency.
- Make each mint directly actionable through Pump.fun Advanced.

**Non-Goals:**
- Build the full multi-skill dashboard or navigation system.
- Fetch post-window prices or market-cap outcomes.
- Present raw event records in the browser.
- Choose a permanent visual language for every future analysis page.

## Decisions

1. **Use one self-contained HTML artifact.** The generator embeds derived rows and plain browser JavaScript, so the report opens immediately and can later be hosted unchanged. A framework would add setup cost before the interaction model is settled.
2. **Use a shared SVG line chart with three transformations.** Per-second activity reveals bursts, cumulative buys reveals total acceleration, and normalized cumulative pace compares shape independent of volume. The previous horizontal ranking chart is removed because it repeats the table without showing temporal behavior.
3. **Let the table drive selection.** The first eight ranked coins are selected initially. Search, result limits, row toggles, select-visible, and clear-selection support quick iteration while keeping line count controlled.
4. **Use the official Pump.fun Advanced route.** Every row links to `https://pump.fun/advanced/coin?mintId=<mint>`, which opens the terminal chart directly.
5. **Treat JSON as internal state.** The human artifact is the interactive page. Existing JSON and NDJSON remain inputs for other skills but are not presented as deliverables.

## Risks / Trade-offs

- **[Too many selected lines become difficult to distinguish]** -> Cap simultaneous selection at 20 and emphasize a line and table row together on hover.
- **[Pump.fun changes its terminal route]** -> Keep URL construction in one generator function and cover it with a fixture assertion.
- **[A self-contained page becomes large]** -> Embed only derived rows; Batch 001 remains far smaller than the raw event dataset.
- **[The first visual model is still not useful]** -> Keep chart modes and presentation logic isolated so they can be replaced without changing the metric result.

## Migration Plan

Add the generator and command alongside the analysis runtime. Remove PDF generation from the current skill flow and make the comparison page the human-facing artifact. Rollback removes the generator and script without changing any recorded or derived data.
