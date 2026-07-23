const UINT32 = 0x100000000

export function nextRandom(rngState: number): [number, number] {
  let value = rngState >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  const next = value >>> 0 || 0x6d2b79f5
  return [next / UINT32, next]
}

export function shuffle<T>(values: T[], rngState: number): [T[], number] {
  const shuffled = [...values]
  let rng = rngState
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    let random
    ;[random, rng] = nextRandom(rng)
    const other = Math.floor(random * (index + 1))
    ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
  }
  return [shuffled, rng]
}
