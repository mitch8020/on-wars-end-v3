import { describe, expect, it } from 'vitest'
import { testGame } from '../test/fixtures'
import { buildTableViewModel } from './tableViewModel'

describe('buildTableViewModel', () => {
  it('maps two countries, trust, signatures, resources, commitments, and proposals', () => {
    const state = testGame(2)
    state.phase = 'cabinet'
    state.activeCountry = 'aravell'
    state.countries.aravell.signed = true
    state.countries.tomerin.underPressure = true
    state.commitments.aravell = { food: 2, military: 1 }
    state.commitments.tomerin = undefined
    state.commitments.veyra = { fuel: undefined }
    state.summitOffers.tomerin = { country: 'tomerin', give: 'fuel', want: 'food' }

    const model = buildTableViewModel(state)

    expect(model.seats).toHaveLength(2)
    expect(model.seats[0]).toMatchObject({
      countryId: 'aravell',
      active: true,
      signed: true,
      pressured: false,
      resourceTotal: 11,
    })
    expect(model.seats[1].position[2]).toBeLessThan(0)
    expect(model.cords).toEqual([
      expect.objectContaining({ id: 'aravell-tomerin', trust: 1 }),
    ])
    expect(model.proposals).toEqual([
      expect.objectContaining({ countryId: 'tomerin' }),
    ])
    expect(model.signedCount).toBe(1)
    expect(model.commitmentTotal).toBe(3)
  })

  it('spaces six seats and creates every pairwise cord', () => {
    const state = testGame(6)
    const model = buildTableViewModel(state)

    expect(model.seats).toHaveLength(6)
    expect(model.cords).toHaveLength(15)
    expect(new Set(model.seats.map((seat) => seat.position.join(','))).size).toBe(6)
    expect(model.proposals).toEqual([])
    expect(model.commitmentTotal).toBe(0)
  })
})
