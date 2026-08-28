import { randomBytes } from './crypto'

export interface PasswordGeneratorOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

export const DEFAULT_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
}

const CHARSETS = {
  // No ambiguous glyphs (0/O, 1/l/I) — read via the monospace font, but no
  // reason to make it harder than it needs to be for the cases people do type by hand.
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
}

/** Rejection-sampled so every character is uniformly distributed — never `Math.random()`. */
function randomInt(maxExclusive: number): number {
  const range = 256 - (256 % maxExclusive)
  let byte: number
  do {
    byte = randomBytes(1)[0]
  } while (byte >= range)
  return byte % maxExclusive
}

export function generatePassword(options: PasswordGeneratorOptions): string {
  const pools: string[] = []
  if (options.uppercase) pools.push(CHARSETS.uppercase)
  if (options.lowercase) pools.push(CHARSETS.lowercase)
  if (options.numbers) pools.push(CHARSETS.numbers)
  if (options.symbols) pools.push(CHARSETS.symbols)

  if (pools.length === 0) {
    throw new Error('Select at least one character type.')
  }

  const alphabet = pools.join('')
  const length = Math.max(options.length, pools.length)

  let password: string
  do {
    const chars: string[] = []
    for (let i = 0; i < length; i++) {
      chars.push(alphabet[randomInt(alphabet.length)])
    }
    password = chars.join('')
    // Guarantee at least one character from each selected pool, without
    // biasing *which* character within the pool — reroll rather than force-splice.
  } while (!pools.every((pool) => [...password].some((c) => pool.includes(c))))

  return password
}

export function estimatePasswordStrength(password: string): { score: number; label: string } {
  let poolSize = 0
  if (/[a-z]/.test(password)) poolSize += 26
  if (/[A-Z]/.test(password)) poolSize += 26
  if (/[0-9]/.test(password)) poolSize += 10
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32

  const bitsOfEntropy = password.length * Math.log2(Math.max(poolSize, 1))

  if (bitsOfEntropy < 40) return { score: 1, label: 'Weak' }
  if (bitsOfEntropy < 60) return { score: 2, label: 'Fair' }
  if (bitsOfEntropy < 80) return { score: 3, label: 'Good' }
  return { score: 4, label: 'Strong' }
}
