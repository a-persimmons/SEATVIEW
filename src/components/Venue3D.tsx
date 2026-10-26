import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SECTIONS, STAND_TIERS, VENUE, getViewEstimate, type SeatPosition } from '../data'

type Props = {
  selectedId: string
  activePrice: number | null
  immersive: boolean
  seatPosition: SeatPosition
  autoRotate: boolean
  resetKey: number
  zoom: number
  captureSignal: number
  onSelect: (id: string) => void
  onCapture: (image: string) => void
}

type SceneApi = {
  select: (id: string, moveCamera?: boolean) => void
  filter: (price: number | null) => void
  overview: () => void
  seatView: (position: SeatPosition) => void
  setAutoRotate: (value: boolean) => void
  setZoom: (value: number) => void
  capture: () => void
}

type SeatInstance = {
  sectionId: string
  kind: 'field' | 'stand'
  x: number
  y: number
  z: number
  angle: number
}

function makeScreenTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 384
  const context = canvas.getContext('2d')!
  context.fillStyle = '#06111d'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const gradient = context.createRadialGradient(512, 180, 10, 512, 180, 480)
  gradient.addColorStop(0, '#174b63')
  gradient.addColorStop(1, '#07121e')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#27677a'
  context.lineWidth = 2
  for (let x = 0; x < canvas.width; x += 64) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke()
  }
  context.fillStyle = '#e2fcff'
  context.textAlign = 'center'
  context.font = '700 94px Arial, sans-serif'
  context.fillText('ENDLESS', 512, 168)
  context.fillStyle = '#5de7f5'
  context.font = '500 43px Arial, sans-serif'
  context.fillText('POSSIBILITY', 512, 250)
  context.fillStyle = '#9bb4bf'
  context.font = '24px sans-serif'
  context.fillText('SUPER CONCERT · 2026', 512, 310)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function seededRandom(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function capsuleShape(radius: number, straight: number) {
  const shape = new THREE.Shape()
  shape.moveTo(radius, -straight / 2)
  shape.lineTo(radius, straight / 2)
  shape.absarc(0, straight / 2, radius, 0, Math.PI, false)
  shape.lineTo(-radius, -straight / 2)
  shape.absarc(0, -straight / 2, radius, Math.PI, Math.PI * 2, false)
  return shape
}

function capsuleMesh(radius: number, straight: number, color: string, y: number) {
  const geometry = new THREE.ShapeGeometry(capsuleShape(radius, straight), 64)
  geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0.02 }))
  mesh.position.y = y
  mesh.receiveShadow = true
  return mesh
}

function wedgeGeometry(section: (typeof SECTIONS)[number]) {
  const config = STAND_TIERS[section.tier || 0]
  const a0 = section.angle! - section.span! / 2
  const a1 = section.angle! + section.span! / 2
  const point = (rx: number, rz: number, angle: number, y: number) => [Math.sin(angle) * rx, y, Math.cos(angle) * rz]
  const vertices = [
    ...point(config.innerRx, config.innerRz, a0, 0),
    ...point(config.innerRx, config.innerRz, a1, 0),
    ...point(config.outerRx, config.outerRz, a1, 0),
    ...point(config.outerRx, config.outerRz, a0, 0),
    ...point(config.innerRx, config.innerRz, a0, config.innerY),
    ...point(config.innerRx, config.innerRz, a1, config.innerY),
    ...point(config.outerRx, config.outerRz, a1, config.outerY),
    ...point(config.outerRx, config.outerRz, a0, config.outerY),
  ]
  const indices = [
    4, 5, 6, 4, 6, 7,
    0, 2, 1, 0, 3, 2,
    0, 1, 5, 0, 5, 4,
    3, 7, 6, 3, 6, 2,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function roofGeometry(innerRx: number, innerRz: number, outerRx: number, outerRz: number) {
  const segments = 128
  const positions: number[] = []
  const indices: number[] = []
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2
    const wave = Math.cos(angle * 2) * 1.2
    positions.push(Math.sin(angle) * innerRx, 41.5 + wave, Math.cos(angle) * innerRz)
    positions.push(Math.sin(angle) * outerRx, VENUE.roofHeight - 1.2 + wave, Math.cos(angle) * outerRz)
    if (index < segments) {
      const base = index * 2
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export default function Venue3D(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const propsRef = useRef(props)
  const [error, setError] = useState(false)
  propsRef.current = props

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    ;(window as unknown as { __SCENE_READY__?: boolean }).__SCENE_READY__ = false
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      setError(true)
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#07101c')
    scene.fog = new THREE.FogExp2('#07101c', 0.0019)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.15, 900)
    const initiallyPortrait = mount.clientWidth / mount.clientHeight < 0.8
    camera.position.set(...(initiallyPortrait ? [310, 260, 370] : [185, 160, 230]) as [number, number, number])
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.setAttribute('aria-label', '可拖动旋转的场馆模型；进入第一视角后可拖动环视，也可使用方向键调整观看方向')
    renderer.domElement.tabIndex = 0
    renderer.domElement.style.touchAction = 'none'
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 10, -4)
    controls.enableDamping = true
    controls.dampingFactor = 0.075
    controls.minDistance = 24
    controls.maxDistance = 520
    controls.maxPolarAngle = Math.PI * 0.48
    controls.minPolarAngle = Math.PI * 0.08
    controls.autoRotateSpeed = 0.4

    scene.add(new THREE.HemisphereLight('#c4e8f2', '#08131b', 1.8))
    const keyLight = new THREE.DirectionalLight('#eef8ff', 2.6)
    keyLight.position.set(-85, 140, 75)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.left = -160
    keyLight.shadow.camera.right = 160
    keyLight.shadow.camera.top = 160
    keyLight.shadow.camera.bottom = -160
    keyLight.shadow.camera.far = 400
    scene.add(keyLight)
    const rim = new THREE.DirectionalLight('#68c8dd', 1.1)
    rim.position.set(90, 65, -85)
    scene.add(rim)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(440, 128),
      new THREE.MeshStandardMaterial({ color: '#08131d', roughness: 0.98, metalness: 0.02 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.2
    ground.receiveShadow = true
    scene.add(ground)

    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(190, 128),
      new THREE.MeshStandardMaterial({ color: '#17242c', roughness: 0.96 }),
    )
    plaza.rotation.x = -Math.PI / 2
    plaza.scale.set(1, 1.25, 1)
    plaza.position.y = -0.12
    scene.add(plaza)

    const outerTrackRadius = VENUE.trackRadius + VENUE.trackLanes * VENUE.trackLaneWidth
    scene.add(capsuleMesh(outerTrackRadius, VENUE.trackStraight, '#175b83', 0))
    scene.add(capsuleMesh(VENUE.trackRadius, VENUE.trackStraight, '#244b3f', 0.035))

    const laneMaterial = new THREE.LineBasicMaterial({ color: '#a5c8d5', transparent: true, opacity: 0.65 })
    for (let lane = 0; lane <= VENUE.trackLanes; lane += 1) {
      const radius = VENUE.trackRadius + lane * VENUE.trackLaneWidth
      const points = capsuleShape(radius, VENUE.trackStraight).getPoints(128).map((point) => new THREE.Vector3(point.x, 0.075, -point.y))
      scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), laneMaterial))
    }

    const clickable: THREE.Object3D[] = []
    const sectionObjects = new Map<string, THREE.Mesh[]>()
    const sectionMaterials = new Map<string, THREE.MeshStandardMaterial[]>()
    const baseColors = new Map<string, THREE.Color>()
    const registerSection = (id: string, mesh: THREE.Mesh, material: THREE.MeshStandardMaterial) => {
      mesh.userData.sectionId = id
      clickable.push(mesh)
      if (!sectionObjects.has(id)) sectionObjects.set(id, [])
      if (!sectionMaterials.has(id)) sectionMaterials.set(id, [])
      sectionObjects.get(id)!.push(mesh)
      sectionMaterials.get(id)!.push(material)
    }

    for (const section of SECTIONS) {
      const baseColor = new THREE.Color(section.color)
      baseColors.set(section.id, baseColor)
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.76,
        metalness: 0.04,
        emissive: baseColor,
        emissiveIntensity: 0.025,
        transparent: true,
        opacity: section.kind === 'field' ? 0.86 : 0.68,
      })
      const mesh = section.kind === 'field'
        ? new THREE.Mesh(new THREE.BoxGeometry(section.width, 0.2, section.depth), material)
        : new THREE.Mesh(wedgeGeometry(section), material)
      if (section.kind === 'field') mesh.position.set(section.x, 0.14, section.z)
      mesh.receiveShadow = true
      scene.add(mesh)
      registerSection(section.id, mesh, material)
    }

    const concrete = new THREE.MeshStandardMaterial({ color: '#75838a', roughness: 0.88, metalness: 0.08, side: THREE.DoubleSide })
    const midFascia = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5.4, 128, 1, true), concrete)
    midFascia.scale.set(71.5, 1, 109)
    midFascia.position.y = 18
    scene.add(midFascia)
    const upperFascia = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5.2, 128, 1, true), concrete)
    upperFascia.scale.set(90, 1, 130)
    upperFascia.position.y = 38.5
    scene.add(upperFascia)

    const facade = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 34, 128, 1, true),
      new THREE.MeshStandardMaterial({ color: '#283b46', roughness: 0.55, metalness: 0.55, transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    )
    facade.scale.set(99, 1, 137)
    facade.position.y = 17
    scene.add(facade)

    const roof = new THREE.Mesh(
      roofGeometry(88, 126, 108, 148),
      new THREE.MeshStandardMaterial({ color: '#aebcc1', roughness: 0.48, metalness: 0.62, side: THREE.DoubleSide }),
    )
    roof.castShadow = true
    roof.receiveShadow = true
    scene.add(roof)

    const trussPoints: THREE.Vector3[] = []
    const cablePoints: THREE.Vector3[] = []
    const mastCount = 32
    for (let index = 0; index < mastCount; index += 1) {
      const angle = (index / mastCount) * Math.PI * 2
      const nextAngle = ((index + 0.5) / mastCount) * Math.PI * 2
      const inner = new THREE.Vector3(Math.sin(angle) * 88, 41, Math.cos(angle) * 126)
      const outer = new THREE.Vector3(Math.sin(angle) * 108, 48.5, Math.cos(angle) * 148)
      const middle = new THREE.Vector3(Math.sin(nextAngle) * 98, 43.5, Math.cos(nextAngle) * 137)
      trussPoints.push(inner, outer, inner, middle, middle, outer)
      const mastTop = new THREE.Vector3(Math.sin(angle) * 116, 60, Math.cos(angle) * 157)
      cablePoints.push(mastTop, outer, mastTop, new THREE.Vector3(Math.sin(angle) * 94, 43, Math.cos(angle) * 134))
    }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(trussPoints), new THREE.LineBasicMaterial({ color: '#3c4c53', transparent: true, opacity: 0.78 })))
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePoints), new THREE.LineBasicMaterial({ color: '#9aabb2', transparent: true, opacity: 0.72 })))

    const mastGeometry = new THREE.CylinderGeometry(0.24, 0.42, 60, 8)
    const mastMaterial = new THREE.MeshStandardMaterial({ color: '#9cabb1', roughness: 0.52, metalness: 0.68 })
    const masts = new THREE.InstancedMesh(mastGeometry, mastMaterial, mastCount)
    const dummy = new THREE.Object3D()
    for (let index = 0; index < mastCount; index += 1) {
      const angle = (index / mastCount) * Math.PI * 2
      dummy.position.set(Math.sin(angle) * 116, 30, Math.cos(angle) * 157)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      masts.setMatrixAt(index, dummy.matrix)
    }
    scene.add(masts)

    const columnCount = 40
    const columns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.65, 0.9, 41, 8), concrete, columnCount)
    for (let index = 0; index < columnCount; index += 1) {
      const angle = (index / columnCount) * Math.PI * 2
      dummy.position.set(Math.sin(angle) * 94, 20.5, Math.cos(angle) * 132)
      dummy.updateMatrix()
      columns.setMatrixAt(index, dummy.matrix)
    }
    scene.add(columns)

    const seatData: SeatInstance[] = []
    for (const section of SECTIONS) {
      if (section.kind === 'stand') {
        const config = STAND_TIERS[section.tier || 0]
        const columnsPerSection = section.tier === 0 ? 12 : 10
        for (let row = 0; row < config.rows; row += 1) {
          const ratio = (row + 0.5) / config.rows
          const rx = THREE.MathUtils.lerp(config.innerRx, config.outerRx, ratio)
          const rz = THREE.MathUtils.lerp(config.innerRz, config.outerRz, ratio)
          const y = THREE.MathUtils.lerp(config.innerY, config.outerY, ratio) + 0.3
          for (let column = 0; column < columnsPerSection; column += 1) {
            const angle = section.angle! + ((column + 0.5) / columnsPerSection - 0.5) * section.span! * 0.86
            seatData.push({ sectionId: section.id, kind: 'stand', x: Math.sin(angle) * rx, y, z: Math.cos(angle) * rz, angle })
          }
        }
      } else {
        const rows = Math.max(7, Math.floor(section.depth / 1.35))
        const columnsPerSection = Math.max(8, Math.floor(section.width / 1.15))
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columnsPerSection; column += 1) {
            seatData.push({
              sectionId: section.id,
              kind: 'field',
              x: section.x + ((column + 0.5) / columnsPerSection - 0.5) * section.width * 0.9,
              y: 0.48,
              z: section.z + ((row + 0.5) / rows - 0.5) * section.depth * 0.9,
              angle: 0,
            })
          }
        }
      }
    }

    const chairSeat = new THREE.BoxGeometry(0.52, 0.13, 0.48)
    const chairBack = new THREE.BoxGeometry(0.52, 0.48, 0.1)
    chairBack.translate(0, 0.25, 0.2)
    const chairGeometry = mergeGeometries([chairSeat, chairBack])!
    chairSeat.dispose()
    chairBack.dispose()
    const chairMaterial = new THREE.MeshStandardMaterial({ color: '#d1e0e3', roughness: 0.88 })
    const chairs = new THREE.InstancedMesh(chairGeometry, chairMaterial, seatData.length)
    const baseSeatColors: THREE.Color[] = []
    const random = seededRandom(20261114)
    seatData.forEach((seat, index) => {
      dummy.position.set(seat.x, seat.y, seat.z)
      dummy.rotation.set(0, seat.angle, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      chairs.setMatrixAt(index, dummy.matrix)
      const base = seat.kind === 'stand'
        ? new THREE.Color(random() > 0.22 ? '#83adbb' : '#c5d9dc')
        : new THREE.Color('#65747b')
      baseSeatColors.push(base)
      chairs.setColorAt(index, base)
    })
    scene.add(chairs)

    const fieldSeats = seatData.filter((seat, index) => seat.kind === 'field' && index % 2 === 0)
    const heads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#26333a', roughness: 1 }),
      fieldSeats.length,
    )
    fieldSeats.forEach((seat, index) => {
      dummy.position.set(seat.x, 1.16 + random() * 0.12, seat.z)
      dummy.updateMatrix()
      heads.setMatrixAt(index, dummy.matrix)
    })
    scene.add(heads)
    const updateHeads = (eye?: THREE.Vector3) => {
      fieldSeats.forEach((seat, index) => {
        const tooClose = eye ? Math.hypot(seat.x - eye.x, seat.z - eye.z) < 3 : false
        dummy.position.set(seat.x, 1.16, seat.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(tooClose ? 0 : 1)
        dummy.updateMatrix()
        heads.setMatrixAt(index, dummy.matrix)
      })
      heads.instanceMatrix.needsUpdate = true
    }

    const stage = new THREE.Group()
    const stageMaterial = new THREE.MeshStandardMaterial({ color: '#87979e', roughness: 0.48, metalness: 0.55 })
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#14232b', roughness: 0.48, metalness: 0.72 })
    const stageBase = new THREE.Mesh(new THREE.BoxGeometry(44, 2.2, 12), stageMaterial)
    stageBase.position.set(0, 1.1, -54)
    stageBase.castShadow = true
    stage.add(stageBase)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(41, 15, 1), darkMetal)
    backWall.position.set(0, 9.2, -60)
    stage.add(backWall)
    const screenTexture = makeScreenTexture()
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(37, 12), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }))
    screen.position.set(0, 9.4, -59.45)
    stage.add(screen)
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(5, 1.3, 28), stageMaterial)
    catwalk.position.set(0, 0.65, -34)
    stage.add(catwalk)
    const thrust = new THREE.Mesh(new THREE.BoxGeometry(12, 1.3, 5), stageMaterial)
    thrust.position.set(0, 0.65, -18.5)
    stage.add(thrust)
    const booth = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 5), darkMetal)
    booth.position.set(-32, 1.1, 12)
    stage.add(booth)
    for (const x of [-23, 23]) {
      const speaker = new THREE.Mesh(new THREE.BoxGeometry(1.6, 10, 1.8), darkMetal)
      speaker.position.set(x, 6, -51)
      stage.add(speaker)
      const sideScreen = new THREE.Mesh(new THREE.PlaneGeometry(7, 11), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }))
      sideScreen.position.set(x * 0.88, 8.5, -56)
      sideScreen.rotation.y = x < 0 ? 0.15 : -0.15
      stage.add(sideScreen)
    }
    const stripMaterial = new THREE.MeshBasicMaterial({ color: '#55e9f4', toneMapped: false })
    for (const x of [-20, -10, 0, 10, 20]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 11.4), stripMaterial)
      strip.position.set(x, 2.24, -54)
      stage.add(strip)
    }
    scene.add(stage)

    for (const x of [-16, 0, 16]) {
      const spot = new THREE.SpotLight('#69e1ed', 130, 180, Math.PI * 0.16, 0.7, 1.4)
      spot.position.set(x, 19, -54)
      spot.target.position.set(x * 0.3, 0, -4)
      scene.add(spot, spot.target)
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerStart = { x: 0, y: 0 }
    let lastPointer = { x: 0, y: 0 }
    let lookingAround = false

    const rotateView = (deltaX: number, deltaY: number) => {
      if (!immersiveNow) return
      transitioning = false
      const direction = controls.target.clone().sub(camera.position)
      if (direction.lengthSq() < 0.001) direction.set(0, 0, -50)
      const spherical = new THREE.Spherical().setFromVector3(direction)
      const sensitivity = 0.004 * Math.max(camera.fov / baseFov, 0.12)
      spherical.theta -= deltaX * sensitivity
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + deltaY * sensitivity, 0.35, Math.PI - 0.35)
      const nextDirection = new THREE.Vector3().setFromSpherical(spherical).normalize().multiplyScalar(50)
      controls.target.copy(camera.position).add(nextDirection)
      camera.lookAt(controls.target)
    }

    const onPointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY }
      lastPointer = { ...pointerStart }
      if (!immersiveNow) return
      lookingAround = true
      transitioning = false
      renderer.domElement.setPointerCapture(event.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
      renderer.domElement.focus({ preventScroll: true })
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!lookingAround || !immersiveNow) return
      rotateView(event.clientX - lastPointer.x, event.clientY - lastPointer.y)
      lastPointer = { x: event.clientX, y: event.clientY }
    }
    const finishLooking = (event: PointerEvent) => {
      if (!lookingAround) return
      lookingAround = false
      renderer.domElement.style.cursor = immersiveNow ? 'grab' : ''
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
    }
    const onPointerUp = (event: PointerEvent) => {
      const wasLookingAround = lookingAround
      finishLooking(event)
      if (wasLookingAround || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5 || propsRef.current.immersive) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(clickable, false)[0]
      if (hit?.object.userData.sectionId) propsRef.current.onSelect(hit.object.userData.sectionId)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!immersiveNow) return
      const directions: Record<string, [number, number]> = {
        ArrowLeft: [-28, 0], a: [-28, 0], A: [-28, 0],
        ArrowRight: [28, 0], d: [28, 0], D: [28, 0],
        ArrowUp: [0, -22], w: [0, -22], W: [0, -22],
        ArrowDown: [0, 22], s: [0, 22], S: [0, 22],
      }
      const direction = directions[event.key]
      if (!direction) return
      event.preventDefault()
      rotateView(...direction)
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', finishLooking)
    renderer.domElement.addEventListener('keydown', onKeyDown)

    let desiredPosition = camera.position.clone()
    let desiredTarget = controls.target.clone()
    let transitionFromPosition = camera.position.clone()
    let transitionFromTarget = controls.target.clone()
    let transitionStartedAt = 0
    let transitioning = false
    let selected = ''
    let immersiveNow = false
    let activePrice: number | null = null
    let currentZoom = propsRef.current.zoom
    let baseFov = 62

    const updateChairColors = () => {
      seatData.forEach((seat, index) => {
        const section = SECTIONS.find((item) => item.id === seat.sectionId)!
        const isSelected = seat.sectionId === selected
        const isDimmed = activePrice !== null && section.price !== activePrice && !isSelected
        chairs.setColorAt(index, isSelected ? new THREE.Color('#8df3fa') : isDimmed ? new THREE.Color('#243842') : baseSeatColors[index])
      })
      if (chairs.instanceColor) chairs.instanceColor.needsUpdate = true
    }

    const applyZoom = () => {
      const baseRadians = THREE.MathUtils.degToRad(baseFov)
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(baseRadians / 2) / currentZoom))
      camera.updateProjectionMatrix()
    }

    const moveCamera = (position: THREE.Vector3, target: THREE.Vector3) => {
      desiredPosition = position
      desiredTarget = target
      transitionFromPosition = camera.position.clone()
      transitionFromTarget = controls.target.clone()
      transitionStartedAt = performance.now()
      transitioning = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!transitioning) {
        camera.position.copy(position)
        controls.target.copy(target)
      }
    }

    const overview = () => {
      immersiveNow = false
      lookingAround = false
      renderer.domElement.style.cursor = ''
      updateHeads()
      controls.enabled = true
      controls.enableZoom = true
      controls.enableRotate = true
      const portrait = mount.clientWidth / mount.clientHeight < 0.8
      camera.fov = portrait ? 50 : 42
      camera.updateProjectionMatrix()
      moveCamera(portrait ? new THREE.Vector3(310, 260, 370) : new THREE.Vector3(185, 160, 230), new THREE.Vector3(0, portrait ? -15 : 10, -4))
    }

    const focusSection = (id: string) => {
      const section = SECTIONS.find((item) => item.id === id)
      if (!section || immersiveNow) return
      const radial = new THREE.Vector3(section.x, 0, section.z).normalize()
      const position = new THREE.Vector3(section.x, section.kind === 'stand' ? 48 : 30, section.z)
        .add(radial.multiplyScalar(section.kind === 'stand' ? 42 : 38))
      moveCamera(position, new THREE.Vector3(section.x * 0.65, section.kind === 'stand' ? 12 : 3, section.z * 0.65 - 4))
    }

    const select = (id: string, move = true) => {
      selected = id
      for (const [sectionId, materials] of sectionMaterials) {
        const isSelected = sectionId === id
        materials.forEach((material) => {
          material.emissive.set(isSelected ? '#8cecf3' : baseColors.get(sectionId)!)
          material.emissiveIntensity = isSelected ? 0.7 : 0.025
          material.opacity = isSelected ? 0.92 : activePrice !== null && SECTIONS.find((item) => item.id === sectionId)!.price !== activePrice ? 0.14 : sectionId.startsWith('VIP') || sectionId.startsWith('A') || sectionId.startsWith('B') ? 0.86 : 0.68
        })
      }
      updateChairColors()
      if (move) focusSection(id)
    }

    const filter = (price: number | null) => {
      activePrice = price
      for (const section of SECTIONS) {
        const visible = price === null || price === section.price || section.id === selected
        sectionObjects.get(section.id)?.forEach((mesh) => { mesh.visible = true })
        sectionMaterials.get(section.id)?.forEach((material) => {
          material.opacity = visible ? (section.id === selected ? 0.92 : section.kind === 'field' ? 0.86 : 0.68) : 0.14
        })
      }
      updateChairColors()
    }

    const seatView = (positionName: SeatPosition) => {
      const section = SECTIONS.find((item) => item.id === selected)
      if (!section) return
      immersiveNow = true
      lookingAround = false
      renderer.domElement.style.cursor = 'grab'
      controls.enabled = false
      baseFov = section.kind === 'stand' ? 55 : 62
      applyZoom()
      const estimate = getViewEstimate(section, positionName)
      const eye = new THREE.Vector3(estimate.eye.x, estimate.eye.y, estimate.eye.z)
      updateHeads(eye)
      moveCamera(eye, new THREE.Vector3(0, 7, -53))
    }

    apiRef.current = {
      select,
      filter,
      overview,
      seatView,
      setAutoRotate: (value) => { controls.autoRotate = value },
      setZoom: (value) => { currentZoom = value; if (immersiveNow) applyZoom() },
      capture: () => {
        renderer.render(scene, camera)
        propsRef.current.onCapture(renderer.domElement.toDataURL('image/png'))
      },
    }
    select(propsRef.current.selectedId, false)
    filter(propsRef.current.activePrice)

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      if (!immersiveNow) camera.fov = camera.aspect < 0.8 ? 50 : 42
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    let frame = 0
    const render = () => {
      frame = requestAnimationFrame(render)
      if (transitioning) {
        const linearProgress = Math.min((performance.now() - transitionStartedAt) / 720, 1)
        const progress = 1 - Math.pow(1 - linearProgress, 3)
        camera.position.lerpVectors(transitionFromPosition, desiredPosition, progress)
        controls.target.lerpVectors(transitionFromTarget, desiredTarget, progress)
        if (linearProgress >= 1) {
          camera.position.copy(desiredPosition)
          controls.target.copy(desiredTarget)
          transitioning = false
        }
      }
      if (controls.enabled) controls.update()
      else camera.lookAt(controls.target)
      renderer.render(scene, camera)
      ;(window as unknown as { __SCENE_STATS__?: object }).__SCENE_STATS__ = {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
      }
    }
    render()
    ;(window as unknown as { __SCENE_READY__?: boolean }).__SCENE_READY__ = true

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', finishLooking)
      renderer.domElement.removeEventListener('keydown', onKeyDown)
      controls.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      screenTexture.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      apiRef.current = null
    }
  }, [])

  useEffect(() => { apiRef.current?.select(props.selectedId, !props.immersive) }, [props.selectedId])
  useEffect(() => { apiRef.current?.filter(props.activePrice) }, [props.activePrice])
  useEffect(() => { apiRef.current?.setAutoRotate(props.autoRotate) }, [props.autoRotate])
  useEffect(() => { apiRef.current?.setZoom(props.zoom) }, [props.zoom])
  useEffect(() => { if (props.captureSignal > 0) apiRef.current?.capture() }, [props.captureSignal])
  useEffect(() => {
    if (props.resetKey === 0) return
    if (props.immersive) apiRef.current?.seatView(props.seatPosition)
    else apiRef.current?.overview()
  }, [props.resetKey])
  useEffect(() => {
    if (props.immersive) apiRef.current?.seatView(props.seatPosition)
    else apiRef.current?.overview()
  }, [props.immersive, props.seatPosition])

  if (error) {
    return <div className="webgl-fallback"><img src="/seat-map-reference.jpg" alt="原始座位图" /><span>当前设备无法开启 3D，请切换 2D 模式</span></div>
  }
  return <div ref={mountRef} className="venue-canvas" />
}
