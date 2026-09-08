import type { LosslessJson } from './lossless-json.js'
import type { PumpApiNormalizedGroup, PumpApiObject } from './types.js'

export interface PumpApiNormalizeContext {
  readonly runId: string
  readonly rawSeq: number
  readonly receivedAt: string
  readonly source: string
  readonly transport?: 'live' | 'replay'
}

function object(value: LosslessJson | undefined): PumpApiObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function text(value: LosslessJson | undefined): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return String(value)
  return null
}

function first(record: PumpApiObject, keys: readonly string[]): LosslessJson | undefined {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key]
  return undefined
}

function firstText(record: PumpApiObject, keys: readonly string[]): string | null {
  return text(first(record, keys))
}

export function pumpApiSourceTime(record: PumpApiObject): string | null {
  const value = firstText(record, ['timestamp', 'time', 'blockTime', 'block_time', 'createdAt', 'created_at'])
  if (value === null) return null
  const numeric = /^-?\d+(?:\.\d+)?$/u.test(value) ? Number(value) : Number.NaN
  if (Number.isFinite(numeric)) {
    const milliseconds = Math.abs(numeric) < 10_000_000_000 ? numeric * 1000 : numeric
    const date = new Date(milliseconds)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function actionName(record: PumpApiObject): string {
  return firstText(record, ['action', 'txType', 'tx_type', 'type']) ?? 'unknown'
}

function canonicalAction(action: string): string {
  const compact = action.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
  if (compact === 'create' || compact === 'createtoken') return 'create'
  if (compact === 'buy') return 'buy'
  if (compact === 'sell') return 'sell'
  if (compact === 'transfer') return 'transfer'
  if (compact === 'migrate' || compact === 'migration' || compact === 'complete') return compact === 'complete' ? 'complete' : 'migrate'
  if (compact === 'createpool' || compact === 'poolcreate') return 'create_pool'
  if (compact === 'add' || compact === 'addliquidity') return 'add_liquidity'
  if (compact === 'remove' || compact === 'removeliquidity') return 'remove_liquidity'
  if (compact.includes('creatorfee') || compact.includes('claimfee')) return 'creator_fee_claim'
  return action
}

function breakdowns(root: PumpApiObject): PumpApiObject[] {
  for (const key of ['events', 'breakdown', 'breakdowns', 'actions']) {
    const value = root[key]
    if (!Array.isArray(value) || value.length === 0) continue
    const nested = value.map(object).filter((item): item is PumpApiObject => item !== undefined)
    if (nested.length > 0) return nested.map(item => ({ ...root, ...item, [key]: null }))
  }
  return [root]
}

function baseRecord(schema: string, context: PumpApiNormalizeContext, record: PumpApiObject, extras: Record<string, unknown>): Record<string, unknown> {
  return {
    schema,
    dataset_version: '1.0.0',
    run_id: context.runId,
    source: context.source,
    transport: context.transport ?? 'live',
    commitment: 'provider',
    received_at: context.receivedAt,
    raw_seq: context.rawSeq,
    source_at: pumpApiSourceTime(record),
    signature: firstText(record, ['signature', 'txSignature', 'transactionSignature']),
    slot: firstText(record, ['block', 'slot']),
    mint: firstText(record, ['mint', 'tokenAddress', 'token_address']),
    ...extras,
  }
}

function wallets(record: PumpApiObject): { address: string; roles: string[] }[] {
  const roles = new Map<string, Set<string>>()
  const add = (address: string | null, role: string): void => {
    if (address === null || address === '') return
    let set = roles.get(address)
    if (set === undefined) {
      set = new Set()
      roles.set(address, set)
    }
    set.add(role)
  }
  add(firstText(record, ['signer', 'user', 'trader']), 'signer')
  add(firstText(record, ['creator', 'tokenCreator']), 'creator')
  add(firstText(record, ['from', 'fromAddress', 'sourceOwner']), 'from')
  add(firstText(record, ['to', 'toAddress', 'destinationOwner']), 'to')
  add(firstText(record, ['poolCreator', 'pool_creator']), 'pool_creator')
  add(firstText(record, ['creatorFeeAddress', 'creator_fee_address']), 'creator_fee_recipient')
  return [...roles].map(([address, values]) => ({ address, roles: [...values].sort() }))
}

function selected(record: PumpApiObject, fields: Record<string, readonly string[]>): Record<string, LosslessJson | null> {
  return Object.fromEntries(Object.entries(fields).map(([output, keys]) => [output, first(record, keys) ?? null]))
}

export function normalizePumpApiEvent(root: PumpApiObject, context: PumpApiNormalizeContext): PumpApiNormalizedGroup[] {
  const signature = firstText(root, ['signature', 'txSignature', 'transactionSignature'])
  return breakdowns(root).map((record, breakdownIndex) => {
    const actionRaw = actionName(record)
    const action = canonicalAction(actionRaw)
    const mint = firstText(record, ['mint', 'tokenAddress', 'token_address'])
    const eventKey = signature !== null
      ? `${signature}:${breakdownIndex}:${action}`
      : `${context.rawSeq}:${breakdownIndex}:${action}`
    const event = baseRecord('pump.event/1', context, record, {
      event_key: eventKey,
      action,
      action_raw: actionRaw,
      breakdown_index: breakdownIndex,
      pool_id: firstText(record, ['poolId', 'pool_id', 'poolAddress']),
      quote_mint: firstText(record, ['quoteMint', 'quote_mint']),
    })
    const specialized: PumpApiNormalizedGroup['specialized'][number][] = []

    if (action === 'create') {
      specialized.push({
        family: 'tokens',
        dedupKey: `token:${mint ?? eventKey}`,
        record: baseRecord('pump.token/1', context, record, {
          name: firstText(record, ['name']),
          symbol: firstText(record, ['symbol']),
          uri: firstText(record, ['uri', 'metadataUri', 'metadata_uri']),
          creator: firstText(record, ['creator', 'tokenCreator']),
          creation_user: firstText(record, ['user']),
          launch_signer: firstText(record, ['signer']),
          token_program: firstText(record, ['tokenProgram', 'token_program']),
          quote_mint: firstText(record, ['quoteMint', 'quote_mint']),
          ...selected(record, {
            decimals: ['decimals'],
            supply_raw: ['supply', 'tokenSupply'],
            initial_buy_token_raw: ['initialBuy', 'initial_buy'],
          }),
          first_seen_at: context.receivedAt,
          raw_action: actionRaw,
        }),
      })
    }

    if (action === 'buy' || action === 'sell') {
      specialized.push({
        family: 'trades',
        dedupKey: `trade:${eventKey}`,
        record: baseRecord('pump.trade/1', context, record, {
          side: action,
          event_key: eventKey,
          breakdown_index: breakdownIndex,
          signing_wallet: firstText(record, ['signer', 'user', 'trader']),
          ...selected(record, {
            token_amount_raw: ['tokenAmount', 'token_amount', 'amount'],
            quote_amount_raw: ['quoteAmount', 'quote_amount', 'solAmount', 'baseAmount'],
            price_quote: ['price'],
            market_cap_quote: ['marketCapQuote', 'market_cap_quote', 'marketCapSol'],
            supply_raw: ['supply', 'tokenSupply'],
            priority_fee_raw: ['priorityFee', 'priority_fee'],
            fee_rate: ['feeRate', 'fee_rate'],
            user_token_balance_raw: ['userTokenBalance', 'tokenBalance'],
            user_quote_balance_raw: ['userQuoteBalance', 'solBalance'],
            pool_token_reserve_raw: ['poolTokenAmount', 'pool_token_amount', 'tokenReserves'],
            pool_quote_reserve_raw: ['poolQuoteAmount', 'pool_quote_amount', 'solReserves'],
            pool_virtual_quote_reserve_raw: ['poolVirtualQuoteAmount', 'virtualSolReserves'],
          }),
        }),
      })
    }

    for (const wallet of wallets(record)) {
      specialized.push({
        family: 'wallets',
        dedupKey: `wallet-event:${wallet.address}:${eventKey}`,
        record: baseRecord('pump.wallet/1', context, record, {
          address: wallet.address,
          roles: wallet.roles,
          action,
          event_key: eventKey,
        }),
      })
    }

    const curveFacts = selected(record, {
      virtual_token_reserve_raw: ['virtualTokenReserves', 'virtual_token_reserves'],
      virtual_quote_reserve_raw: ['virtualSolReserves', 'virtualQuoteReserves', 'virtual_quote_reserves'],
      real_token_reserve_raw: ['realTokenReserves', 'real_token_reserves', 'poolTokenAmount'],
      real_quote_reserve_raw: ['realSolReserves', 'realQuoteReserves', 'real_quote_reserves', 'poolQuoteAmount'],
      supply_raw: ['supply', 'tokenSupply'],
    })
    if (Object.values(curveFacts).some(value => value !== null) || ['add_liquidity', 'remove_liquidity', 'complete'].includes(action)) {
      specialized.push({
        family: 'curves',
        dedupKey: `curve:${eventKey}`,
        record: baseRecord('pump.curve/1', context, record, {
          event_key: eventKey,
          action,
          pool_id: firstText(record, ['poolId', 'pool_id', 'poolAddress']),
          complete: first(record, ['complete', 'isComplete']) ?? null,
          ...curveFacts,
        }),
      })
    }

    if (['migrate', 'create_pool', 'complete'].includes(action)) {
      specialized.push({
        family: 'migrations',
        dedupKey: `migration:${eventKey}`,
        record: baseRecord('pump.migration/1', context, record, {
          event_key: eventKey,
          stage: action,
          pool_id: firstText(record, ['poolId', 'pool_id', 'poolAddress']),
          quote_mint: firstText(record, ['quoteMint', 'quote_mint']),
          status: action === 'complete' ? 'incomplete_pending_migration' : 'observed',
        }),
      })
    }

    return { action, eventKey, mint, sourceAt: pumpApiSourceTime(record), event, specialized }
  })
}
