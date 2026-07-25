import { describe, expect, it } from 'vitest'
import { supportsWebGL } from './webgl'

describe('supportsWebGL outside a browser', () => {
  it('returns false without a window', () => {
    expect(supportsWebGL()).toBe(false)
  })
})
