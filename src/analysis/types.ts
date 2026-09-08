export interface CollectionBatch {
  readonly schema: 'pump.collection-batch/1'
  readonly batch_id: string
  readonly label: string
  readonly run_ids: readonly string[]
}

export type ObservationStatus = 'complete' | 'unobservable'

export interface SecondBar {
  readonly second: number
  readonly buy_count: number
}

export interface TenSecondBuyActivityRow {
  readonly schema: 'pump.metric.ten-second-buy-activity/1'
  readonly formula_version: 'ten-second-buy-activity/1'
  readonly batch_id: string
  readonly run_id: string
  readonly mint: string
  readonly name: string | null
  readonly symbol: string | null
  readonly created_at: string | null
  readonly observation_status: ObservationStatus
  readonly unobservable_reasons: readonly string[]
  readonly buy_count: number | null
  readonly unique_buyers: number | null
  readonly repeat_buy_ratio: string | null
  readonly buyer_identity_status: 'complete' | 'partial_missing_wallets' | 'unobservable'
  readonly missing_buyer_wallet_count: number | null
  readonly buy_quote_raw: string | null
  readonly buy_quote_known_raw: string
  readonly quote_amount_status: 'complete' | 'partial_missing_amounts' | 'unobservable'
  readonly missing_quote_amount_count: number | null
  readonly max_buys_per_slot: number | null
  readonly one_second_bars: readonly SecondBar[] | null
  readonly rank: number | null
}

export interface TenSecondBuyActivityResult {
  readonly schema: 'pump.analysis-result/1'
  readonly skill_id: 'ten-second-buy-activity'
  readonly skill_version: '1.0.0'
  readonly formula_version: 'ten-second-buy-activity/1'
  readonly result_id: string
  readonly generated_at: string
  readonly batch: CollectionBatch
  readonly parameters: { readonly window_ms: 10_000; readonly preview_limit: number }
  readonly input: {
    readonly raw_records_represented: number
    readonly raw_records_scanned: number
    readonly create_records_found: number
    readonly buy_records_found: number
  }
  readonly summary: {
    readonly coin_observations: number
    readonly observable: number
    readonly unobservable: number
    readonly zero_buy_observations: number
  }
  readonly rows: readonly TenSecondBuyActivityRow[]
}

export interface TenSecondBuyActivityReceipt {
  readonly schema: 'pump.analysis-receipt/1'
  readonly skill_id: 'ten-second-buy-activity'
  readonly skill_version: '1.0.0'
  readonly result_id: string
  readonly batch_id: string
  readonly summary: TenSecondBuyActivityResult['summary']
  readonly input: TenSecondBuyActivityResult['input']
  readonly preview_limit: number
  readonly preview: readonly TenSecondBuyActivityRow[]
  readonly full_result_path: string
  readonly rows_path: string
  readonly report_path: string
  readonly csv_path: string
}
