import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { AGENTS } from '../agents.js';
import { SkyAndLight, TFLOORS } from './Exterior.jsx';
import { facadeMaterial, roofMaterial, woodTexture } from './textures.js';

// Each floor of the tower has its own agent (Bull and Bear share floor 3). Seats face the windows (-z),
// so the camera looks over their shoulder at the screen.
const LOOK = {
  researcher: { skin: '#c99a76', shirt: '#2f4a6b' }, kpi: { skin: '#8d5a3c', shirt: '#d9d4c8' },
  bull: { skin: '#e4bf9c', shirt: '#3d4a3a' }, bear: { skin: '#b07a55', shirt: '#5a2f2f' },
  skeptic: { skin: '#f0cfae', shirt: '#4b4f55' }, editor: { skin: '#6e4630', shirt: '#7a6a55' },
  genesis: { skin: '#d8ad88', shirt: '#1f2328' },
};
function seatsFor(floor) {
  const ids = TFLOORS[floor] || TFLOORS[TFLOORS.length - 1];
  return ids.map((id, k) => ({ id, x: ids.length > 1 ? (k ? 1.3 : -1.3) : 0, z: 0, ...LOOK[id] }));
}
const DESKS = [[-9.2, 0], [-4.6, 0], [4.6, 0], [9.2, 0], [-9.2, -4.4], [-4.6, -4.4], [0, -4.4], [4.6, -4.4], [9.2, -4.4], [-9.2, 4.2], [-4.6, 4.2], [4.6, 4.2], [9.2, 4.2]];
const EMPTY = new Set([3, 10]);
const SKINS = ['#f1d2b6', '#e0b08a', '#c68e65', '#9c6a48', '#6f4a33', '#4a3226', '#f5dcc4'];
const SHIRTS = ['#e9e7e1', '#2e3b4e', '#6b7a8f', '#8a5a44', '#3f5a48', '#b9b4a8', '#1f2328', '#7e8c99', '#a0484a'];
const HAIRS = ['#1c1714', '#3b2a1e', '#6b4a2f', '#a8875a', '#2b2b2b', '#8c8c8c'];
const lookFor = (i) => ({ skin: SKINS[(i * 3) % SKINS.length], shirt: SHIRTS[(i * 5) % SHIRTS.length], hair: HAIRS[(i * 7) % HAIRS.length] });

// Coworker screens: charts and sheets, drawn once.
const screenTex = [];
function coworkerScreen(i) {
  const k = i % 4;
  if (screenTex[k]) return screenTex[k];
  const c = document.createElement('canvas'); c.width = 256; c.height = 150;
  const g = c.getContext('2d');
  g.fillStyle = k % 2 ? '#0d1218' : '#f4f5f7'; g.fillRect(0, 0, 256, 150);
  const ink = k % 2 ? '#8fd3ff' : '#2e5e8c';
  g.fillStyle = k % 2 ? '#1c2633' : '#dde3ea'; g.fillRect(0, 0, 256, 14);
  if (k === 0 || k === 2) { // spreadsheet
    g.strokeStyle = k % 2 ? '#22303f' : '#cfd6de';
    for (let y = 22; y < 150; y += 11) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    for (let x = 40; x < 256; x += 54) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, 150); g.stroke(); }
    g.fillStyle = ink; for (let y = 25; y < 150; y += 11) for (let x = 46; x < 256; x += 54) g.fillRect(x, y, 14 + ((x * y) % 26), 4);
  } else { // chart
    g.strokeStyle = ink; g.lineWidth = 2; g.beginPath();
    for (let x = 10; x < 246; x += 6) { const y = 110 - (x / 3) * 0.6 - Math.sin(x / 13 + k) * 14; x === 10 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    g.fillStyle = k % 2 ? '#5fe0a066' : '#1d7a4e66'; for (let x = 14; x < 246; x += 16) g.fillRect(x, 140 - ((x * 7) % 30), 9, (x * 7) % 30);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (screenTex[k] = t);
}

function CoworkerDesk({ x, z, i, wood, empty }) {
  const look = useMemo(() => lookFor(i), [i]);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.74, -0.75]} castShadow receiveShadow><boxGeometry args={[1.8, 0.05, 0.85]} /><meshStandardMaterial map={wood} roughness={0.6} /></mesh>
      {[[-0.85, -1.12], [0.85, -1.12], [-0.85, -0.38], [0.85, -0.38]].map(([a, b], k) => <mesh key={k} position={[a, 0.37, b]}><boxGeometry args={[0.05, 0.74, 0.05]} /><meshStandardMaterial color="#2c2f33" /></mesh>)}
      <mesh position={[0, 1.02, -1.2]} castShadow><boxGeometry args={[1.8, 0.55, 0.04]} /><meshStandardMaterial color="#9da7ae" roughness={0.9} /></mesh>
      <mesh position={[0, 0.775, -0.55]}><boxGeometry args={[0.46, 0.02, 0.15]} /><meshStandardMaterial color="#d9dadb" /></mesh>
      <group position={[0, 1.28, -0.95]}>
        <mesh position={[0, -0.24, -0.04]}><boxGeometry args={[0.06, 0.32, 0.06]} /><meshStandardMaterial color="#3a3d41" metalness={0.6} /></mesh>
        <mesh castShadow><boxGeometry args={[1.32, 0.78, 0.05]} /><meshStandardMaterial color="#141619" roughness={0.4} /></mesh>
        {!empty && <mesh position={[0, 0, 0.027]}><planeGeometry args={[1.28, 0.74]} /><meshBasicMaterial map={coworkerScreen(i)} toneMapped={false} /></mesh>}
      </group>
      {i % 3 === 0 && <mesh position={[0.6, 0.82, -0.5]}><cylinderGeometry args={[0.04, 0.04, 0.1, 12]} /><meshStandardMaterial color="#e9e4da" /></mesh>}
      {empty
        ? <><mesh position={[0, 0.48, 0.05]} castShadow><boxGeometry args={[0.55, 0.08, 0.52]} /><meshStandardMaterial color="#26292d" /></mesh><mesh position={[0, 0.95, 0.32]} castShadow><boxGeometry args={[0.52, 0.8, 0.07]} /><meshStandardMaterial color="#26292d" /></mesh></>
        : <Person seat={{ x: x + z, ...look }} busy={i} />}
    </group>
  );
}

// A standing person who walks a loop through the aisles.
function Walker({ path, i, speed = 1.05, offset = 0, carry }) {
  const look = useMemo(() => lookFor(i + 3), [i]);
  const g = useRef(), lL = useRef(), lR = useRef(), aL = useRef(), aR = useRef();
  const segs = useMemo(() => {
    const out = []; let total = 0;
    for (let k = 0; k < path.length; k++) { const a = path[k], b = path[(k + 1) % path.length]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); out.push({ a, b, len, start: total }); total += len; }
    return { out, total };
  }, [path]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    let d = (t * speed + offset) % segs.total;
    const sg = segs.out.find((x) => d >= x.start && d < x.start + x.len) || segs.out[0];
    const f = (d - sg.start) / sg.len;
    const dx = sg.b[0] - sg.a[0], dz = sg.b[1] - sg.a[1];
    g.current.position.set(sg.a[0] + dx * f, Math.abs(Math.sin(t * speed * 3.2)) * 0.03, sg.a[1] + dz * f);
    g.current.rotation.y = Math.atan2(-dx, -dz);
    const sw = Math.sin(t * speed * 3.2) * 0.5;
    lL.current.rotation.x = sw; lR.current.rotation.x = -sw;
    aL.current.rotation.x = -sw * 0.7; aR.current.rotation.x = carry ? -0.9 : sw * 0.7;
  });
  return (
    <group ref={g}>
      <group ref={lL} position={[-0.1, 0.9, 0]}><mesh position={[0, -0.43, 0]} castShadow><capsuleGeometry args={[0.08, 0.66, 4, 8]} /><meshStandardMaterial color="#2d2f33" /></mesh></group>
      <group ref={lR} position={[0.1, 0.9, 0]}><mesh position={[0, -0.43, 0]} castShadow><capsuleGeometry args={[0.08, 0.66, 4, 8]} /><meshStandardMaterial color="#2d2f33" /></mesh></group>
      <mesh position={[0, 1.26, 0]} castShadow><capsuleGeometry args={[0.2, 0.46, 6, 12]} /><meshStandardMaterial color={look.shirt} roughness={0.85} /></mesh>
      <group position={[0, 1.74, 0]}>
        <mesh castShadow><sphereGeometry args={[0.135, 20, 16]} /><meshStandardMaterial color={look.skin} roughness={0.7} /></mesh>
        <mesh position={[0, 0.06, 0.03]}><sphereGeometry args={[0.14, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.1]} /><meshStandardMaterial color={look.hair} roughness={0.9} /></mesh>
        <Face skin={look.skin} seed={i * 3} hair={look.hair} />
      </group>
      <group ref={aL} position={[-0.27, 1.5, 0]}><mesh position={[0, -0.27, 0]} castShadow><capsuleGeometry args={[0.06, 0.46, 4, 8]} /><meshStandardMaterial color={look.shirt} roughness={0.85} /></mesh></group>
      <group ref={aR} position={[0.27, 1.5, 0]}>
        <mesh position={[0, -0.27, 0]} castShadow><capsuleGeometry args={[0.06, 0.46, 4, 8]} /><meshStandardMaterial color={look.shirt} roughness={0.85} /></mesh>
        {carry === 'coffee' && <mesh position={[0, -0.55, -0.04]}><cylinderGeometry args={[0.045, 0.04, 0.12, 12]} /><meshStandardMaterial color="#f3f0ea" /></mesh>}
        {carry === 'laptop' && <mesh position={[0, -0.5, -0.12]} rotation-x={-0.2}><boxGeometry args={[0.36, 0.025, 0.26]} /><meshStandardMaterial color="#b9bec4" metalness={0.6} roughness={0.3} /></mesh>}
      </group>
    </group>
  );
}

// Meeting corner: three people around a table, turning to whoever is talking.
function Meeting({ wood }) {
  const cx = -14.5, cz = -8;
  const seats = [0, 2.1, 4.2].map((a, k) => ({ x: cx + Math.sin(a) * 1.55, z: cz + Math.cos(a) * 1.55, k }));
  return (
    <group>
      <mesh position={[cx, 0.74, cz]} castShadow receiveShadow><cylinderGeometry args={[1.05, 1.05, 0.05, 32]} /><meshStandardMaterial map={wood} roughness={0.6} /></mesh>
      <mesh position={[cx, 0.37, cz]}><cylinderGeometry args={[0.08, 0.3, 0.74, 12]} /><meshStandardMaterial color="#2c2f33" /></mesh>
      <mesh position={[cx + 0.3, 0.77, cz - 0.1]} rotation-y={0.4}><boxGeometry args={[0.36, 0.02, 0.26]} /><meshStandardMaterial color="#b9bec4" metalness={0.6} roughness={0.3} /></mesh>
      {seats.map((p) => (
        <group key={p.k} position={[p.x, 0, p.z]} rotation-y={Math.atan2(-(cx - p.x), -(cz - p.z))}>
          <Person seat={{ x: p.k * 2.7, ...lookFor(20 + p.k) }} working={false} />
        </group>
      ))}
    </group>
  );
}

function CoffeeAndBoard() {
  const board = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#fbfbfa'; g.fillRect(0, 0, 512, 256);
    g.lineWidth = 4; g.strokeStyle = '#2e5e8c'; g.strokeRect(30, 40, 120, 60); g.strokeRect(200, 40, 120, 60); g.strokeRect(370, 40, 110, 60);
    g.beginPath(); g.moveTo(150, 70); g.lineTo(200, 70); g.moveTo(320, 70); g.lineTo(370, 70); g.stroke();
    g.strokeStyle = '#1d7a4e'; g.beginPath(); g.moveTo(40, 220); for (let x = 40; x < 480; x += 20) g.lineTo(x, 220 - x * 0.18 - Math.sin(x / 30) * 12); g.stroke();
    g.strokeStyle = '#b8352f'; g.beginPath(); g.arc(420, 180, 28, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return (
    <group>
      <mesh position={[-19.8, 2.0, -1]} rotation-y={Math.PI / 2}><boxGeometry args={[4.4, 2.0, 0.06]} /><meshStandardMaterial map={board} roughness={0.4} /></mesh>
      <group position={[15.5, 0, 10.4]}>
        <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[3.2, 1.0, 0.8]} /><meshStandardMaterial color="#e6e2da" /></mesh>
        <mesh position={[-0.8, 1.3, 0]} castShadow><boxGeometry args={[0.55, 0.6, 0.45]} /><meshStandardMaterial color="#2b2e33" metalness={0.5} roughness={0.35} /></mesh>
        {[0.2, 0.45, 0.7].map((x) => <mesh key={x} position={[x, 1.06, 0.1]}><cylinderGeometry args={[0.045, 0.04, 0.11, 12]} /><meshStandardMaterial color="#f3f0ea" /></mesh>)}
      </group>
    </group>
  );
}

const AISLE = [[-15.5, 2.2], [15.5, 2.2], [15.5, -2.15], [-15.5, -2.15]];
const SIDE = [[-16.8, 9], [-16.8, -5], [-11, -5], [-11, 9]];


function lines(a) {
  const out = [...(a?.logs || []).slice(-3).map((l) => `> ${l}`)];
  const s = (a?.stream || '').split('\n').filter(Boolean).slice(-8);
  return [...out, ...s].slice(-9);
}

function Screen({ seat, agent, picked, onPick }) {
  const m = AGENTS[seat.id];
  const st = agent?.status || 'idle';
  return (
    <Html transform position={[0, 0, 0.031]} scale={0.107} zIndexRange={[20, 0]} occlude={false}>
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

// Simple face: eyes that blink, brows, nose, mouth. Faces -z (the direction people look).
function Face({ skin, seed = 0, hair = '#2a211b' }) {
  const eyes = useRef();
  useFrame((st) => { if (eyes.current) eyes.current.scale.y = (st.clock.elapsedTime + seed * 1.7) % 4.3 < 0.13 ? 0.1 : 1; });
  return (
    <group>
      <group ref={eyes}>
        <mesh position={[-0.047, 0.02, -0.121]}><sphereGeometry args={[0.019, 10, 8]} /><meshStandardMaterial color="#17191c" roughness={0.25} /></mesh>
        <mesh position={[0.047, 0.02, -0.121]}><sphereGeometry args={[0.019, 10, 8]} /><meshStandardMaterial color="#17191c" roughness={0.25} /></mesh>
      </group>
      <mesh position={[-0.048, 0.062, -0.122]} rotation-z={0.12}><boxGeometry args={[0.052, 0.012, 0.012]} /><meshStandardMaterial color={hair} /></mesh>
      <mesh position={[0.048, 0.062, -0.122]} rotation-z={-0.12}><boxGeometry args={[0.052, 0.012, 0.012]} /><meshStandardMaterial color={hair} /></mesh>
      <mesh position={[0, -0.012, -0.133]}><sphereGeometry args={[0.02, 10, 8]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
      <mesh position={[0, -0.058, -0.124]}><boxGeometry args={[0.048, 0.011, 0.01]} /><meshStandardMaterial color="#7a3b33" /></mesh>
    </group>
  );
}

function Person({ seat, working, busy }) {
  const body = useRef(), armL = useRef(), armR = useRef(), head = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime + seat.x;
    // coworkers type in bursts, then pause and look around
    if (busy != null) working = Math.sin(s.clock.elapsedTime * 0.32 + busy * 2.1) > -0.35;
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
          <mesh position={[0, 0.06, 0.03]}><sphereGeometry args={[0.14, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.1]} /><meshStandardMaterial color={seat.hair || '#2a211b'} roughness={0.9} /></mesh>
          <Face skin={seat.skin} seed={seat.x} hair={seat.hair || '#2a211b'} />
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

function EmptyDesk({ x, z, wood }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.74, -0.75]} castShadow receiveShadow><boxGeometry args={[1.8, 0.05, 0.85]} /><meshStandardMaterial map={wood} roughness={0.6} /></mesh>
      {[[-0.85, -1.12], [0.85, -1.12], [-0.85, -0.38], [0.85, -0.38]].map(([a, b], i) => <mesh key={i} position={[a, 0.37, b]}><boxGeometry args={[0.05, 0.74, 0.05]} /><meshStandardMaterial color="#2c2f33" /></mesh>)}
      <mesh position={[0, 1.28, -0.95]} castShadow><boxGeometry args={[1.32, 0.78, 0.05]} /><meshStandardMaterial color="#141619" roughness={0.4} /></mesh>
      <mesh position={[0, 0.48, 0.05]} castShadow><boxGeometry args={[0.55, 0.08, 0.52]} /><meshStandardMaterial color="#26292d" /></mesh>
      <mesh position={[0, 0.95, 0.32]} castShadow><boxGeometry args={[0.52, 0.8, 0.07]} /><meshStandardMaterial color="#26292d" /></mesh>
    </group>
  );
}

// Moves the camera: an overview of the floor, or close up on one screen.
function CameraDirector({ controls, seats, zoom }) {
  const want = useRef(null);
  const key = `${seats.map((s) => s.id).join()}|${zoom || ''}`;
  const last = useRef('');
  if (key !== last.current) {
    last.current = key;
    const z = seats.find((s) => s.id === zoom);
    if (z) want.current = [z.x + 0.55, 1.8, 0.95, z.x, 1.3, -0.95];
    else {
      const cx = seats.reduce((a, s) => a + s.x, 0) / seats.length;
      want.current = [cx + 1.6, 2.3, seats.length > 1 ? 4.6 : 3.6, cx, 1.15, -1.0];
    }
  }
  const first = useRef(true);
  useFrame(() => {
    if (!want.current || !controls.current) return;
    controls.current.setLookAt(...want.current, !first.current);
    first.current = false;
    want.current = null;
  });
  return null;
}

export default function Office({ run, floor, picked, onPick }) {
  const controls = useRef();
  const wood = useMemo(() => woodTexture(), []);
  const seats = useMemo(() => seatsFor(floor), [floor]);
  const [zoom, setZoom] = React.useState(null);
  React.useEffect(() => setZoom(null), [floor]);
  const clickScreen = (id) => { setZoom((z) => (z === id ? null : id)); onPick(id); };
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [1.6, 2.3, 3.6], fov: 55, near: 0.05, far: 5000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      onPointerMissed={() => setZoom(null)}>
      <SkyAndLight shadowSize={30} />
      <ambientLight intensity={0.35} />
      <Room />
      <View />
      {DESKS.map(([x, z], i) => <CoworkerDesk key={i} x={x} z={z} i={i} wood={wood} empty={EMPTY.has(i)} />)}
      <Meeting wood={wood} />
      <CoffeeAndBoard />
      <Walker path={AISLE} i={1} offset={0} carry="coffee" />
      <Walker path={AISLE} i={2} offset={31} speed={0.95} carry="laptop" />
      <Walker path={AISLE} i={5} offset={58} speed={1.15} />
      <Walker path={SIDE} i={7} offset={5} speed={0.9} carry="coffee" />
      {seats.map((s) => <Workstation key={s.id} seat={s} run={run} picked={picked === s.id} onPick={clickScreen} wood={wood} />)}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={40} blur={2.2} far={3} />
      <CameraDirector controls={controls} seats={seats} zoom={zoom} />
      <CameraControls ref={controls} makeDefault minDistance={0.6} maxDistance={12} minPolarAngle={0.6} maxPolarAngle={1.62} dollySpeed={0.6} truckSpeed={1} />
    </Canvas>
  );
}
