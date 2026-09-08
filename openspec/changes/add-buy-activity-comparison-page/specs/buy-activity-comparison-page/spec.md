## Purpose

Give the user a fast visual way to compare the first ten seconds of Pump.fun launches and move from an observed pattern to the coin's live terminal chart.

## ADDED Requirements

### Requirement: Selected coins share one comparison chart
The page SHALL plot selected coins together on one line chart and SHALL support per-second buys, cumulative buys, and normalized cumulative pace.

#### Scenario: Change comparison mode
- **WHEN** the user changes the chart mode
- **THEN** every selected coin is redrawn on the same time axis using the selected transformation

### Requirement: Table controls chart membership
The page SHALL provide a searchable and sortable coin table whose rows can add or remove coins from the comparison chart.

#### Scenario: Toggle a coin
- **WHEN** the user toggles a coin's row
- **THEN** that coin's line and legend entry are added or removed without reloading the page

### Requirement: Every coin links to its Pump.fun terminal
The page SHALL construct a Pump.fun Advanced terminal URL from each coin mint and open it in a new browser tab.

#### Scenario: Open a launch chart
- **WHEN** the user activates a coin's terminal link
- **THEN** the browser opens `https://pump.fun/advanced/coin?mintId=<mint>` for that coin

### Requirement: Initial view remains readable
The page SHALL initially select no more than ten top-ranked observable coins, SHALL make the selection count visible, and SHALL preserve access to all observable rows through search and table limits.

#### Scenario: Open a large result
- **WHEN** the result contains hundreds of observable coins
- **THEN** the chart opens with a readable top-ranked selection while the table can reveal all matching coins

### Requirement: Page is a generated skill artifact
The comparison page SHALL be self-contained and generated from a saved analysis result without loading raw event records or requiring a model call.

#### Scenario: Generate from Batch 001
- **WHEN** the page is generated from the Batch 001 result
- **THEN** it embeds the derived coin rows and can be opened locally without network access except when the user follows an external terminal link
