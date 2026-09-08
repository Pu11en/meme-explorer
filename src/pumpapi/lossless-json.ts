export type LosslessJson = null | boolean | string | LosslessJson[] | { readonly [key: string]: LosslessJson }

export function parseLosslessJson(input: string): LosslessJson {
  let offset = 0

  const whitespace = (): void => {
    while (/\s/u.test(input[offset] ?? '')) offset += 1
  }

  const fail = (message: string): never => {
    throw new SyntaxError(`${message} at byte ${offset}`)
  }

  const parseString = (): string => {
    const start = offset
    offset += 1
    let escaped = false
    while (offset < input.length) {
      const character = input[offset]
      if (!escaped && character === '"') {
        offset += 1
        return JSON.parse(input.slice(start, offset)) as string
      }
      if (!escaped && character === '\\') escaped = true
      else escaped = false
      offset += 1
    }
    return fail('unterminated string')
  }

  const parseNumber = (): string => {
    const rest = input.slice(offset)
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(rest)
    if (match === null) return fail('invalid number')
    offset += match[0].length
    return match[0]
  }

  const parseArray = (): LosslessJson[] => {
    offset += 1
    whitespace()
    const values: LosslessJson[] = []
    if (input[offset] === ']') {
      offset += 1
      return values
    }
    while (true) {
      values.push(parseValue())
      whitespace()
      if (input[offset] === ']') {
        offset += 1
        return values
      }
      if (input[offset] !== ',') return fail('expected comma or closing bracket')
      offset += 1
      whitespace()
    }
  }

  const parseObject = (): { readonly [key: string]: LosslessJson } => {
    offset += 1
    whitespace()
    const value: Record<string, LosslessJson> = {}
    if (input[offset] === '}') {
      offset += 1
      return value
    }
    while (true) {
      if (input[offset] !== '"') return fail('expected object key')
      const key = parseString()
      whitespace()
      if (input[offset] !== ':') return fail('expected colon')
      offset += 1
      whitespace()
      value[key] = parseValue()
      whitespace()
      if (input[offset] === '}') {
        offset += 1
        return value
      }
      if (input[offset] !== ',') return fail('expected comma or closing brace')
      offset += 1
      whitespace()
    }
  }

  const parseValue = (): LosslessJson => {
    whitespace()
    const character = input[offset]
    if (character === '"') return parseString()
    if (character === '{') return parseObject()
    if (character === '[') return parseArray()
    if (input.startsWith('true', offset)) {
      offset += 4
      return true
    }
    if (input.startsWith('false', offset)) {
      offset += 5
      return false
    }
    if (input.startsWith('null', offset)) {
      offset += 4
      return null
    }
    if (character === '-' || (character !== undefined && /\d/u.test(character))) return parseNumber()
    return fail('unexpected token')
  }

  const value = parseValue()
  whitespace()
  if (offset !== input.length) fail('trailing input')
  return value
}
