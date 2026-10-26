import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { SECTIONS, type SeatPosition } from '../data'

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

function makeScreenTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 384
  const context = canvas.getContext('2d')!
  context.fillStyle = '#07121e'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#1d5b6c'
  context.lineWidth = 2
  for (let x = 0; x < canvas.width; x += 64) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke()
  }
  context.fillStyle = '#d8fbff'
  context.textAlign = 'center'
  context.font = '700 94px Arial, sans-serif'
  context.fillText('ENDLESS', 512, 168)
  context.fillStyle = '#5de7f5'
  context.font = '500 43px Arial, sans-serif'
  context.letterSpacing = '12px'
  context.fillText('POSSIBILITY', 512, 250)
  context.fillStyle = '#8ba6b4'
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

export default function Venue3D(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const propsRef = useRef(props)
  const [error, setError] = useState(false)
  propsRef.current = props

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch {
      setError(true)
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#07101c')
    scene.fog = new THREE.FogExp2('#07101c', 0.0052)
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600)
    const initiallyPortrait = mount.clientWidth / mount.clientHeight < 0.8
    camera.position.set(...(initiallyPortrait ? [112, 94, 132] : [80, 70, 94]) as [number, number, number])
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.setAttribute('aria-label', '可拖动旋转的三维演唱会场馆')
    renderer.domElement.style.touchAction = 'none'
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 2, 3)
    controls.enableDamping = true
    controls.dampingFactor = 0.075
    controls.minDistance = 18
    controls.maxDistance = 180
    controls.maxPolarAngle = Math.PI * 0.47
    controls.minPolarAngle = Math.PI * 0.12
    controls.autoRotateSpeed = 0.45

    scene.add(new THREE.HemisphereLight('#b8e8ff', '#07101a', 1.75))
    const keyLight = new THREE.DirectionalLight('#e5f5ff', 2.8)
    keyLight.position.set(-35, 70, 30)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.camera.left = -75
    keyLight.shadow.camera.right = 75
    keyLight.shadow.camera.top = 75
    keyLight.shadow.camera.bottom = -75
    scene.add(keyLight)
    const rim = new THREE.DirectionalLight('#25c8e8', 1.4)
    rim.position.set(45, 28, -35)
    scene.add(rim)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(210, 96),
      new THREE.MeshStandardMaterial({ color: '#08131f', roughness: 0.98, metalness: 0.02 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.16
    ground.receiveShadow = true
    scene.add(ground)

    const fieldFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(72, 72),
      new THREE.MeshStandardMaterial({ color: '#101d28', roughness: 0.9, metalness: 0.08 }),
    )
    fieldFloor.rotation.x = -Math.PI / 2
    fieldFloor.position.set(0, -0.08, 4)
    fieldFloor.receiveShadow = true
    scene.add(fieldFloor)

    const grid = new THREE.GridHelper(150, 50, '#173244', '#102432')
    grid.position.y = -0.05
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.2 })
    scene.add(grid)

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
      if (section.kind === 'field') {
        const material = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.7, metalness: 0.08, emissive: baseColor, emissiveIntensity: 0.04 })
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(section.width, 0.22, section.depth), material)
        mesh.position.set(section.x, 0.04, section.z)
        mesh.receiveShadow = true
        scene.add(mesh)
        registerSection(section.id, mesh, material)
      } else {
        const rows = 4
        for (let row = 0; row < rows; row += 1) {
          const offset = (row - 1.5) * 1.25
          const rx = (section.tier === 0 ? 41 : 48) + offset
          const rz = (section.tier === 0 ? 34 : 41) + offset
          const top = 2.8 + row * 0.82 + (section.tier || 0) * 3.4
          const material = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.8, metalness: 0.04, emissive: baseColor, emissiveIntensity: 0.025 })
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(section.width, top, 1.34), material)
          mesh.position.set(Math.sin(section.angle!) * rx, top / 2 - 0.02, Math.cos(section.angle!) * rz + 5)
          mesh.rotation.y = section.angle!
          mesh.castShadow = true
          mesh.receiveShadow = true
          scene.add(mesh)
          registerSection(section.id, mesh, material)
        }
      }
    }

    const chairGeometry = new THREE.BoxGeometry(0.48, 0.48, 0.48)
    const chairMaterial = new THREE.MeshStandardMaterial({ color: '#63717b', roughness: 0.9 })
    const headGeometry = new THREE.SphereGeometry(0.19, 6, 5)
    const headMaterial = new THREE.MeshStandardMaterial({ color: '#26343e', roughness: 1 })
    const fieldSections = SECTIONS.filter((section) => section.kind === 'field')
    const chairCount = fieldSections.length * 48
    const chairs = new THREE.InstancedMesh(chairGeometry, chairMaterial, chairCount)
    const heads = new THREE.InstancedMesh(headGeometry, headMaterial, chairCount)
    const dummy = new THREE.Object3D()
    const random = seededRandom(20261114)
    let seatIndex = 0
    for (const section of fieldSections) {
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 6; col += 1) {
          const x = section.x + (col - 2.5) * (section.width / 7)
          const z = section.z + (row - 3.5) * (section.depth / 9)
          dummy.position.set(x, 0.45, z)
          dummy.rotation.set(0, 0, 0)
          dummy.updateMatrix()
          chairs.setMatrixAt(seatIndex, dummy.matrix)
          dummy.position.set(x, 1.05 + random() * 0.15, z)
          dummy.updateMatrix()
          heads.setMatrixAt(seatIndex, dummy.matrix)
          seatIndex += 1
        }
      }
    }
    chairs.castShadow = true
    scene.add(chairs, heads)

    const stage = new THREE.Group()
    const stageMaterial = new THREE.MeshStandardMaterial({ color: '#7f909b', roughness: 0.5, metalness: 0.55 })
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#16232c', roughness: 0.48, metalness: 0.72 })
    const stageBase = new THREE.Mesh(new THREE.BoxGeometry(32, 2.4, 9), stageMaterial)
    stageBase.position.set(0, 1.2, -23)
    stageBase.castShadow = true
    stage.add(stageBase)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(29, 12, 1), darkMetal)
    backWall.position.set(0, 7.5, -27)
    stage.add(backWall)
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(25, 9.4),
      new THREE.MeshBasicMaterial({ map: makeScreenTexture(), toneMapped: false }),
    )
    screen.position.set(0, 7.8, -26.45)
    stage.add(screen)
    const catwalk = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 12), stageMaterial)
    catwalk.position.set(0, 0.6, -13.5)
    stage.add(catwalk)
    const thrust = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 4), stageMaterial)
    thrust.position.set(0, 0.6, -7.7)
    stage.add(thrust)
    const booth = new THREE.Mesh(new THREE.BoxGeometry(7, 2.1, 4), darkMetal)
    booth.position.set(0, 1.05, 24)
    stage.add(booth)
    for (const x of [-15.2, 15.2]) {
      const speaker = new THREE.Mesh(new THREE.BoxGeometry(1.3, 8, 1.5), darkMetal)
      speaker.position.set(x, 5, -20)
      stage.add(speaker)
    }
    const stripMaterial = new THREE.MeshBasicMaterial({ color: '#4ce9fa', toneMapped: false })
    for (const x of [-14, -7, 0, 7, 14]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 8.6), stripMaterial)
      strip.position.set(x, 2.44, -23)
      stage.add(strip)
    }
    scene.add(stage)

    for (const x of [-12, 0, 12]) {
      const spot = new THREE.SpotLight('#59dff2', 75, 80, Math.PI * 0.17, 0.65, 1.4)
      spot.position.set(x, 16, -24)
      spot.target.position.set(x * 0.3, 0, 4)
      scene.add(spot, spot.target)
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let pointerStart = { x: 0, y: 0 }
    const onPointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY } }
    const onPointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5 || propsRef.current.immersive) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(clickable, false)[0]
      if (hit?.object.userData.sectionId) propsRef.current.onSelect(hit.object.userData.sectionId)
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    let desiredPosition = camera.position.clone()
    let desiredTarget = controls.target.clone()
    let transitionFromPosition = camera.position.clone()
    let transitionFromTarget = controls.target.clone()
    let transitionStartedAt = 0
    let transitioning = false
    let selected = ''
    let immersiveNow = false
    let currentZoom = propsRef.current.zoom
    let baseFov = 62

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
      controls.enabled = true
      controls.enableZoom = true
      controls.enableRotate = true
      const portrait = mount.clientWidth / mount.clientHeight < 0.8
      camera.fov = portrait ? 50 : 42
      camera.updateProjectionMatrix()
      moveCamera(portrait ? new THREE.Vector3(112, 94, 132) : new THREE.Vector3(80, 70, 94), new THREE.Vector3(0, 2, 3))
    }

    const focusSection = (id: string) => {
      const section = SECTIONS.find((item) => item.id === id)
      if (!section || immersiveNow) return
      const radial = new THREE.Vector3(section.x, 0, section.z - 2).normalize()
      const position = new THREE.Vector3(section.x, section.kind === 'stand' ? 25 : 20, section.z)
        .add(radial.multiplyScalar(section.kind === 'stand' ? 23 : 28))
      moveCamera(position, new THREE.Vector3(section.x * 0.45, 1, section.z * 0.45 - 3))
    }

    const select = (id: string, move = true) => {
      selected = id
      for (const [sectionId, materials] of sectionMaterials) {
        const isSelected = sectionId === id
        materials.forEach((material) => {
          material.emissive.set(isSelected ? '#7cecff' : baseColors.get(sectionId)!)
          material.emissiveIntensity = isSelected ? 0.65 : 0.03
        })
      }
      if (move) focusSection(id)
    }

    const filter = (price: number | null) => {
      for (const section of SECTIONS) {
        const visible = price === null || price === section.price || section.id === selected
        sectionObjects.get(section.id)?.forEach((mesh) => {
          mesh.visible = visible
          const materials = sectionMaterials.get(section.id)!
          materials.forEach((material) => {
            material.transparent = price !== null && section.price !== price
            material.opacity = material.transparent ? 0.24 : 1
          })
        })
      }
    }

    const seatView = (positionName: SeatPosition) => {
      const section = SECTIONS.find((item) => item.id === selected)
      if (!section) return
      immersiveNow = true
      controls.enabled = false
      baseFov = section.kind === 'stand' ? 52 : 62
      applyZoom()
      const rowOffset = positionName === 'front' ? -0.28 : positionName === 'back' ? 0.28 : 0
      let eye: THREE.Vector3
      if (section.kind === 'field') {
        eye = new THREE.Vector3(section.x, 1.62, section.z + section.depth * rowOffset)
      } else {
        const row = positionName === 'front' ? 0 : positionName === 'back' ? 3 : 1.5
        const offset = (row - 1.5) * 1.25
        const rx = (section.tier === 0 ? 41 : 48) + offset
        const rz = (section.tier === 0 ? 34 : 41) + offset
        const top = 2.8 + row * 0.82 + (section.tier || 0) * 3.4
        eye = new THREE.Vector3(Math.sin(section.angle!) * rx, top + 1.45, Math.cos(section.angle!) * rz + 5)
      }
      moveCamera(eye, new THREE.Vector3(0, 5.2, -22))
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
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      controls.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
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
  useEffect(() => { if (props.resetKey > 0) apiRef.current?.overview() }, [props.resetKey])
  useEffect(() => {
    if (props.immersive) apiRef.current?.seatView(props.seatPosition)
    else apiRef.current?.overview()
  }, [props.immersive, props.seatPosition])

  if (error) {
    return <div className="webgl-fallback"><img src="/seat-map-reference.jpg" alt="原始座位图" /><span>当前设备无法开启 3D，请切换 2D 模式</span></div>
  }
  return <div ref={mountRef} className="venue-canvas" />
}
