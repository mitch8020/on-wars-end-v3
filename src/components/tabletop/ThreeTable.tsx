import { ContactShadows, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  LinearFilter,
  MathUtils,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { COUNTRY_DEFINITIONS, getCrisis } from '../../game/data'
import type { CountryId, GamePhase, GameState, Resource } from '../../game/types'
import { buildTableViewModel, type TablePoint, type TrustCord } from '../../presentation/tableViewModel'

type ThreeTableProps = {
  state: GameState
  cameraNonce: number
  onSelectCountry: (countryId: CountryId) => void
}

const RESOURCE_COLORS: Record<Resource, string> = {
  food: '#d6b447',
  industry: '#7e9da6',
  fuel: '#9a79ad',
  capital: '#cfad56',
}

function labelTexture(
  title: string,
  subtitle: string,
  accent: string,
  background = '#102825',
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return new CanvasTexture(canvas)
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = accent
  context.lineWidth = 9
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24)
  context.fillStyle = accent
  context.font = '600 76px Georgia'
  context.textAlign = 'center'
  context.fillText(title, 256, 116)
  context.fillStyle = '#e7d8b8'
  context.font = '500 27px Arial'
  context.letterSpacing = '5px'
  context.fillText(subtitle.toUpperCase(), 256, 175)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  return texture
}

function CameraRig({ phase, activeSeat, nonce }: { phase: GamePhase; activeSeat?: TablePoint; nonce: number }) {
  const camera = useThree((context) => context.camera)
  const desired = useRef(new Vector3(0, 9.7, 10.9))
  const target = useRef(new Vector3(0, 0.2, 0))
  const motion = useRef(1)

  useEffect(() => {
    const seatX = activeSeat?.[0] ?? 0
    const seatZ = activeSeat?.[2] ?? 0
    if (phase === 'briefing') {
      desired.current.set(-2.4, 8.4, 9.5)
      target.current.set(-1.7, 0.25, -0.1)
    } else if (phase === 'cabinet') {
      desired.current.set(seatX * 0.18, 8.2, 9.8 + seatZ * 0.12)
      target.current.set(seatX * 0.22, 0.3, seatZ * 0.2)
    } else if (phase === 'crisis') {
      desired.current.set(-1.8, 8.1, 9.2)
      target.current.set(-1.6, 0.25, 0)
    } else if (phase === 'summit') {
      desired.current.set(0, 7.4, 8.9)
      target.current.set(0, 0.35, 0)
    } else {
      desired.current.set(0, 9.7, 10.9)
      target.current.set(0, 0.2, 0)
    }
    motion.current = 1
  }, [activeSeat, nonce, phase])

  useFrame((_, delta) => {
    if (motion.current <= 0.002) return
    const amount = 1 - Math.exp(-delta * 4.2)
    camera.position.lerp(desired.current, amount)
    camera.lookAt(target.current)
    motion.current = MathUtils.lerp(motion.current, 0, amount)
  })

  return null
}

function TrustLine({ cord }: { cord: TrustCord }) {
  const points = useMemo(() => {
    const result: TablePoint[] = []
    for (let index = 0; index <= 12; index += 1) {
      const amount = index / 12
      result.push([
        MathUtils.lerp(cord.start[0], cord.end[0], amount),
        0.55 + Math.sin(Math.PI * amount) * (0.05 + cord.trust * 0.045),
        MathUtils.lerp(cord.start[2], cord.end[2], amount),
      ])
    }
    return result
  }, [cord])
  const strong = cord.trust >= 2
  return (
    <Line
      points={points}
      color={strong ? '#9bc2a6' : '#b66a55'}
      lineWidth={0.55 + cord.trust * 0.5}
      transparent
      opacity={0.18 + cord.trust * 0.17}
      dashed={!strong}
      dashSize={0.12}
      gapSize={0.09}
    />
  )
}

function CountrySeat({
  state,
  countryId,
  position,
  rotation,
  active,
  signed,
  pressured,
  onSelect,
}: {
  state: GameState
  countryId: CountryId
  position: TablePoint
  rotation: number
  active: boolean
  signed: boolean
  pressured: boolean
  onSelect: () => void
}) {
  const definition = COUNTRY_DEFINITIONS[countryId]
  const country = state.countries[countryId]
  const texture = useMemo(
    () => labelTexture(definition.monogram, definition.name, definition.color),
    [definition],
  )
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={position} rotation={[0, rotation, 0]} onClick={onSelect}>
      <RoundedBox args={[2.25, 0.14, 1.16]} radius={0.08} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#112b28" roughness={0.82} metalness={0.06} />
      </RoundedBox>
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.06, 0.98]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>

      {Object.entries(country.resources).map(([resource, value], index) => (
        <mesh
          key={resource}
          position={[-0.72 + index * 0.48, 0.23 + Math.min(value, 8) * 0.018, 0.64]}
          castShadow
        >
          <boxGeometry args={[0.24, 0.18 + Math.min(value, 8) * 0.035, 0.24]} />
          <meshStandardMaterial
            color={RESOURCE_COLORS[resource as Resource]}
            roughness={0.55}
            metalness={resource === 'capital' ? 0.28 : 0.04}
          />
        </mesh>
      ))}

      <mesh position={[-0.73, 0.2, -0.66]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.14, 24]} />
        <meshStandardMaterial color="#b9c0a5" roughness={0.68} />
      </mesh>
      <mesh position={[0.73, 0.2, -0.66]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.14, 24]} />
        <meshStandardMaterial color="#657879" roughness={0.64} />
      </mesh>

      {active && (
        <mesh position={[0, 0.12, 0]}>
          <ringGeometry args={[1.23, 1.29, 64]} />
          <meshBasicMaterial color={definition.color} transparent opacity={0.9} />
        </mesh>
      )}
      {signed && (
        <mesh position={[0.82, 0.19, -0.38]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.24, 0.09, 32]} />
          <meshStandardMaterial color="#c9a65b" metalness={0.72} roughness={0.28} />
        </mesh>
      )}
      {pressured && (
        <mesh position={[-0.84, 0.19, -0.4]}>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshStandardMaterial color="#c55343" emissive="#7a1f16" emissiveIntensity={1.1} />
        </mesh>
      )}
    </group>
  )
}

function TableTrack({
  position,
  value,
  color,
}: {
  position: TablePoint
  value: number
  color: string
}) {
  const markerX = -0.62 + Math.min(10, Math.max(0, value)) * 0.124
  return (
    <group position={position}>
      <RoundedBox args={[1.55, 0.08, 0.22]} radius={0.06} smoothness={3} receiveShadow>
        <meshStandardMaterial color="#223b35" roughness={0.78} />
      </RoundedBox>
      <mesh position={[markerX, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.09, 24]} />
        <meshStandardMaterial color={color} metalness={0.32} roughness={0.36} />
      </mesh>
    </group>
  )
}

function Accord({ state }: { state: GameState }) {
  const texture = useMemo(
    () =>
      labelTexture(
        `${state.countries[state.firstPlayer].signed ? '✦' : 'III'}`,
        `${state.countryOrder.filter((country) => state.countries[country].signed).length}/${state.playerCount} signatures`,
        '#c9a65b',
        '#193a34',
      ),
    [state],
  )
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={[0, 0.43, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[1.34, 1.42, 0.11, 72]} />
        <meshStandardMaterial color="#c9a65b" metalness={0.6} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.22, 72]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.93, 1.01, 64, 1, 0, Math.PI * 2 * (state.peaceMomentum / 10)]} />
        <meshStandardMaterial
          color={state.peaceMomentum >= 6 ? '#a9cfaf' : '#d1b46d'}
          emissive={state.peaceMomentum >= 6 ? '#365f43' : '#3d321b'}
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  )
}

function CardStack({
  position,
  rotation,
  accent,
  count = 5,
}: {
  position: TablePoint
  rotation: number
  accent: string
  count?: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: count }, (_, index) => (
        <RoundedBox
          key={index}
          args={[1.02, 0.035, 1.46]}
          radius={0.04}
          smoothness={2}
          position={[index * 0.012, index * 0.038, -index * 0.008]}
          castShadow
        >
          <meshStandardMaterial
            color={index === count - 1 ? accent : '#d9c9a8'}
            roughness={0.88}
          />
        </RoundedBox>
      ))}
    </group>
  )
}

function Scene({
  state,
  cameraNonce,
  onSelectCountry,
}: ThreeTableProps) {
  const model = useMemo(() => buildTableViewModel(state), [state])
  const activeSeat = model.seats.find((seat) => seat.active)?.position
  const crisis = getCrisis(state.currentCrisisId)
  const crisisTexture = useMemo(
    () => labelTexture(`R${state.round}`, crisis.title, '#c55343', '#252821'),
    [crisis.title, state.round],
  )
  useEffect(() => () => crisisTexture.dispose(), [crisisTexture])

  return (
    <>
      <color attach="background" args={['#071d1b']} />
      <fog attach="fog" args={['#071d1b', 13, 23]} />
      <ambientLight intensity={0.58} color="#6ca69a" />
      <directionalLight
        castShadow
        position={[-4, 11, 7]}
        intensity={2.2}
        color="#ffe1a1"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[5, 5, -3]} intensity={16} distance={13} color="#c9a65b" />

      <mesh position={[0, -0.58, 0]} scale={[1, 1, 0.69]} receiveShadow>
        <cylinderGeometry args={[8.2, 8.35, 0.78, 96]} />
        <meshStandardMaterial color="#45271d" roughness={0.7} metalness={0.03} />
      </mesh>
      <mesh position={[0, -0.16, 0]} scale={[1, 1, 0.68]} receiveShadow>
        <cylinderGeometry args={[7.48, 7.55, 0.22, 96]} />
        <meshStandardMaterial color="#b99f70" roughness={0.75} metalness={0.08} />
      </mesh>
      <mesh position={[0, -0.02, 0]} scale={[1, 1, 0.67]} receiveShadow>
        <cylinderGeometry args={[7.18, 7.24, 0.2, 96]} />
        <meshStandardMaterial color="#153a34" roughness={0.93} />
      </mesh>

      {model.cords.map((cord) => (
        <TrustLine key={cord.id} cord={cord} />
      ))}
      <Accord state={state} />

      <TableTrack position={[-2.15, 0.32, -1.15]} value={state.peaceMomentum} color="#8cb99a" />
      <TableTrack position={[0, 0.32, -1.58]} value={state.globalUnrest} color="#c55343" />
      <TableTrack
        position={[2.15, 0.32, -1.15]}
        value={(state.refugeePool / (5 * state.playerCount)) * 10}
        color="#d0af5e"
      />

      <group position={[-4.65, 0.65, 0]} rotation={[-0.22, 0.18, -0.04]}>
        <RoundedBox args={[1.48, 0.09, 2.08]} radius={0.06} smoothness={3} castShadow>
          <meshBasicMaterial map={crisisTexture} toneMapped={false} />
        </RoundedBox>
        {model.commitmentTotal > 0 && (
          <mesh position={[0.55, 0.12, -0.78]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.23, 0.25, 0.08, 32]} />
            <meshStandardMaterial color="#6ca69a" metalness={0.3} roughness={0.5} />
          </mesh>
        )}
      </group>
      <CardStack position={[5.68, 0.2, -0.55]} rotation={-0.14} accent="#193f39" />
      <CardStack position={[5.72, 0.2, 1.25]} rotation={0.1} accent="#6f382d" count={3} />

      {model.proposals.map((proposal) => (
        <RoundedBox
          key={proposal.countryId}
          args={[0.78, 0.06, 0.52]}
          radius={0.05}
          smoothness={2}
          position={proposal.position}
          castShadow
        >
          <meshStandardMaterial color="#e7d8b8" roughness={0.8} />
        </RoundedBox>
      ))}

      {model.seats.map((seat) => (
        <CountrySeat
          key={seat.countryId}
          state={state}
          countryId={seat.countryId}
          position={seat.position}
          rotation={seat.rotation}
          active={seat.active}
          signed={seat.signed}
          pressured={seat.pressured}
          onSelect={() => onSelectCountry(seat.countryId)}
        />
      ))}

      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.42}
        scale={16}
        blur={2.5}
        far={5}
        color="#020b09"
      />
      <CameraRig phase={state.phase} activeSeat={activeSeat} nonce={cameraNonce} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={8}
        maxDistance={15}
        minPolarAngle={0.55}
        maxPolarAngle={1.05}
        target={[0, 0.25, 0]}
      />
    </>
  )
}

export default function ThreeTable(props: ThreeTableProps) {
  return (
    <Canvas
      className="three-table-canvas"
      shadows="basic"
      dpr={[1, 1.5]}
      camera={{ fov: 39, near: 0.1, far: 40, position: [0, 9.7, 10.9] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <Scene {...props} />
    </Canvas>
  )
}
