# Unfiltered report design preview

Status: throwaway prototype for Drew to critique. No layout or filtering rule is approved by making this preview.

The question is what a post-run report should look like outside Discord, and which measurements belong in the main table versus coin details. The eventual reporting skill can generate the chosen deliverable from a raw batch or a future saved selection.

## Open and compare

Download `raw-recordings-preview.html` and open it in a current desktop browser. It is self-contained, requires no server, and makes no external requests. Its compressed embedded data requires a browser with DecompressionStream support. Phone-width layouts were inspected in Chromium, but an actual phone attachment/opening flow was not tested.

The bottom switcher offers three layouts on the same page; left/right arrow keys also switch:

- A — Table: search, sort and page through the complete inventory; open coin details; export all coins to CSV.
- B — Visual atlas: cumulative recorded buy/sell charts by coin, with one run and currency per chart.
- C — Report: reading and printing layout, batch overview, recording counts and paged inventory.

`raw-recordings-preview.pdf` is a two-page static example of C, including 16 inventory rows. All 6,376 rows remain accessible in the HTML and its CSV export. The PDF is a design sample, not a complete event export.

## Evidence and boundaries

Four separate recordings total 30 recorded minutes: 1,074,873 raw records and 3,111,046 normalized records, approximately 3.64 GiB on disk. This is not one continuous half hour and does not imply 30 minutes of observations per coin.

Every one of the 6,376 mint addresses represented in normalized event records is included. Creation was captured for 96: 48 Pump.fun and 48 Meteora launches. The other 6,280 have no captured creation. Origin is based on creation evidence only. Pump.fun-only is a future scope decision; this requested preview excludes no origin.

The inventory summarizes events; it does not embed every raw frame. Across these coins there are 582,219 matched buy/sell events. Exact quote-volume totals are decimal strings, kept separate by currency. Small chart bins use approximate numbers; they are not price forecasts or future outcomes. Each cumulative point represents a chart bin ending at or before the final observed event.

Time to cutoff is measured from source creation or first observation to that recording's end, using provider timestamps when available and receipt timestamps otherwise. Separate windows are summed for multi-run rows; recording interruptions are not deducted. It is not uninterrupted coverage. The inspector separately shows first/last event times.

Each coin has a bounded set of raw source examples with run and sequence references. Where present, examples expose price, quote-denominated market cap, token/quote reserves, fee rate, trade venue, transaction signer and trader. Missing fields remain missing. Source example values are not current prices or later outcomes; provider reserve fields are not interpreted as executable liquidity.

No filtering, risk labels, rug/bundle judgments, outcome queries, collection, or source deletion was performed. Existing recording data stays read-only at `/home/drewp/main-projects/meme explorer/data`.

## Rebuild

Run from any working directory using absolute paths:

```bash
python3 /home/drewp/main-projects/wt-1546664272094953562/prototypes/raw-report/build_data.py
python3 /home/drewp/main-projects/wt-1546664272094953562/prototypes/raw-report/build_report.py
```

`build_data.py` reads the existing corpus and replaces only the derived `data.json`; `build_report.py` embeds that file, `template.html`, `style.css`, and `app.js`. There are no model calls in either script. A bounded Luna agent helped build the extractor, with the parent implementing the UI and checking totals and browser behavior. A future reporting skill and automatic delivery have not been implemented.

## Verification

Extractor assertions cover counts, origin breakdown, quantities, bounded evidence, run windows and source stat fingerprint. Parent independently checked unique mint coverage, trade/event quantity counts, and all-coin CSV export. Chromium checks passed for search, no-match recovery, pagination, sorting, three layouts, keyboard switching, all tabs, exact raw detail fields and CSV download. No console errors or external requests occurred. Additional-series labels and changing the inspector to another run were verified. The layout switcher occupies its own bottom space outside the scrolling data viewport.

Desktop (1440 x 1000) and phone-width (390 x 844) screenshots are saved in `.impeccable/review/`. The PDF was text-checked and visually inspected. Independent Luna design review resolved its three requested fixes and returned “ship for design critique.” The mechanical design detector reported no regex findings but ran in degraded mode without parser modules, so it did not verify computed contrast.

## Next critique

Choose the main layout, the columns visible without opening a coin, the chart type and comparison scale, and whether browser HTML plus a PDF snapshot is the desired delivery. Keep the table as a candidate, not an accepted decision. Once the deliverable is agreed, resume precise filter definitions and overall post-run planning. Do not infer filters from how this preview is sorted.
