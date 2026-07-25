// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { gameInPhase } from '../../test/fixtures'

vi.mock('motion/react', () => ({
  useReducedMotion: () => true,
  motion: {
    button: forwardRef<
      HTMLButtonElement,
      ButtonHTMLAttributes<HTMLButtonElement> & {
        initial?: unknown
        animate?: unknown
        transition?: unknown
      }
    >(function ReducedButton({ initial, animate: _animate, transition, ...props }, ref) {
      void _animate
      return (
        <button
          ref={ref}
          data-initial={String(initial)}
          data-transition={JSON.stringify(transition)}
          {...props}
        />
      )
    }),
  },
}))

import { CabinetActions } from './CabinetActions'

describe('CabinetActions reduced motion', () => {
  it('deals immediately with tweened selection changes', () => {
    const state = gameInPhase('cabinet', 2)
    render(<CabinetActions state={state} onAction={vi.fn()} />)
    const firstCard = screen.getAllByRole('button', { name: /\./ })[0]
    expect(firstCard).toHaveAttribute('data-initial', 'false')
    expect(firstCard).toHaveAttribute('data-transition', expect.stringContaining('"delay":0'))
    expect(firstCard).toHaveAttribute('data-transition', expect.stringContaining('"type":"tween"'))
  })
})
