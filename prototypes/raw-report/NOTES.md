# Pump.fun-only report design preview

Status: throwaway prototype for Drew to critique. No layout or filtering rule is approved by making this preview.

The question is what a post-run report should look like outside Discord, and which measurements belong in the main table versus coin details. The preview is now strictly scoped to Pump.fun launches.

## Open and compare

Download `raw-recordings-preview.html` and open it in a current desktop browser. It is self-contained, requires no server, and makes no external requests. Its compressed embedded data requires a browser with DecompressionStream support. Phone-width layouts were inspected in Chromium, but an actual phone attachment/opening flow was not tested.

The bottom switcher offers three layouts on the same page; left/right arrow keys also switch:

- A — Table: search, sort and page through the complete inventory; open coin details; export all coins to CSV.
- B — Visual atlas: cumulative recorded buy/sell charts by coin, with one run and currency per chart.
- C — Report: reading and printing layout, batch overview, recording counts and paged inventory.

`raw-recordings-preview.pdf` is a static example of C. All 592 Pump.fun launches remain accessible in the HTML and its CSV export. The PDF is a design sample, not a complete event export.

## Evidence and boundaries

Four separate source recordings total 30 recorded minutes. The Pump.fun-only derived view contains 41,894 matching raw frames and 128,631 matching normalized records across 592 explicitly captured Pump.fun creations. This is not one continuous half hour and does not imply 30 minutes of observations per coin.

Membership requires a raw creation event whose `pool` field is exactly `pump`. Meteora and unknown-origin mints are excluded. The mint suffix and later trade venue are not used as origin proof. Events for an accepted Pump.fun mint remain associated with it after a later migration.

The inventory summarizes events; it does not embed every raw frame. Across these coins there are 582,219 matched buy/sell events. Exact quote-volume totals are decimal strings, kept separate by currency. Small chart bins use approximate numbers; they are not price forecasts or future outcomes. Each cumulative point represents a chart bin ending at or before the final observed event.

Time to cutoff is measured from source creation or first observation to that recording's end, using provider timestamps when available and receipt timestamps otherwise. Separate windows are summed for multi-run rows; recording interruptions are not deducted. It is not uninterrupted coverage. The inspector separately shows first/last event times.

Each coin has a bounded set of raw source examples with run and sequence references. Where present, examples expose price, quote-denominated market cap, token/quote reserves, fee rate, trade venue, transaction signer and trader. Missing fields remain missing. Source example values are not current prices or later outcomes; provider reserve fields are not interpreted as executable liquidity.

No analytical filtering, risk labels, rug/bundle judgments, outcome queries, collection, or source deletion was performed. Existing recording data stays read-only at `/home/drewp/main-projects/meme explorer/data`.

## Rebuild

Run from any working directory using absolute paths:

```bash
python3 /home/drewp/main-projects/wt-1546664272094953562/prototypes/raw-report/build_data.py
python3 /home/drewp/main-projects/wt-1546664272094953562/prototypes/raw-report/build_report.py
```

`build_data.py` reads the existing corpus and replaces only the derived `data.json`; `build_report.py` embeds that file, `template.html`, `style.css`, and `app.js`. There are no model calls in either script. A bounded Luna agent helped build the extractor, with the parent implementing the UI and checking totals and browser behavior. A future reporting skill and automatic delivery have not been implemented.

## Verification

Extractor assertions cover counts, origin breakdown, quantities, bounded evidence, run windows and source stat fingerprint. Parent independently checked unique mint coverage, trade/event quantity counts, and all-coin CSV export. Chromium checks passed for search, no-match recovery, pagination, sorting, three layouts, keyboard switching, all tabs, exact raw detail fields and CSV download. No console errors or external requests occurred. Additional-series labels and changing the inspector to another run were verified. The layout switcher occupies its own bottom space outside the scrolling data viewport.

A current Pump.fun-only desktop screenshot is saved in `.impeccable/review/`. Earlier screenshots and the old CSV verification containing other providers were removed from the active branch; Git history retains them. The PDF was regenerated. Independent Luna design review previously resolved its three requested layout fixes. The mechanical design detector reported no regex findings but ran in degraded mode without parser modules, so it did not verify computed contrast.

## Next critique

Choose the main layout, the columns visible without opening a coin, the chart type and comparison scale, and whether browser HTML plus a PDF snapshot is the desired delivery. Keep the table as a candidate, not an accepted decision. Once the deliverable is agreed, resume precise filter definitions and overall post-run planning. Do not infer filters from how this preview is sorted.
