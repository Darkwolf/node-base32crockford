'use strict'
const { TextEncoder, TextDecoder } = require('util')
const {
  ObjectCreate,
  ObjectDefineProperties,
  FunctionPrototypeBind,
  FunctionPrototypeSymbolHasInstance,
  Symbol,
  SymbolToStringTag,
  RangeError,
  SyntaxError,
  TypeError,
  NumberMAX_SAFE_INTEGER,
  NumberMIN_SAFE_INTEGER,
  NumberPrototypeToString,
  BigInt,
  MathFloor,
  MathMax,
  MathMin,
  String,
  StringFromCharCode,
  StringPrototypeCharCodeAt,
  StringPrototypeSafeSymbolIterator,
  Uint8Array,
  PrimitivesIsString,
  InstancesIsUint8Array,
  TypesToIntegerOrInfinity,
  TypesToBigInt,
  TypesToLength
} = require('@darkwolf/primordials')

const textEncoder = new TextEncoder()
const stringToUint8Array = FunctionPrototypeBind(TextEncoder.prototype.encode, textEncoder)

const textDecoder = new TextDecoder()
const uint8ArrayToString = FunctionPrototypeBind(TextDecoder.prototype.decode, textDecoder)

const alphabetSymbol = Symbol('alphabet')
const alphabetLookupSymbol = Symbol('alphabetLookup')
const baseMapSymbol = Symbol('baseMap')
const baseMapLookupSymbol = Symbol('baseMapLookup')
const encodeToStringSymbol = Symbol('encodeToString')
const decodeFromStringSymbol = Symbol('decodeFromString')

const BASE = 32

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const BITS_PER_CHAR = 5

const NEGATIVE_CHAR = '-'

const createAlphabetLookups = alphabet => {
  const lookup = ObjectCreate(null)
  const baseMap = new Uint8Array(BASE)
  const baseMapLookup = ObjectCreate(null)
  for (let i = 0; i < BASE; i++) {
    const char = alphabet[i]
    const charCode = StringPrototypeCharCodeAt(char)
    lookup[char] = i
    baseMap[i] = charCode
    baseMapLookup[charCode] = i
    if (char === '0') {
      lookup['O'] = i
      baseMapLookup[0x4f] = i
      lookup['o'] = i
      baseMapLookup[0x6f] = i
    } else if (char === '1') {
      lookup['I'] = i
      baseMapLookup[0x49] = i
      lookup['i'] = i
      baseMapLookup[0x69] = i
      lookup['L'] = i
      baseMapLookup[0x4c] = i
      lookup['l'] = i
      baseMapLookup[0x6c] = i
    } else if (charCode > 64) {
      const lowerCharCode = charCode + 32
      const lowerChar = StringFromCharCode(lowerCharCode)
      lookup[lowerChar] = i
      baseMapLookup[lowerCharCode] = i
    }
  }
  return {
    lookup,
    baseMap,
    baseMapLookup
  }
}

const isAlphabet = value => {
  if (!PrimitivesIsString(value) || value.length !== BASE) {
    return false
  }
  const alphabetLookup = base32Crockford[alphabetLookupSymbol]
  const uniqueCharsLookup = ObjectCreate(null)
  for (let i = 0; i < BASE; i++) {
    const char = value[i]
    if (alphabetLookup[char] === undefined || uniqueCharsLookup[char] !== undefined) {
      return false
    }
    uniqueCharsLookup[char] = i
  }
  return true
}

const toAlphabet = value => {
  if (value === undefined) {
    return ALPHABET
  }
  if (!PrimitivesIsString(value)) {
    throw new TypeError('The alphabet must be a string')
  }
  if (value.length !== BASE) {
    throw new RangeError('The length of the alphabet must be equal to 32')
  }
  const alphabetLookup = base32Crockford[alphabetLookupSymbol]
  const uniqueCharsLookup = ObjectCreate(null)
  for (let i = 0; i < BASE; i++) {
    const char = value[i]
    if (alphabetLookup[char] === undefined) {
      throw new SyntaxError(`Invalid character "${char}" at index ${i} for the Crockford's Base32 alphabet`)
    }
    if (uniqueCharsLookup[char] !== undefined) {
      throw new SyntaxError(`The character "${char}" at index ${i} is already in the alphabet`)
    }
    uniqueCharsLookup[char] = i
  }
  return value
}

const isBase32CrockfordString = value => {
  if (!PrimitivesIsString(value)) {
    return false
  }
  const alphabetLookup = base32Crockford[alphabetLookupSymbol]
  for (const char of StringPrototypeSafeSymbolIterator(value)) {
    if (alphabetLookup[char] === undefined) {
      return false
    }
  }
  return true
}

class Base32Crockford {
  constructor(alphabet) {
    alphabet = toAlphabet(alphabet)
    const lookups = createAlphabetLookups(alphabet)
    this[alphabetSymbol] = alphabet
    this[alphabetLookupSymbol] = lookups.lookup
    this[baseMapSymbol] = lookups.baseMap
    this[baseMapLookupSymbol] = lookups.baseMapLookup
  }

  get alphabet() {
    return this[alphabetSymbol]
  }

  encodeInt(value) {
    let number = TypesToIntegerOrInfinity(value)
    if (number < NumberMIN_SAFE_INTEGER) {
      throw new RangeError('The value must be greater than or equal to the minimum safe integer')
    } else if (number > NumberMAX_SAFE_INTEGER) {
      throw new RangeError('The value must be less than or equal to the maximum safe integer')
    }
    const alphabet = this[alphabetSymbol]
    if (!number) {
      return alphabet[0]
    }
    const isNegative = number < 0
    if (isNegative) {
      number = -number
    }
    let result = ''
    while (number) {
      result = `${alphabet[number % BASE]}${result}`
      number = MathFloor(number / BASE)
    }
    return isNegative ? `${NEGATIVE_CHAR}${result}` : result
  }

  decodeInt(string) {
    string = String(string)
    const alphabetLookup = this[alphabetLookupSymbol]
    const {length} = string
    const isNegative = string[0] === NEGATIVE_CHAR
    let result = 0
    for (let i = isNegative && length > 1 ? 1 : 0; i < length; i++) {
      const char = string[i]
      const index = alphabetLookup[char]
      if (index === undefined) {
        throw new SyntaxError(`Invalid character "${char}" at index ${i} for Crockford's Base32 encoding`)
      }
      result = result * BASE + index
    }
    return isNegative && result > 0 ? -result : result
  }

  encodeBigInt(value) {
    let bigInt = TypesToBigInt(value)
    const alphabet = this[alphabetSymbol]
    if (!bigInt) {
      return alphabet[0]
    }
    const isNegative = bigInt < 0n
    if (isNegative) {
      bigInt = -bigInt
    }
    let result = ''
    while (bigInt) {
      result = `${alphabet[bigInt % 32n]}${result}`
      bigInt /= 32n
    }
    return isNegative ? `${NEGATIVE_CHAR}${result}` : result
  }

  decodeBigInt(string) {
    string = String(string)
    const alphabetLookup = this[alphabetLookupSymbol]
    const {length} = string
    const isNegative = string[0] === NEGATIVE_CHAR
    let result = 0n
    for (let i = isNegative && length > 1 ? 1 : 0; i < length; i++) {
      const char = string[i]
      const index = alphabetLookup[char]
      if (index === undefined) {
        throw new SyntaxError(`Invalid character "${char}" at index ${i} for Crockford's Base32 encoding`)
      }
      result = result * 32n + BigInt(index)
    }
    return isNegative ? -result : result
  }

  [encodeToStringSymbol](input, start, end) {
    const alphabet = this[alphabetSymbol]
    const length = TypesToLength(input.length)
    let startIndex = 0
    let endIndex = length
    if (start !== undefined) {
      start = TypesToIntegerOrInfinity(start)
      startIndex = start < 0 ? MathMax(0, length + start) : MathMin(start, length)
    }
    if (end !== undefined) {
      end = TypesToIntegerOrInfinity(end)
      endIndex = end < 0 ? MathMax(0, length + end) : MathMin(end, length)
    }
    let result = ''
    let shift = 3
    let carry = 0
    for (let i = startIndex; i < endIndex; i++) {
      const byte = input[i]
      const number = carry | (byte >> shift)
      result += alphabet[number & 0x1f]
      if (shift > BITS_PER_CHAR) {
        shift -= BITS_PER_CHAR
        const number = byte >> shift
        result += alphabet[number & 0x1f]
      }
      shift = BITS_PER_CHAR - shift
      carry = byte << shift
      shift = 8 - shift
    }
    if (shift !== 3) {
      result += alphabet[carry & 0x1f]
    }
    return result
  }

  [decodeFromStringSymbol](string, start, end) {
    const alphabetLookup = this[alphabetLookupSymbol]
    const {length} = string
    let startIndex = 0
    let endIndex = length
    if (start !== undefined) {
      start = TypesToIntegerOrInfinity(start)
      startIndex = start < 0 ? MathMax(0, length + start) : MathMin(start, length)
    }
    if (end !== undefined) {
      end = TypesToIntegerOrInfinity(end)
      endIndex = end < 0 ? MathMax(0, length + end) : MathMin(end, length)
    }
    const newLength = MathMax(0, endIndex - startIndex)
    const result = new Uint8Array(newLength * BITS_PER_CHAR / 8)
    let shift = 8
    let carry = 0
    let index = 0
    for (let i = startIndex; i < endIndex; i++) {
      const char = string[i]
      const charIndex = alphabetLookup[char]
      if (charIndex === undefined) {
        throw new SyntaxError(`Invalid character "${char}" at index ${i} for Crockford's Base32 encoding`)
      }
      const number = charIndex & 0xff
      shift -= BITS_PER_CHAR
      if (shift > 0) {
        carry |= number << shift
      } else if (shift < 0) {
        result[index++] = carry | (number >> -shift)
        shift += 8
        carry = (number << shift) & 0xff
      } else {
        result[index++] = carry | number
        shift = 8
        carry = 0
      }
    }
    if (shift !== 8 && carry !== 0) {
      result[index] = carry
    }
    return result
  }

  encodeText(string, start, end) {
    return this[encodeToStringSymbol](stringToUint8Array(String(string)), start, end)
  }

  decodeText(string, start, end) {
    return uint8ArrayToString(this[decodeFromStringSymbol](String(string), start, end))
  }

  encode(input, start, end) {
    if (!InstancesIsUint8Array(input)) {
      throw new TypeError('The input must be an instance of Uint8Array')
    }
    const baseMap = this[baseMapSymbol]
    const length = TypesToLength(input.length)
    let startIndex = 0
    let endIndex = length
    if (start !== undefined) {
      start = TypesToIntegerOrInfinity(start)
      startIndex = start < 0 ? MathMax(0, length + start) : MathMin(start, length)
    }
    if (end !== undefined) {
      end = TypesToIntegerOrInfinity(end)
      endIndex = end < 0 ? MathMax(0, length + end) : MathMin(end, length)
    }
    const newLength = MathMax(0, endIndex - startIndex)
    const result = new Uint8Array((newLength * 8 + 4) / BITS_PER_CHAR)
    let shift = 3
    let carry = 0
    let index = 0
    for (let i = startIndex; i < endIndex; i++) {
      const byte = input[i]
      const number = carry | (byte >> shift)
      result[index++] = baseMap[number & 0x1f]
      if (shift > BITS_PER_CHAR) {
        shift -= BITS_PER_CHAR
        const number = byte >> shift
        result[index++] = baseMap[number & 0x1f]
      }
      shift = BITS_PER_CHAR - shift
      carry = byte << shift
      shift = 8 - shift
    }
    if (shift !== 3) {
      result[index++] = baseMap[carry & 0x1f]
    }
    return result
  }

  decode(input, start, end) {
    if (!InstancesIsUint8Array(input)) {
      throw new TypeError('The input must be an instance of Uint8Array')
    }
    const baseMapLookup = this[baseMapLookupSymbol]
    const length = TypesToLength(input.length)
    let startIndex = 0
    let endIndex = length
    if (start !== undefined) {
      start = TypesToIntegerOrInfinity(start)
      startIndex = start < 0 ? MathMax(0, length + start) : MathMin(start, length)
    }
    if (end !== undefined) {
      end = TypesToIntegerOrInfinity(end)
      endIndex = end < 0 ? MathMax(0, length + end) : MathMin(end, length)
    }
    const newLength = MathMax(0, endIndex - startIndex)
    const result = new Uint8Array(newLength * BITS_PER_CHAR / 8)
    let shift = 8
    let carry = 0
    let index = 0
    for (let i = startIndex; i < endIndex; i++) {
      const charCode = input[i]
      const charIndex = baseMapLookup[charCode]
      if (charIndex === undefined) {
        throw new SyntaxError(`Invalid byte "${NumberPrototypeToString(charCode, 16)}" at index ${i} for Crockford's Base32 encoding`)
      }
      const number = charIndex & 0xff
      shift -= BITS_PER_CHAR
      if (shift > 0) {
        carry |= number << shift
      } else if (shift < 0) {
        result[index++] = carry | (number >> -shift)
        shift += 8
        carry = (number << shift) & 0xff
      } else {
        result[index++] = carry | number
        shift = 8
        carry = 0
      }
    }
    if (shift !== 8 && carry !== 0) {
      result[index] = carry
    }
    return result
  }

  encodeToString(input, start, end) {
    if (!InstancesIsUint8Array(input)) {
      throw new TypeError('The input must be an instance of Uint8Array')
    }
    return this[encodeToStringSymbol](input, start, end)
  }

  decodeFromString(input, start, end) {
    if (!PrimitivesIsString(input)) {
      throw new TypeError('The input must be a string')
    }
    return this[decodeFromStringSymbol](input, start, end)
  }
}

const isBase32Crockford = FunctionPrototypeBind(FunctionPrototypeSymbolHasInstance, null, Base32Crockford)

const base32Crockford = new Base32Crockford()
const encodeInt = FunctionPrototypeBind(Base32Crockford.prototype.encodeInt, base32Crockford)
const decodeInt = FunctionPrototypeBind(Base32Crockford.prototype.decodeInt, base32Crockford)
const encodeBigInt = FunctionPrototypeBind(Base32Crockford.prototype.encodeBigInt, base32Crockford)
const decodeBigInt = FunctionPrototypeBind(Base32Crockford.prototype.decodeBigInt, base32Crockford)
const encodeText = FunctionPrototypeBind(Base32Crockford.prototype.encodeText, base32Crockford)
const decodeText = FunctionPrototypeBind(Base32Crockford.prototype.decodeText, base32Crockford)
const encode = FunctionPrototypeBind(Base32Crockford.prototype.encode, base32Crockford)
const decode = FunctionPrototypeBind(Base32Crockford.prototype.decode, base32Crockford)
const encodeToString = FunctionPrototypeBind(Base32Crockford.prototype.encodeToString, base32Crockford)
const decodeFromString = FunctionPrototypeBind(Base32Crockford.prototype.decodeFromString, base32Crockford)

ObjectDefineProperties(Base32Crockford, {
  BASE: {
    value: BASE
  },
  ALPHABET: {
    value: ALPHABET
  },
  BITS_PER_CHAR: {
    value: BITS_PER_CHAR
  },
  NEGATIVE_CHAR: {
    value: NEGATIVE_CHAR
  },
  isBase32Crockford: {
    value: isBase32Crockford
  },
  isAlphabet: {
    value: isAlphabet
  },
  isBase32CrockfordString: {
    value: isBase32CrockfordString
  },
  encodeInt: {
    value: encodeInt
  },
  decodeInt: {
    value: decodeInt
  },
  encodeBigInt: {
    value: encodeBigInt
  },
  decodeBigInt: {
    value: decodeBigInt
  },
  encodeText: {
    value: encodeText
  },
  decodeText: {
    value: decodeText
  },
  encode: {
    value: encode
  },
  decode: {
    value: decode
  },
  encodeToString: {
    value: encodeToString
  },
  decodeFromString: {
    value: decodeFromString
  }
})
ObjectDefineProperties(Base32Crockford.prototype, {
  [SymbolToStringTag]: {
    value: 'Base32Crockford'
  }
})

module.exports = Base32Crockford
