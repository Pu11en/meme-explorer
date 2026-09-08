export interface ExactDecimal {
  readonly coefficient: bigint
  readonly scale: number
}

export function parseExactDecimal(value: string): ExactDecimal {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(value)
  if (match === null) throw new Error(`invalid exact decimal: ${value}`)
  const sign = match[1] === '-' ? -1n : 1n
  const fraction = match[3] ?? ''
  const exponent = Number(match[4] ?? '0')
  if (!Number.isSafeInteger(exponent)) throw new Error(`decimal exponent is unsafe: ${value}`)
  let coefficient = sign * BigInt(`${match[2]}${fraction}`)
  let scale = fraction.length - exponent
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale)
    scale = 0
  }
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  return { coefficient, scale }
}

function align(left: ExactDecimal, right: ExactDecimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale)
  return [
    left.coefficient * 10n ** BigInt(scale - left.scale),
    right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  ]
}

export function compareExact(left: string, right: string): number {
  const [a, b] = align(parseExactDecimal(left), parseExactDecimal(right))
  return a < b ? -1 : a > b ? 1 : 0
}

export function addExact(left: string, right: string): string {
  const [a, b, scale] = align(parseExactDecimal(left), parseExactDecimal(right))
  return formatExact({ coefficient: a + b, scale })
}

export function subtractExact(left: string, right: string): string {
  const parsed = parseExactDecimal(right)
  return addExact(left, formatExact({ coefficient: -parsed.coefficient, scale: parsed.scale }))
}

export function formatExact(value: ExactDecimal): string {
  const negative = value.coefficient < 0n
  const digits = (negative ? -value.coefficient : value.coefficient).toString()
  if (value.scale === 0) return `${negative ? '-' : ''}${digits}`
  const padded = digits.padStart(value.scale + 1, '0')
  const point = padded.length - value.scale
  let result = `${padded.slice(0, point)}.${padded.slice(point)}`.replace(/\.0+$/u, '').replace(/(\.\d*?)0+$/u, '$1')
  if (result.endsWith('.')) result = result.slice(0, -1)
  return `${negative ? '-' : ''}${result}`
}
