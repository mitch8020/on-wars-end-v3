// @vitest-environment jsdom

import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('application entrypoint', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
    document.body.innerHTML = '<div id="root"></div>'
  })

  it('mounts the application into the root element', async () => {
    await import('./main')
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Convene the peace table' })).toBeInTheDocument()
    })
  })
})
