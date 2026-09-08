## Why

The existing PDF and static bar views make first-ten-second launch shapes hard to compare and do not connect a coin to its live Pump.fun chart. The analysis needs a deliberately simple interactive page that can change quickly as new metrics and comparison ideas are tested.

## What Changes

- Add a self-contained comparison page generated from a saved ten-second buy activity result.
- Replace the static ranking bars with a shared line chart whose selected coins can be compared as per-second activity, cumulative buys, or normalized pace.
- Add a compact sortable, searchable table and let each row toggle its coin on the chart.
- Link every coin directly to the Pump.fun Advanced terminal using its mint address.
- Keep machine-readable result files internal and treat this page as the human-facing skill output.

## Capabilities

### New Capabilities
- `buy-activity-comparison-page`: Interactive chart and table behavior for comparing ten-second Pump.fun launch activity.

### Modified Capabilities

## Impact

Adds a static page generator and a small local site command under the analysis module. It consumes existing `pump.analysis-result/1` JSON and adds no third-party runtime dependency.
