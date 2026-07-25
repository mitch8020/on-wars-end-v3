// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { supportsWebGL } from './webgl'

describe('supportsWebGL in a browser', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'WebGLRenderingContext')
  })

  it('returns false when the browser has no WebGL API', () => {
    expect(supportsWebGL()).toBe(false)
  })

  it('accepts WebGL2 and falls back to WebGL1', () => {
    Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: class {} })
    const getContext = vi.fn().mockReturnValueOnce({ kind: 'webgl2' })
    vi.spyOn(document, 'createElement').mockReturnValueOnce({ getContext } as unknown as HTMLCanvasElement)
    expect(supportsWebGL()).toBe(true)
    expect(getContext).toHaveBeenCalledWith('webgl2')

    const fallbackContext = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce({ kind: 'webgl' })
    vi.spyOn(document, 'createElement').mockReturnValueOnce({
      getContext: fallbackContext,
    } as unknown as HTMLCanvasElement)
    expect(supportsWebGL()).toBe(true)
    expect(fallbackContext).toHaveBeenLastCalledWith('webgl')
  })

  it('returns false when context creation fails or throws', () => {
    Object.defineProperty(window, 'WebGLRenderingContext', { configurable: true, value: class {} })
    vi.spyOn(document, 'createElement').mockReturnValueOnce({
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement)
    expect(supportsWebGL()).toBe(false)

    vi.spyOn(document, 'createElement').mockImplementationOnce(() => {
      throw new Error('blocked')
    })
    expect(supportsWebGL()).toBe(false)
  })
})
