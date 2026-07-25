import { getTrust } from '../game/engine'
import type { CountryId, GameState } from '../game/types'

export type TablePoint = [x: number, y: number, z: number]

export type TableSeat = {
  countryId: CountryId
  angle: number
  position: TablePoint
  rotation: number
  active: boolean
  signed: boolean
  pressured: boolean
  resourceTotal: number
}

export type TrustCord = {
  id: string
  first: CountryId
  second: CountryId
  start: TablePoint
  end: TablePoint
  trust: number
}

export type ProposalTile = {
  countryId: CountryId
  position: TablePoint
}

export type TableViewModel = {
  seats: TableSeat[]
  cords: TrustCord[]
  proposals: ProposalTile[]
  signedCount: number
  commitmentTotal: number
}

export function buildTableViewModel(state: GameState): TableViewModel {
  const radiusX = state.playerCount === 2 ? 4.8 : 5.35
  const radiusZ = state.playerCount === 2 ? 2.4 : 3.25
  const seats = state.countryOrder.map((countryId, index): TableSeat => {
    const angle =
      state.playerCount === 2
        ? Math.PI / 2 + index * Math.PI
        : Math.PI / 2 + (index * Math.PI * 2) / state.playerCount
    const country = state.countries[countryId]
    return {
      countryId,
      angle,
      position: [Math.cos(angle) * radiusX, 0.38, Math.sin(angle) * radiusZ],
      rotation: Math.PI / 2 - angle,
      active:
        state.activeCountry === countryId &&
        (state.phase === 'cabinet' || state.phase === 'crisis' || state.phase === 'summit'),
      signed: country.signed,
      pressured: country.underPressure,
      resourceTotal: Object.values(country.resources).reduce((total, value) => total + value, 0),
    }
  })

  const byCountry = Object.fromEntries(seats.map((seat) => [seat.countryId, seat])) as Record<
    CountryId,
    TableSeat
  >
  const cords: TrustCord[] = []
  for (let firstIndex = 0; firstIndex < state.countryOrder.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < state.countryOrder.length; secondIndex += 1) {
      const first = state.countryOrder[firstIndex]
      const second = state.countryOrder[secondIndex]
      cords.push({
        id: `${first}-${second}`,
        first,
        second,
        start: byCountry[first].position,
        end: byCountry[second].position,
        trust: getTrust(state, first, second),
      })
    }
  }

  const proposals = state.countryOrder
    .filter((countryId) => Boolean(state.summitOffers[countryId]))
    .map((countryId): ProposalTile => {
      const seat = byCountry[countryId]
      return {
        countryId,
        position: [seat.position[0] * 0.58, 0.48, seat.position[2] * 0.58],
      }
    })

  const commitmentTotal = Object.values(state.commitments).reduce(
    (grandTotal, commitment) =>
      grandTotal +
      Object.values(commitment ?? {}).reduce((total, value) => total + (value ?? 0), 0),
    0,
  )

  return {
    seats,
    cords,
    proposals,
    signedCount: seats.filter((seat) => seat.signed).length,
    commitmentTotal,
  }
}
