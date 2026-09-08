import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBuyActivityComparisonPage, pumpAdvancedUrl } from '../lib/index.js'

const row = (rank, mint, name, bars) => ({
  schema: 'pump.metric.ten-second-buy-activity/1', formula_version: 'ten-second-buy-activity/1', batch_id: 'batch', run_id: 'run',
  mint, name, symbol: name.toUpperCase(), created_at: '2026-01-01T00:00:00.000Z', observation_status: 'complete',
  unobservable_reasons: [], buy_count: bars.reduce((sum, value) => sum + value, 0), unique_buyers: rank,
  repeat_buy_ratio: '0', buyer_identity_status: 'complete', missing_buyer_wallet_count: 0, buy_quote_raw: '1',
  buy_quote_known_raw: '1', quote_amount_status: 'complete', missing_quote_amount_count: 0, max_buys_per_slot: 1,
  one_second_bars: bars.map((buy_count, second) => ({ second, buy_count })), rank
})

test('comparison page embeds derived rows, comparison modes, and Pump.fun terminal links', () => {
  const result = {
    schema: 'pump.analysis-result/1', skill_id: 'ten-second-buy-activity', skill_version: '1.0.0', formula_version: 'ten-second-buy-activity/1',
    result_id: 'result', generated_at: '2026-01-01T00:00:00.000Z', batch: { schema: 'pump.collection-batch/1', batch_id: 'batch', label: 'Batch', run_ids: ['run'] },
    parameters: { window_ms: 10000, preview_limit: 20 }, input: { raw_records_represented: 2, raw_records_scanned: 2, create_records_found: 2, buy_records_found: 3 },
    summary: { coin_observations: 2, observable: 2, unobservable: 0, zero_buy_observations: 0 },
    rows: [row(1, 'Mint/A', 'Alpha', [1,2,0,0,0,0,0,0,0,0]), row(2, 'MintB', 'Beta', [0,1,0,0,0,0,0,0,0,0])]
  }
  const html = buildBuyActivityComparisonPage(result)
  assert.match(html, /Buys each second/u)
  assert.match(html, /Cumulative buys/u)
  assert.match(html, /Normalized pace/u)
  assert.match(html, /https:\/\/pump\.fun\/advanced\/coin\?mintId=Mint%2FA/u)
  assert.match(html, /"bars":\[1,2,0,0,0,0,0,0,0,0\]/u)
  assert.doesNotMatch(html, /payload_raw/u)
  assert.equal(pumpAdvancedUrl('Mint/A'), 'https://pump.fun/advanced/coin?mintId=Mint%2FA')
})
