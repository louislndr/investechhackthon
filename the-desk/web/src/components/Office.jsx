import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { AGENTS } from '../agents.js';
import { SkyAndLight } from './Exterior.jsx';
import { facadeMaterial, roofMaterial, woodTexture } from './textures.js';

// Open-plan floor. Everyone faces the windows, so from the camera you look over their shoulders at their screens.
const SEATS = [
  { id: 'researcher', x: -10.2, z: 1.8, skin: '#c99a76', shirt: '#2f4a6b' },
  { id: 'kpi', x: -6.6, z: 1.8, skin: '#8d5a3c', shirt: '#d9d4c8' },
  { id: 'bull', x: -3.0, z: 1.8, skin: '#e4bf9c', shirt: '#3d4a3a' },
  { id: 'bear', x: 0.6, z: 1.8, skin: '#b07a55', shirt: '#5a2f2f' },
  { id: 'skeptic', x: -8.4, z: -2.6, skin: '#f0cfae', shirt: '#4b4f55' },
  { id: 'editor', x: -4.8, z: -2.6, skin: '#6e4630', shirt: '#7a6a55' },
  { id: 'genesis', x: -1.2, z: -2.6, skin: '#d8ad88', shirt: '#1f2328' },
];

function lines(a) {
  const out = [...(a?.logs || []).slice(-3).map((l) => `> ${l}`)];
  const s = (a?.stream || '').split('\n').filter(Boolean).slice(-8);
  return [...out, ...s].slice(-9);
}

function Screen({ seat, agent, picked, onPick }) {
  const m = AGENTS[seat.id];
  const st = agent?.status || 'idle';
  return (
    <Html transform position={[0, 0, 0.031]} scale={0.32} zIndexRange={[20, 0]} occlude={false}>
      <div className={`screen st-${st} ${picked ? 'picked' : ''}`} style={{ '--c': m.color }} onClick={(e) => { e.stopPropagation(); onPick(seat.id); }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="screen-bar"><b>{m.name}</b><span>{st === 'waiting' ? 'supervising' : st === 'idle' ? 'waiting for work' : st}</span></div>
        <div className="screen-body">
          {st === 'idle' ? <div className="screen-idle">{m.role}</div> : lines(agent).map((l, i) => <div key={i}>{l}</div>)}
          {st === 'working' && <span className="screen-cursor">▍</span>}
        </div>
      </div>
    </Html>
  );
}

function Person({ seat, working }) {
  const body = useRef(), armL = useRef(), armR = useRef(), head = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime + seat.x;
    if (armL.current) armL.current.rotation.x = 1.25 + (working ? Math.sin(t * 16) * 0.08 : 0);
    if (armR.current) armR.current.rotation.x = 1.25 + (working ? Math.sin(t * 16 + 1.7) * 0.08 : 0);
    if (head.current) { head.current.rotation.x = working ? -0.15 + Math.sin(t * 1.3) * 0.04 : 0.05; head.current.rotation.y = working ? 0 : Math.sin(t * 0.4) * 0.35; }
    if (body.current) body.current.rotation.x = working ? -0.12 : 0.06;
  });
  return (
    <group>
      {/* chair */}
      <mesh position={[0, 0.48, 0.05]} castShadow><boxGeometry args={[0.55, 0.08, 0.52]} /><meshStandardMaterial color="#26292d" roughness={0.7} /></mesh>
      <mesh position={[0, 0.95, 0.32]} castShadow><boxGeometry args={[0.52, 0.8, 0.07]} /><meshStandardMaterial color="#26292d" roughness={0.7} /></mesh>
      <mesh position={[0, 0.24, 0.05]}><cylinderGeometry args={[0.04, 0.04, 0.45, 8]} /><meshStandardMaterial color="#5c6066" metalness={0.7} roughness={0.3} /></mesh>
      {/* person */}
      <group ref={body} position={[0, 0.55, 0.05]}>
        <mesh position={[0, 0.38, 0]} castShadow><capsuleGeometry args={[0.2, 0.42, 6, 12]} /><meshStandardMaterial color={seat.shirt} roughness={0.85} /></mesh>
        <group ref={head} position={[0, 0.88, -0.02]}>
          <mesh castShadow><sphereGeometry args={[0.135, 20, 16]} /><meshStandardMaterial color={seat.skin} roughness={0.7} /></mesh>
          <mesh position={[0, 0.06, 0.03]}><sphereGeometry args={[0.14, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.1]} /><meshStandardMaterial color="#2a211b" roughness={0.9} /></mesh>
        </group>
        <group ref={armL} position={[-0.25, 0.55, 0]}><mesh position={[0, -0.22, 0]} castShadow><capsuleGeometry args={[0.06, 0.38, 4, 8]} /><meshStandardMaterial color={seat.shirt} roughness={0.85} /></mesh></group>
        <group ref={armR} position={[0.25, 0.55, 0]}><mesh position={[0, -0.22, 0]} castShadow><capsuleGeometry args={[0.06, 0.38, 4, 8]} /><meshStandardMaterial color={seat.shirt} roughness={0.85} /></mesh></group>
      </group>
      {/* legs */}
      <mesh position={[-0.1, 0.55, -0.2]} rotation-x={Math.PI / 2} castShadow><capsuleGeometry args={[0.075, 0.38, 4, 8]} /><meshStandardMaterial color="#2d2f33" /></mesh>
      <mesh position={[0.1, 0.55, -0.2]} rotation-x={Math.PI / 2} castShadow><capsuleGeometry args={[0.075, 0.38, 4, 8]} /><meshStandardMaterial color="#2d2f33" /></mesh>
    </group>
  );
}

function Workstation({ seat, run, picked, onPick, wood }) {
  const agent = run.agents[seat.id];
  const working = agent?.status === 'working';
  const glow = useRef();
  useFrame((s, dt) => {
    if (!glow.current) return;
    const target = working ? 1.6 + Math.sin(s.clock.elapsedTime * 3) * 0.3 : picked ? 0.8 : 0;
    glow.current.intensity += (target - glow.current.intensity) * Math.min(1, dt * 4);
  });
  return (
    <group position={[seat.x, 0, seat.z]}>
      {/* desk: everyone faces -z (the windows) */}
      <mesh position={[0, 0.74, -0.75]} castShadow receiveShadow><boxGeometry args={[1.8, 0.05, 0.85]} /><meshStandardMaterial map={wood} roughness={0.6} /></mesh>
      {[[-0.85, -1.12], [0.85, -1.12], [-0.85, -0.38], [0.85, -0.38]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.37, z]}><boxGeometry args={[0.05, 0.74, 0.05]} /><meshStandardMaterial color="#2c2f33" metalness={0.6} roughness={0.4} /></mesh>
      ))}
      <mesh position={[0, 1.02, -1.2]} castShadow><boxGeometry args={[1.8, 0.55, 0.04]} /><meshStandardMaterial color="#9da7ae" roughness={0.9} /></mesh>
      {/* keyboard, mug */}
      <mesh position={[0, 0.775, -0.55]}><boxGeometry args={[0.46, 0.02, 0.15]} /><meshStandardMaterial color="#d9dadb" /></mesh>
      <mesh position={[0.55, 0.82, -0.55]}><cylinderGeometry args={[0.04, 0.04, 0.1, 12]} /><meshStandardMaterial color={['#e9e4da', '#2f4a6b', '#7a2f2f'][Math.abs(Math.round(seat.x)) % 3]} /></mesh>
      {/* monitor, facing the person (+z) */}
      <group position={[0, 1.28, -0.95]} onClick={(e) => { e.stopPropagation(); onPick(seat.id); }}>
        <mesh position={[0, -0.24, -0.04]}><boxGeometry args={[0.06, 0.32, 0.06]} /><meshStandardMaterial color="#3a3d41" metalness={0.6} /></mesh>
        <mesh castShadow><boxGeometry args={[1.32, 0.78, 0.05]} /><meshStandardMaterial color="#141619" roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.027]}><planeGeometry args={[1.28, 0.74]} /><meshStandardMaterial color="#0d1014" emissive={AGENTS[seat.id].color} emissiveIntensity={working ? 0.06 : 0.02} /></mesh>
        <Screen seat={seat} agent={agent} picked={picked} onPick={onPick} />
        <pointLight ref={glow} position={[0, 0, 0.5]} distance={2.6} intensity={0} color={AGENTS[seat.id].color} />
      </group>
      <Person seat={seat} working={working} />
    </group>
  );
}

function Room() {
  const wood = useMemo(() => woodTexture(), []);
  const mullions = [];
  for (let x = -18; x <= 18; x += 3) mullions.push(x);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[40, 26]} /><meshStandardMaterial color="#bdb7ad" roughness={0.55} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -1]} receiveShadow><planeGeometry args={[30, 14]} /><meshStandardMaterial color="#5d6168" roughness={0.95} /></mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 4.2, 0]}><planeGeometry args={[40, 26]} /><meshStandardMaterial color="#e9e7e2" roughness={0.9} /></mesh>
      {[-12, -6, 0, 6, 12].map((x) => [-6, 0, 6].map((z) => (
        <mesh key={`${x}${z}`} rotation-x={Math.PI / 2} position={[x, 4.18, z]}><planeGeometry args={[3.6, 0.6]} /><meshStandardMaterial color="#ffffff" emissive="#fff6e8" emissiveIntensity={1.2} /></mesh>
      )))}
      {/* window wall (-z) and side windows */}
      {mullions.map((x) => <mesh key={x} position={[x, 2.1, -13]}><boxGeometry args={[0.12, 4.2, 0.12]} /><meshStandardMaterial color="#3a3e43" metalness={0.5} roughness={0.4} /></mesh>)}
      <mesh position={[0, 0.25, -13]}><boxGeometry args={[40, 0.5, 0.3]} /><meshStandardMaterial color="#3a3e43" /></mesh>
      {[-13, -7, -1, 5, 11].map((z) => <mesh key={z} position={[-20, 2.1, z]}><boxGeometry args={[0.12, 4.2, 0.12]} /><meshStandardMaterial color="#3a3e43" /></mesh>)}
      {[-13, -7, -1, 5, 11].map((z) => <mesh key={`r${z}`} position={[20, 2.1, z]}><boxGeometry args={[0.12, 4.2, 0.12]} /><meshStandardMaterial color="#3a3e43" /></mesh>)}
      {/* back wall with the company name */}
      <mesh position={[0, 2.1, 13]}><boxGeometry args={[40, 4.2, 0.2]} /><meshStandardMaterial color="#d8d3ca" roughness={0.9} /></mesh>
      {/* plants */}
      {[[-17, -11], [17, -11], [-17, 10]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.35, 0.28, 0.6, 16]} /><meshStandardMaterial color="#e6e1d8" /></mesh>
          <mesh position={[0, 1.2, 0]}><icosahedronGeometry args={[0.65, 1]} /><meshStandardMaterial color="#4f6b43" roughness={0.9} flatShading /></mesh>
        </group>
      ))}
    </group>
  );
}

// What you see out of the windows: the same city, seen from high up.
function View() {
  const blds = useMemo(() => {
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const out = [];
    for (let i = 0; i < 140; i++) {
      const ang = -Math.PI * 0.95 + r() * Math.PI * 0.9 + (r() < 0.3 ? Math.PI * 0.45 : 0);
      const dist = 170 + r() * 340;
      const kind = ['glass', 'stone', 'brick'][Math.floor(r() * 3)];
      out.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, w: 14 + r() * 14, d: 14 + r() * 14, h: 25 + r() * 95 * (1 - dist / 560), kind, seed: Math.floor(r() * 99) });
    }
    return out;
  }, []);
  return (
    <group position={[0, -95, 0]}>
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[1200, 1200]} /><meshStandardMaterial color="#6d6f70" roughness={1} /></mesh>
      {blds.map((b, i) => {
        const side = facadeMaterial(b.kind, b.seed, b.d, b.h), front = facadeMaterial(b.kind, b.seed, b.w, b.h), roof = roofMaterial();
        return <mesh key={i} position={[b.x, b.h / 2, b.z]} material={[side, side, roof, roof, front, front]}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>;
      })}
    </group>
  );
}

function AimOnce({ controls }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current || !controls.current) return;
    controls.current.setLookAt(-3.2, 2.7, 6.2, -4.6, 1.3, -2.6, false);
    done.current = true;
  });
  return null;
}

export default function Office({ run, picked, onPick }) {
  const controls = useRef();
  const wood = useMemo(() => woodTexture(), []);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [-3.2, 2.7, 6.2], fov: 55, near: 0.05, far: 5000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
      <SkyAndLight shadowSize={30} />
      <ambientLight intensity={0.35} />
      <Room />
      <View />
      {SEATS.map((s) => <Workstation key={s.id} seat={s} run={run} picked={picked === s.id} onPick={onPick} wood={wood} />)}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={40} blur={2.2} far={3} />
      <AimOnce controls={controls} />
      <CameraControls ref={controls} makeDefault minDistance={1.5} maxDistance={14} minPolarAngle={0.9} maxPolarAngle={1.62} dollySpeed={0.6} truckSpeed={1} />
    </Canvas>
  );
}
