// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testGame } from '../../test/fixtures'

const mocks = vi.hoisted(() => ({ webgl: false }))

vi.mock('../../presentation/webgl', () => ({
  supportsWebGL: () => mocks.webgl,
}))

vi.mock('./ThreeTable', () => ({
  default: ({ cameraNonce }: { cameraNonce: number }) => (
    <div data-testid="three-table">camera {cameraNonce}</div>
  ),
}))

import { TableSceneBoundary, TableStage } from './TableStage'

describe('TableStage', () => {
  afterEach(() => {
    mocks.webgl = false
    vi.restoreAllMocks()
  })

  it('renders the accessible treaty map when WebGL is unavailable', () => {
    const state = testGame(2)
    state.countries.tomerin.signed = true
    state.countries.tomerin.underPressure = true
    const onSelect = vi.fn()
    render(
      <TableStage state={state} selectedCountry="aravell" onSelectCountry={onSelect} />,
    )

    expect(screen.getByTestId('table-fallback')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The treaty web' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset view' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /View Tomerin, signed, under pressure/ }))
    expect(onSelect).toHaveBeenCalledWith('tomerin')
  })

  it('loads the physical scene and resets its guided camera', async () => {
    mocks.webgl = true
    render(
      <TableStage state={testGame(2)} selectedCountry="tomerin" onSelectCountry={vi.fn()} />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Unfolding the conference cloth')
    expect(await screen.findByTestId('three-table')).toHaveTextContent('camera 0')
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }))
    await waitFor(() => expect(screen.getByTestId('three-table')).toHaveTextContent('camera 1'))
    expect(screen.getByText('Tomerin', { selector: '.table-selection strong' })).toBeInTheDocument()
  })

  it('replaces a failed scene with its provided fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function BrokenScene(): never {
      throw new Error('gpu unavailable')
    }
    render(
      <TableSceneBoundary fallback={<p>Map fallback</p>}>
        <BrokenScene />
      </TableSceneBoundary>,
    )
    expect(screen.getByText('Map fallback')).toBeInTheDocument()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('physical table'),
      expect.any(Error),
      expect.any(Object),
    )
    error.mockRestore()
  })
})
