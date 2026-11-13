import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Html, Sky, Clouds, Cloud, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { AGENTS } from '../agents.js';
import { facadeMaterial, roofMaterial, cloudTextureURL } from './textures.js';

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const BX = 24, BZ = 16, ST = 7; // block size x/z, street width
export const SUN = [160, 60, 120];

// ------------------------------------------------------------ city blocks
function Building({ b }) {
  const mats = useMemo(() => {
    const side = facadeMaterial(b.kind, b.seed, b.d, b.h), front = facadeMaterial(b.kind, b.seed, b.w, b.h), roof = roofMaterial();
    return [side, side, roof, roof, front, front];
  }, [b]);
  return (
    <group position={[b.x, b.y0 || 0, b.z]}>
      <mesh position={[0, b.h / 2, 0]} material={mats} castShadow={b.shadow} receiveShadow><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
      {b.kind !== 'glass' && (
        <mesh position={[0, b.h + 0.35, 0]} castShadow={b.shadow}><boxGeometry args={[b.w + 0.6, 0.7, b.d + 0.6]} /><meshStandardMaterial color={b.kind === 'stone' ? '#cbbfa8' : '#c9c1b3'} roughness={0.9} /></mesh>
      )}
      {b.water && (
        <group position={[b.w * 0.2, b.h + 0.7, -b.d * 0.15]}>
          {[[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].map(([x, z], i) => <mesh key={i} position={[x, 1.2, z]}><cylinderGeometry args={[0.08, 0.08, 2.4, 5]} /><meshStandardMaterial color="#3a3a3a" /></mesh>)}
          <mesh position={[0, 3.6, 0]} castShadow><cylinderGeometry args={[1.5, 1.5, 2.6, 14]} /><meshStandardMaterial color="#7a5c41" roughness={0.95} /></mesh>
          <mesh position={[0, 5.4, 0]} castShadow><coneGeometry args={[1.6, 1.1, 14]} /><meshStandardMaterial color="#4b3f35" /></mesh>
        </group>
      )}
      {b.kind === 'glass' && b.h > 30 && (
        <mesh position={[b.w * 0.18, b.h + 1.2, 0]} castShadow={b.shadow}><boxGeometry args={[b.w * 0.4, 2.4, b.d * 0.5]} /><meshStandardMaterial color="#9a9fa4" roughness={0.8} /></mesh>
      )}
    </group>
  );
}

function useCity() {
  return useMemo(() => {
    const r = rng(1811);
    const out = [];
    for (let gx = -6; gx <= 6; gx++) for (let gz = -9; gz <= 2; gz++) {
      if (Math.abs(gx) <= 1 && gz >= -1 && gz <= 1) continue; // the plaza around our tower
      const cx = gx * (BX + ST), cz = gz * (BZ + ST);
      const dist = Math.hypot(cx, cz);
      const shadow = dist < 170;
      const parts = r() < 0.55 ? 1 : 2;
      for (let p = 0; p < parts; p++) {
        const w = parts === 1 ? BX - 1 : BX / 2 - 1, d = BZ - 1;
        const x = parts === 1 ? cx : cx + (p ? BX / 4 : -BX / 4);
        const tall = Math.max(0, 1 - dist / 260);
        const kindRoll = r();
        const kind = kindRoll < 0.34 ? 'glass' : kindRoll < 0.7 ? 'stone' : 'brick';
        const seed = Math.floor(r() * 1000);
        let h = kind === 'brick' ? 12 + r() * 18 : 16 + r() * 28 + tall * tall * r() * 55;
        h = Math.min(h, 88);
        if (kind === 'stone' && h > 34) {
          // pre-war setback tower: tiers
          const h1 = h * 0.5, h2 = h * 0.3, h3 = h * 0.2;
          out.push({ x, z: cz, w, d, h: h1, kind, seed, shadow });
          out.push({ x, z: cz, w: w * 0.78, d: d * 0.78, h: h2, y0: h1 + 0.7, kind, seed, shadow });
          out.push({ x, z: cz, w: w * 0.55, d: d * 0.55, h: h3, y0: h1 + h2 + 1.4, kind, seed, shadow, water: r() < 0.3 });
        } else {
          out.push({ x, z: cz, w, d, h, kind, seed, shadow, water: kind !== 'glass' && r() < 0.55 });
        }
      }
    }
    return out;
  }, []);
}

function Streets() {
  const blocks = [];
  for (let gx = -6; gx <= 6; gx++) for (let gz = -9; gz <= 2; gz++) blocks.push([gx * (BX + ST), gz * (BZ + ST)]);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -90]} receiveShadow><planeGeometry args={[460, 340]} /><meshStandardMaterial color="#45484c" roughness={0.95} /></mesh>
      {blocks.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.12, z]} receiveShadow><boxGeometry args={[BX + 2, 0.24, BZ + 2]} /><meshStandardMaterial color="#b9b4aa" roughness={0.95} /></mesh>
      ))}
      {/* waterfront and river */}
      <mesh position={[0, 0.3, 66]} receiveShadow><boxGeometry args={[460, 0.6, 8]} /><meshStandardMaterial color="#9c968b" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.6, 300]}><planeGeometry args={[2000, 460]} /><meshStandardMaterial color="#4d6b7c" roughness={0.12} metalness={0.5} envMapIntensity={1.4} /></mesh>
    </group>
  );
}

function Cabs() {
  const ref = useRef();
  const cars = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 60 }, (_, i) => {
      const alongX = i % 3 !== 0;
      const line = alongX ? (Math.floor(r() * 11) - 8) * (BZ + ST) + (BZ + ST) / 2 : (Math.floor(r() * 12) - 6) * (BX + ST) + (BX + ST) / 2;
      return { alongX, line, pos: (r() - 0.5) * 380, v: (6 + r() * 7) * (r() < 0.5 ? 1 : -1), color: r() < 0.55 ? '#f2c230' : ['#1d2024', '#e9e9e6', '#4a5866', '#7c1f1f'][Math.floor(r() * 4)] };
    });
  }, []);
  useEffect(() => { const c = new THREE.Color(); cars.forEach((k, i) => ref.current.setColorAt(i, c.set(k.color))); ref.current.instanceColor.needsUpdate = true; }, [cars]);
  const m = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), s = useMemo(() => new THREE.Vector3(1, 1, 1), []), p = useMemo(() => new THREE.Vector3(), []), up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame((_, dt) => {
    cars.forEach((k, i) => {
      k.pos += k.v * Math.min(dt, 0.05);
      if (k.pos > 200) k.pos = -200; if (k.pos < -200) k.pos = 200;
      const lane = Math.sign(k.v) * 1.4;
      let x = k.alongX ? k.pos : k.line + lane, z = k.alongX ? k.line - lane : k.pos - 80;
      const hidden = z > 60 || z < -230 || (Math.abs(x) < 40 && Math.abs(z) < 30);
      q.setFromAxisAngle(up, k.alongX ? (k.v > 0 ? 0 : Math.PI) : k.v > 0 ? -Math.PI / 2 : Math.PI / 2);
      s.setScalar(hidden ? 0 : 1);
      m.compose(p.set(x, 0.75, z), q, s); ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, cars.length]} castShadow>
      <boxGeometry args={[3.2, 1.1, 1.6]} />
      <meshStandardMaterial roughness={0.35} metalness={0.3} />
    </instancedMesh>
  );
}

// ------------------------------------------------------------ the research tower
const TW = 26, PODIUM = 12, FLOOR_H = 11;
export const TFLOORS = [['researcher'], ['kpi'], ['bull', 'bear'], ['skeptic'], ['editor'], ['genesis']];
// Which floor to open by default: wherever the team is working right now, else the CEO's floor.
export function busyFloor(run) {
  const i = TFLOORS.findIndex((ids) => ids.some((a) => run.agents[a]?.status === 'working'));
  return i >= 0 ? i : TFLOORS.length - 1;
}
const TTOP = PODIUM + TFLOORS.length * FLOOR_H;

function TowerFloor({ i, agents, run, hovered, onHover, onEnter }) {
  const inner = useRef();
  const st = agents.map((a) => run.agents[a]?.status || 'idle');
  const working = st.includes('working');
  const built = st.some((s) => s !== 'idle') || !!run.report;
  const color = agents.length > 1 ? (run.agents.bear?.status === 'working' && run.agents.bull?.status !== 'working' ? AGENTS.bear.color : AGENTS.bull.color) : AGENTS[agents[0]].color;
  useFrame((s, dt) => {
    if (!inner.current) return;
    const target = working ? 1.6 + Math.sin(s.clock.elapsedTime * 4) * 0.3 : built ? 0.9 : 0.15;
    inner.current.emissiveIntensity += (target - inner.current.emissiveIntensity) * Math.min(1, dt * 3);
    inner.current.emissive.set(working ? color : '#ffe1b3');
  });
  const y = PODIUM + i * FLOOR_H;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(TW + 1.4, FLOOR_H - 0.4, TW + 1.4)), []);
  return (
    <group position={[0, y, 0]}>
      {/* One invisible hit box per floor. Events still reach it when another building is in front,
          and the parent debounces leave events so the highlight never flickers. */}
      <mesh position={[0, FLOOR_H / 2 + 0.4, 0]}
        onPointerOver={(e) => { e.stopPropagation(); onHover(i); }}
        onPointerMove={(e) => { e.stopPropagation(); onHover(i); }}
        onPointerOut={() => onHover(null, i)}
        onClick={(e) => { e.stopPropagation(); onEnter(i); }}>
        <boxGeometry args={[TW + 1.6, FLOOR_H, TW + 1.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hovered && (
        <>
          {agents.map((a, k) => (
            <mesh key={a} position={[agents.length > 1 ? (k ? TW / 4 + 0.33 : -TW / 4 - 0.33) : 0, FLOOR_H / 2 + 0.6, 0]}>
              <boxGeometry args={[agents.length > 1 ? TW / 2 + 0.65 : TW + 1.3, FLOOR_H - 0.5, TW + 1.3]} />
              <meshBasicMaterial color={AGENTS[a].color} transparent opacity={0.42} depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
          <lineSegments position={[0, FLOOR_H / 2 + 0.6, 0]} geometry={edges}><lineBasicMaterial color={AGENTS[agents[0]].color} toneMapped={false} /></lineSegments>
          <Html position={[TW / 2 + 1.5, FLOOR_H / 2 + 0.6, TW / 2]} zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
            <div className="floor-hover" style={{ '--fc': AGENTS[agents[0]].color, '--fc2': AGENTS[agents[agents.length - 1]].color }}>
              <span className="fh-no">Floor {i + 1}</span>
              <b>{agents.map((a) => AGENTS[a].name).join(' and ')}</b>
              <span>{st.includes('working') ? 'Working now' : st.every((x) => x === 'done') ? 'Done' : st.includes('waiting') ? 'Supervising' : AGENTS[agents[0]].role}</span>
              <em>Go in</em>
            </div>
          </Html>
        </>
      )}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow><boxGeometry args={[TW + 0.3, 1.2, TW + 0.3]} /><meshStandardMaterial color="#d8dcdf" roughness={0.5} metalness={0.2} /></mesh>
      {/* lit interior seen through the glass */}
      <mesh position={[0, FLOOR_H / 2 + 0.6, 0]}><boxGeometry args={[TW - 1.5, FLOOR_H - 1.4, TW - 1.5]} /><meshStandardMaterial ref={inner} color="#2d3238" emissive="#ffe1b3" emissiveIntensity={0.15} roughness={1} /></mesh>
      {/* curtain wall */}
      <mesh position={[0, FLOOR_H / 2 + 0.6, 0]}>
        <boxGeometry args={[TW, FLOOR_H - 1.2, TW]} />
        <meshStandardMaterial color="#9fb6c8" roughness={0.04} metalness={0.85} transparent opacity={0.55} envMapIntensity={1.6} />
      </mesh>
      {Array.from({ length: 9 }, (_, k) => (k - 4) * (TW / 8)).map((x, k) => (
        <React.Fragment key={k}>
          <mesh position={[x, FLOOR_H / 2 + 0.6, TW / 2 + 0.05]}><boxGeometry args={[0.22, FLOOR_H - 1.2, 0.3]} /><meshStandardMaterial color="#c8ced3" metalness={0.6} roughness={0.35} /></mesh>
          <mesh position={[TW / 2 + 0.05, FLOOR_H / 2 + 0.6, x]}><boxGeometry args={[0.3, FLOOR_H - 1.2, 0.22]} /><meshStandardMaterial color="#c8ced3" metalness={0.6} roughness={0.35} /></mesh>
        </React.Fragment>
      ))}
    </group>
  );
}

function ResearchTower({ run, company, onEnter }) {
  const [hover, setHover] = useState(false);
  const [hoverFloor, setHoverFloorRaw] = useState(null);
  const leaveTimer = useRef(null);
  // Enter = immediate. Leave = after a short grace period, cancelled if the pointer comes back.
  const setHoverFloor = (i, from) => {
    clearTimeout(leaveTimer.current);
    if (i != null) { setHoverFloorRaw(i); document.body.style.cursor = 'pointer'; return; }
    leaveTimer.current = setTimeout(() => { setHoverFloorRaw((h) => (from == null || h === from ? null : h)); document.body.style.cursor = ''; }, 180);
  };
  const beacon = useRef();
  const running = run.status === 'running';
  useFrame((s) => { if (beacon.current) beacon.current.emissiveIntensity = Math.sin(s.clock.elapsedTime * (running ? 6 : 2)) > 0 ? 4 : 0.3; });
  return (
    <group onClick={(e) => { e.stopPropagation(); onEnter(busyFloor(run)); }} onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
      {/* plaza */}
      <mesh position={[0, 0.15, 0]} receiveShadow><boxGeometry args={[3 * (BX + ST) - ST, 0.3, 3 * (BZ + ST) - ST]} /><meshStandardMaterial color="#cfcac0" roughness={0.9} /></mesh>
      {/* stone podium with lobby */}
      <mesh position={[0, PODIUM / 2, 0]} castShadow receiveShadow material={[facadeMaterial('stone', 2, TW + 8, PODIUM), facadeMaterial('stone', 2, TW + 8, PODIUM), roofMaterial(), roofMaterial(), facadeMaterial('stone', 2, TW + 8, PODIUM), facadeMaterial('stone', 2, TW + 8, PODIUM)]}>
        <boxGeometry args={[TW + 8, PODIUM, TW + 8]} />
      </mesh>
      <mesh position={[0, 3.2, (TW + 8) / 2 + 0.05]}><planeGeometry args={[12, 6.2]} /><meshStandardMaterial color="#1e2a33" emissive="#ffd9a0" emissiveIntensity={0.5} roughness={0.2} metalness={0.6} /></mesh>
      {TFLOORS.map((a, i) => <TowerFloor key={i} i={i} agents={a} run={run} hovered={hoverFloor === i} onHover={setHoverFloor} onEnter={onEnter} />)}
      {/* crown */}
      <mesh position={[0, TTOP + 0.8, 0]} castShadow><boxGeometry args={[TW + 0.4, 1.6, TW + 0.4]} /><meshStandardMaterial color="#d8dcdf" roughness={0.5} metalness={0.2} /></mesh>
      <mesh position={[0, TTOP + 7, 0]} castShadow><boxGeometry args={[TW * 0.72, 11, TW * 0.72]} /><meshStandardMaterial color="#8ea4b5" roughness={0.08} metalness={0.85} envMapIntensity={1.6} /></mesh>
      <mesh position={[0, TTOP + 15.5, 0]} castShadow><boxGeometry args={[TW * 0.42, 6, TW * 0.42]} /><meshStandardMaterial color="#8ea4b5" roughness={0.08} metalness={0.85} envMapIntensity={1.6} /></mesh>
      <mesh position={[0, TTOP + 30, 0]} castShadow><cylinderGeometry args={[0.25, 1.1, 23, 10]} /><meshStandardMaterial color="#cfd5da" metalness={0.8} roughness={0.25} /></mesh>
      <mesh position={[0, TTOP + 42, 0]}><sphereGeometry args={[0.7, 12, 10]} /><meshStandardMaterial ref={beacon} color="#ff3b30" emissive="#ff3b30" emissiveIntensity={2} /></mesh>
      <Html position={[0, PODIUM + 2, (TW + 8) / 2]} center zIndexRange={[10, 0]}>
        <button className={`entry ${hover ? 'hover' : ''}`} onClick={(e) => { e.stopPropagation(); onEnter(busyFloor(run)); }} onPointerDown={(e) => e.stopPropagation()}>
          <b>{company?.name}</b>
          <span>{running ? 'The team is working. Click a floor to go in' : 'Click a floor to go in'}</span>
        </button>
      </Html>
    </group>
  );
}

function AimOnce({ controls }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !controls.current) return;
    controls.current.setLookAt(150, 62, 210, 22, 58, 0, false);
    done.current = true;
  });
  return null;
}

export function SkyAndLight({ shadowSize = 220 }) {
  const cloudURL = useMemo(() => cloudTextureURL(), []);
  return (
    <>
      <Sky distance={4500} sunPosition={SUN} turbidity={4.5} rayleigh={1.1} mieCoefficient={0.004} mieDirectionalG={0.86} />
      <fog attach="fog" args={['#c9d6e0', 260, 820]} />
      <hemisphereLight args={['#cfe2f5', '#6d6a63', 0.9]} />
      <directionalLight position={SUN} intensity={2.6} color="#fff0d8" castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-shadowSize} shadow-camera-right={shadowSize} shadow-camera-top={shadowSize} shadow-camera-bottom={-shadowSize} shadow-camera-far={700} shadow-bias={-0.0005} />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#b7cde0']} />
        <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[60, 30, 60]} scale={[160, 50, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#d6e7f7" position={[-80, 80, -40]} scale={[200, 80, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#8d8a84" rotation-x={Math.PI / 2} position={[0, -30, 0]} scale={[300, 300, 1]} />
      </Environment>
      <Clouds material={THREE.MeshLambertMaterial} texture={cloudURL} limit={240}>
        <Cloud seed={2} segments={36} bounds={[90, 10, 30]} volume={40} color="#ffffff" position={[-180, 190, -420]} opacity={0.9} speed={0.08} />
        <Cloud seed={5} segments={30} bounds={[70, 8, 26]} volume={34} color="#fff8ef" position={[200, 210, -380]} opacity={0.85} speed={0.06} />
        <Cloud seed={9} segments={26} bounds={[60, 8, 20]} volume={28} color="#ffffff" position={[30, 240, -520]} opacity={0.8} speed={0.05} />
        <Cloud seed={13} segments={22} bounds={[50, 6, 18]} volume={24} color="#f6f4f0" position={[-320, 170, -200]} opacity={0.8} speed={0.07} />
        <Cloud seed={21} segments={22} bounds={[55, 6, 18]} volume={24} color="#ffffff" position={[340, 180, -150]} opacity={0.75} speed={0.06} />
      </Clouds>
    </>
  );
}

export default function Exterior({ run, company, onEnter }) {
  const controls = useRef();
  const city = useCity();
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [150, 62, 210], fov: 36, near: 1, far: 5000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}>
      <SkyAndLight />
      <Streets />
      {city.map((b, i) => <Building key={i} b={b} />)}
      <Cabs />
      <ResearchTower run={run} company={company} onEnter={onEnter} />
      <AimOnce controls={controls} />
      <CameraControls ref={controls} makeDefault minDistance={60} maxDistance={420} minPolarAngle={0.3} maxPolarAngle={1.45} dollySpeed={0.5} />
    </Canvas>
  );
}
