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

// Coworker screens: drawn once per floor+variant.
const screenTex = {};
function coworkerScreen(floor, i) {
  const key = `${floor}_${i % 3}`;
  if (screenTex[key]) return screenTex[key];
  const c = document.createElement('canvas'); c.width = 256; c.height = 150;
  const g = c.getContext('2d');

  if (floor === 0) { // researcher — article / report text
    g.fillStyle = '#f8f7f4'; g.fillRect(0, 0, 256, 150);
    g.fillStyle = '#1a1a2e'; g.fillRect(0, 0, 256, 18);
    g.fillStyle = '#ffffff'; g.font = 'bold 8px monospace'; g.fillText('RESEARCH', 8, 13);
    g.fillStyle = '#d0ccc4'; g.fillRect(10, 26, 150 + (i % 3) * 20, 7);
    for (let y = 42; y < 148; y += 9) {
      g.fillStyle = '#c4c0b8';
      g.fillRect(10, y, 220 - (y % 27 === 0 ? 40 : y % 18 === 0 ? 20 : 0), 4);
    }
    g.fillStyle = '#f8f7f4'; g.fillRect(0, 78, 256, 5); g.fillRect(0, 115, 256, 5);
  } else if (floor === 1) { // kpi — bar chart + data table
    const dk = i % 2 === 0;
    g.fillStyle = dk ? '#0a1628' : '#f2f4f7'; g.fillRect(0, 0, 256, 150);
    g.fillStyle = dk ? '#1a2d4a' : '#e4e9f0'; g.fillRect(0, 0, 256, 16);
    g.fillStyle = dk ? '#7fd6ff' : '#1a4a8a'; g.font = 'bold 8px monospace'; g.fillText('KPI DASHBOARD', 8, 12);
    const cols = dk ? ['#5fe0a0','#7fd6ff','#ffd36b','#ff6b6b','#9fb4ff'] : ['#2b7a52','#2a6ea0','#b08a20','#b03030','#3a4f9f'];
    for (let j = 0; j < 5; j++) { const h = 30 + ((j * 17 + i * 7) % 55); g.fillStyle = cols[j]; g.fillRect(14 + j * 24, 140 - h, 18, h); }
    g.strokeStyle = dk ? '#1e3a5f' : '#d0d8e4'; g.lineWidth = 1;
    for (let row = 0; row < 4; row++) {
      g.beginPath(); g.moveTo(140, 25 + row * 18); g.lineTo(250, 25 + row * 18); g.stroke();
      g.fillStyle = dk ? '#7fd6ff' : '#1a4a8a'; g.fillRect(145, 29 + row * 18, 20 + (row * 13 + i * 5) % 38, 5);
      g.fillStyle = dk ? '#5fe0a0' : '#1a6a3a'; g.fillRect(195, 29 + row * 18, 15 + (row * 7 + i * 3) % 28, 5);
    }
  } else if (floor === 2) { // bull/bear — thesis bullets + conviction bar
    const bull = i % 2 === 0;
    g.fillStyle = bull ? '#051a0f' : '#1a0505'; g.fillRect(0, 0, 256, 150);
    g.fillStyle = bull ? '#0d3320' : '#330d0d'; g.fillRect(0, 0, 256, 18);
    g.fillStyle = bull ? '#5fe0a0' : '#ff6b6b'; g.font = 'bold 9px monospace';
    g.fillText(bull ? '▲ BULL CASE' : '▼ BEAR CASE', 8, 13);
    const pts = bull
      ? ['Strong revenue growth','Market leader','Expanding margins','Pipeline strength']
      : ['Valuation stretched','Competitive pressure','Margin compression','Debt concerns'];
    pts.forEach((b, j) => {
      g.fillStyle = bull ? '#5fe0a0' : '#ff6b6b'; g.font = '9px monospace'; g.fillText('•', 8, 32 + j * 22);
      g.fillStyle = bull ? '#a0f0cc' : '#ffb0b0'; g.font = '7px monospace'; g.fillText(b, 18, 32 + j * 22);
    });
    const pct = 40 + (i * 17) % 45;
    g.fillStyle = '#1a1a1a'; g.fillRect(8, 128, 240, 12);
    g.fillStyle = bull ? '#5fe0a0' : '#ff6b6b'; g.fillRect(8, 128, pct / 100 * 240, 12);
    g.fillStyle = '#fff'; g.font = '7px monospace'; g.fillText('Conviction ' + pct + '%', 10, 138);
  } else if (floor === 3) { // skeptic — fact-check list
    g.fillStyle = '#fafaf8'; g.fillRect(0, 0, 256, 150);
    g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, 256, 18);
    g.fillStyle = '#ffffff'; g.font = 'bold 9px monospace'; g.fillText('FACT CHECK', 8, 13);
    const items = [
      [true,'Revenue $2.1B verified'],[true,'Market share 34%'],[false,'Margin claim — no src'],
      [true,'YoY growth confirmed'],[false,'TAM figure unverified'],[true,'Peer data sourced'],
    ];
    items.forEach(([ok, txt], j) => {
      g.fillStyle = ok ? '#1a7a3a' : '#c0392b'; g.font = '9px monospace'; g.fillText(ok ? '✓' : '✗', 8, 32 + j * 19);
      g.fillStyle = '#333'; g.font = '7px monospace'; g.fillText(txt, 22, 32 + j * 19);
    });
  } else if (floor === 4) { // editor — document with tracked changes
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 150);
    g.fillStyle = '#f0f0ee'; g.fillRect(0, 0, 256, 18);
    g.fillStyle = '#555'; g.font = 'bold 8px monospace'; g.fillText('ONE-PAGER DRAFT', 8, 13);
    g.fillStyle = '#d8d4cc'; g.fillRect(20, 26, 140 + (i % 3) * 15, 8); g.fillRect(20, 38, 90, 6);
    for (let y = 54; y < 148; y += 10) {
      g.fillStyle = '#ccc8c0';
      g.fillRect(20, y, y % 30 === 4 ? 180 : y % 20 === 14 ? 120 : 200, 5);
    }
    g.fillStyle = '#ffe08855'; g.fillRect(20, 94, 160, 10);
    if (i % 2 === 0) { g.fillStyle = '#333'; g.fillRect(20 + (i * 23 % 160), 144, 2, 7); }
  } else { // genesis (5) — executive dashboard
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, 256, 150);
    g.fillStyle = '#161b22'; g.fillRect(0, 0, 256, 18);
    g.fillStyle = '#c9b6ff'; g.font = 'bold 9px monospace'; g.fillText('EXEC OVERVIEW', 8, 13);
    [['REV','$2.1B','#5fe0a0'],['MGNS','34%','#ffd36b'],['SCORE','72','#c9b6ff']].forEach(([lbl,val,col], j) => {
      const x = 8 + j * 82;
      g.fillStyle = '#21262d'; g.fillRect(x, 24, 74, 36);
      g.fillStyle = col; g.font = 'bold 13px monospace'; g.fillText(val, x + 6, 46);
      g.fillStyle = '#8b949e'; g.font = '7px monospace'; g.fillText(lbl, x + 6, 56);
    });
    g.strokeStyle = '#c9b6ff'; g.lineWidth = 1.5; g.beginPath();
    for (let x = 10; x < 246; x += 8) { const y = 100 - Math.sin(x / 20 + i) * 14 - x * 0.06; x === 10 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    g.fillStyle = '#21262d'; g.fillRect(8, 120, 240, 22);
    ['●','●','●','●','●','●'].forEach((dot, j) => { g.fillStyle = j < 4 ? '#5fe0a0' : '#ffd36b'; g.font = '9px monospace'; g.fillText(dot, 12 + j * 38, 134); });
  }

  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (screenTex[key] = t);
}

function CoworkerDesk({ x, z, i, wood, empty, floor = 0 }) {
  const look = useMemo(() => lookFor(i), [i]);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.74, -0.75]} castShadow receiveShadow><boxGeometry args={[1.8, 0.05, 0.85]} /><meshStandardMaterial map={wood} roughness={0.6} /></mesh>
      {[[-0.85, -1.12], [0.85, -1.12], [-0.85, -0.38], [0.85, -0.38]].map(([a, b], k) => <mesh key={k} position={[a, 0.37, b]}><boxGeometry args={[0.05, 0.74, 0.05]} /><meshStandardMaterial color="#2c2f33" /></mesh>)}
      <mesh position={[0, 1.3, -1.2]} castShadow><boxGeometry args={[1.8, 0.78, 0.04]} /><meshStandardMaterial color="#9da7ae" roughness={0.9} /></mesh>
      <mesh position={[0, 0.775, -0.55]}><boxGeometry args={[0.46, 0.02, 0.15]} /><meshStandardMaterial color="#d9dadb" /></mesh>
      <group position={[0, 1.65, -0.95]}>
        <mesh position={[0, -0.64, -0.04]}><boxGeometry args={[0.06, 0.52, 0.06]} /><meshStandardMaterial color="#3a3d41" metalness={0.6} /></mesh>
        <mesh castShadow><boxGeometry args={[1.32, 0.78, 0.05]} /><meshStandardMaterial color="#141619" roughness={0.4} /></mesh>
        {!empty && <mesh position={[0, 0, 0.027]}><planeGeometry args={[1.28, 0.74]} /><meshBasicMaterial map={coworkerScreen(floor, i)} toneMapped={false} /></mesh>}
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

// CEO big-screen textures — generated once and cached.
const _ceoTex = [];
function ceoScreenTex(type) {
  if (_ceoTex[type]) return _ceoTex[type];
  const c = document.createElement('canvas'); c.width = 640; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#060a10'; g.fillRect(0, 0, 640, 360);
  if (type === 0) { // portfolio performance chart
    g.fillStyle = '#0a1520'; g.fillRect(0, 0, 640, 40);
    g.fillStyle = '#c9b6ff'; g.font = 'bold 17px monospace'; g.fillText('PORTFOLIO PERFORMANCE', 14, 27);
    g.fillStyle = '#5fe0a0'; g.font = '12px monospace'; g.fillText('+18.4% YTD', 510, 27);
    g.strokeStyle = '#0e1a2a'; g.lineWidth = 1;
    for (let x = 60; x < 630; x += 70) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 310); g.stroke(); }
    for (let y = 70; y < 310; y += 55) { g.beginPath(); g.moveTo(40, y); g.lineTo(630, y); g.stroke(); }
    ['$5B','$4B','$3B','$2B','$1B'].forEach((l, i) => { g.fillStyle='#2d4060'; g.font='10px monospace'; g.fillText(l, 4, 80+i*55); });
    const pts = Array.from({length:70},(_,i)=>[i*8.3+55, 290-i*2.6-Math.sin(i*0.6)*18-Math.sin(i*0.2)*32-Math.cos(i*1.1)*10]);
    g.beginPath(); g.moveTo(pts[0][0], 315); pts.forEach(([x,y])=>g.lineTo(x,y)); g.lineTo(pts[pts.length-1][0],315); g.closePath();
    const gr=g.createLinearGradient(0,80,0,315); gr.addColorStop(0,'#5fe0a040'); gr.addColorStop(1,'#5fe0a005');
    g.fillStyle=gr; g.fill();
    g.strokeStyle='#5fe0a0'; g.lineWidth=2.5; g.beginPath(); pts.forEach(([x,y],i)=>i===0?g.moveTo(x,y):g.lineTo(x,y)); g.stroke();
    const pts2=Array.from({length:70},(_,i)=>[i*8.3+55, 275-i*1.3-Math.sin(i*0.3)*14]);
    g.strokeStyle='#7fd6ff'; g.lineWidth=1.5; g.setLineDash([6,4]); g.beginPath(); pts2.forEach(([x,y],i)=>i===0?g.moveTo(x,y):g.lineTo(x,y)); g.stroke(); g.setLineDash([]);
    g.fillStyle='#5fe0a0'; g.fillRect(14,328,12,8); g.fillStyle='#8b949e'; g.font='10px monospace'; g.fillText('Fund',30,337);
    g.strokeStyle='#7fd6ff'; g.lineWidth=1.5; g.setLineDash([5,3]); g.beginPath(); g.moveTo(80,332); g.lineTo(94,332); g.stroke(); g.setLineDash([]);
    g.fillStyle='#8b949e'; g.fillText('Benchmark',98,337);
  } else if (type === 1) { // exec dashboard (center)
    g.fillStyle='#0a1520'; g.fillRect(0,0,640,40);
    g.fillStyle='#ffd36b'; g.font='bold 19px monospace'; g.fillText('EXECUTIVE DASHBOARD',14,28);
    g.fillStyle='#3d5068'; g.font='11px monospace'; g.fillText('Live · Just now',490,28);
    [['NET IRR','23.4%','#5fe0a0','▲ +2.1pp'],['AUM','$4.2B','#c9b6ff','▲ +$0.3B'],['ACTIVE','12 deals','#ffd36b','= same'],['EXITS','3 ✓','#7fd6ff','▲ +1']].forEach(([lbl,val,col,sub],j)=>{
      const x=10+j*157,y=50;
      g.fillStyle='#0d1a2e'; g.fillRect(x,y,148,76);
      g.strokeStyle=col+'44'; g.lineWidth=1; g.strokeRect(x,y,148,76);
      g.fillStyle=col; g.font='bold 25px monospace'; g.fillText(val,x+10,y+42);
      g.fillStyle='#6b7a8f'; g.font='9px monospace'; g.fillText(lbl,x+10,y+58);
      g.fillStyle=sub.startsWith('▲')?'#5fe0a0':'#6b7a8f'; g.fillText(sub,x+10,y+72);
    });
    g.fillStyle='#0a1520'; g.fillRect(0,135,640,22);
    ['COMPANY','SECTOR','ENTRY','IRR','STATUS'].forEach((h,j)=>{g.fillStyle='#4a5a6a';g.font='9px monospace';g.fillText(h,10+j*126,150);});
    [['Acme Corp','SaaS','2024','31.2%','Exited'],['Meridian','FinTech','2023','18.7%','Active'],['NovaBio','Health','2025','—','Active'],['DataStream','AI/ML','2022','42.1%','Exited'],['Vertex','SaaS','2025','—','Active']].forEach((row,r)=>{
      g.fillStyle=r%2?'#070d16':'#0b1320'; g.fillRect(0,158+r*36,640,36);
      row.forEach((cell,j)=>{
        g.fillStyle=j===3?(cell==='—'?'#4a5a6a':'#5fe0a0'):j===4?(cell==='Exited'?'#c9b6ff':'#ffd36b'):j===0?'#d8e0ea':'#6b7a8f';
        g.font=j===0?'bold 10px monospace':'10px monospace'; g.fillText(cell,10+j*126,180+r*36);
      });
    });
    g.fillStyle='#0d1a2e'; g.fillRect(0,342,640,18); g.fillStyle='#2d3d50'; g.font='9px monospace'; g.fillText('All figures as of market close · Confidential',10,354);
  } else { // sector breakdown
    g.fillStyle='#0a1520'; g.fillRect(0,0,640,40);
    g.fillStyle='#7fd6ff'; g.font='bold 17px monospace'; g.fillText('SECTOR ALLOCATION',14,27);
    const sectors=[['SaaS',38,'#c9b6ff'],['FinTech',24,'#7fd6ff'],['Health',18,'#5fe0a0'],['AI / ML',14,'#ffd36b'],['Other',6,'#ff8c6b']];
    sectors.forEach(([name,val,col],i)=>{
      const y=52+i*50, barW=val/38*390;
      g.fillStyle='#0a1520'; g.fillRect(10,y,390,38);
      const bg=g.createLinearGradient(10,0,10+barW,0); bg.addColorStop(0,col+'66'); bg.addColorStop(1,col+'22'); g.fillStyle=bg; g.fillRect(10,y,barW,38);
      g.strokeStyle=col+'88'; g.lineWidth=1; g.strokeRect(10,y,barW,38);
      g.fillStyle='#e0e6ee'; g.font='bold 12px monospace'; g.fillText(name,18,y+25);
      g.fillStyle=col; g.font='bold 14px monospace'; g.fillText(val+'%',350,y+25);
    });
    const cx=530,cy=195,r=78;
    g.strokeStyle='#0d1a2e'; g.lineWidth=24; g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.stroke();
    let st=-Math.PI/2;
    sectors.forEach(([,val,col])=>{const a=val/100*Math.PI*2; g.strokeStyle=col; g.lineWidth=22; g.beginPath(); g.arc(cx,cy,r,st,st+a); g.stroke(); st+=a;});
    g.fillStyle='#e0e6ee'; g.font='bold 15px monospace'; g.textAlign='center'; g.fillText('$4.2B',cx,cy+5);
    g.fillStyle='#5d6b7d'; g.font='10px monospace'; g.fillText('Total AUM',cx,cy+21); g.textAlign='left';
  }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  return (_ceoTex[type]=t);
}

// The CEO's floor: a private executive office.
function ExecutiveOffice({ wood }) {
  const screens = useMemo(() => [0, 1, 2].map(ceoScreenTex), []);
  return (
    <group>
      {/* dark floor — raised above Room's floor planes to avoid z-fighting */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} receiveShadow>
        <planeGeometry args={[40, 26]} /><meshStandardMaterial color="#13171e" roughness={0.22} metalness={0.1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.016, -1]} receiveShadow>
        <planeGeometry args={[14, 10]} /><meshStandardMaterial color="#1a1f2c" roughness={0.85} />
      </mesh>

      {/* === BIG SCREENS — left, center, right === */}
      {/* Left */}
      <group position={[-11, 2.1, -12.35]}>
        <mesh><boxGeometry args={[6.4, 3.6, 0.1]} /><meshStandardMaterial color="#0a0c0f" roughness={0.3} metalness={0.7} /></mesh>
        <mesh position={[0, 0, 0.056]}><planeGeometry args={[6.1, 3.3]} /><meshBasicMaterial map={screens[0]} toneMapped={false} /></mesh>
        <pointLight position={[0, 0, 2]} intensity={2.5} distance={9} color="#c9b6ff" decay={2} />
      </group>
      {/* Center (largest) */}
      <group position={[0, 2.2, -12.35]}>
        <mesh><boxGeometry args={[9.4, 4.0, 0.1]} /><meshStandardMaterial color="#0a0c0f" roughness={0.3} metalness={0.7} /></mesh>
        <mesh position={[0, 0, 0.056]}><planeGeometry args={[9.1, 3.7]} /><meshBasicMaterial map={screens[1]} toneMapped={false} /></mesh>
        <pointLight position={[0, 0, 2]} intensity={3.5} distance={12} color="#ffd36b" decay={2} />
      </group>
      {/* Right */}
      <group position={[11, 2.1, -12.35]}>
        <mesh><boxGeometry args={[6.4, 3.6, 0.1]} /><meshStandardMaterial color="#0a0c0f" roughness={0.3} metalness={0.7} /></mesh>
        <mesh position={[0, 0, 0.056]}><planeGeometry args={[6.1, 3.3]} /><meshBasicMaterial map={screens[2]} toneMapped={false} /></mesh>
        <pointLight position={[0, 0, 2]} intensity={2.5} distance={9} color="#7fd6ff" decay={2} />
      </group>
      {/* mounting rail top + bottom */}
      <mesh position={[0, 0.38, -12.4]}><boxGeometry args={[28, 0.07, 0.08]} /><meshStandardMaterial color="#2a3040" metalness={0.9} roughness={0.2} /></mesh>
      <mesh position={[0, 4.1, -12.4]}><boxGeometry args={[28, 0.07, 0.08]} /><meshStandardMaterial color="#2a3040" metalness={0.9} roughness={0.2} /></mesh>
      {/* glow pool on floor below screens */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -11.5]}>
        <planeGeometry args={[28, 2]} /><meshBasicMaterial color="#101828" transparent opacity={0.9} />
      </mesh>

      {/* === LARGE EXECUTIVE DESK === */}
      {/* Main surface — wide panel desk, same z as workstation so person sits flush */}
      <mesh position={[0, 0.76, -1.1]} castShadow receiveShadow>
        <boxGeometry args={[9.0, 0.1, 2.2]} /><meshStandardMaterial map={wood} roughness={0.26} metalness={0.04} />
      </mesh>
      {/* Left slab leg */}
      <mesh position={[-4.3, 0.38, -1.1]} castShadow>
        <boxGeometry args={[0.09, 0.76, 2.18]} /><meshStandardMaterial color="#0f1115" metalness={0.8} roughness={0.15} />
      </mesh>
      {/* Right slab leg */}
      <mesh position={[4.3, 0.38, -1.1]} castShadow>
        <boxGeometry args={[0.09, 0.76, 2.18]} /><meshStandardMaterial color="#0f1115" metalness={0.8} roughness={0.15} />
      </mesh>
      {/* Front modesty panel */}
      <mesh position={[0, 0.38, -0.0]} castShadow>
        <boxGeometry args={[8.82, 0.76, 0.08]} /><meshStandardMaterial color="#0f1115" metalness={0.8} roughness={0.15} />
      </mesh>
      {/* L-return on left */}
      <mesh position={[-5.5, 0.76, 0.75]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.1, 1.6]} /><meshStandardMaterial map={wood} roughness={0.26} metalness={0.04} />
      </mesh>
      <mesh position={[-6.45, 0.38, 0.75]} castShadow>
        <boxGeometry args={[0.09, 0.76, 1.58]} /><meshStandardMaterial color="#0f1115" metalness={0.8} roughness={0.15} />
      </mesh>
      {/* name plate */}
      <mesh position={[1.5, 0.82, -0.4]} rotation-y={0.08}>
        <boxGeometry args={[0.75, 0.055, 0.1]} /><meshStandardMaterial color="#0f1115" metalness={0.8} roughness={0.12} />
      </mesh>
      {/* pen holder */}
      <mesh position={[-1.2, 0.9, -0.55]}>
        <cylinderGeometry args={[0.07, 0.065, 0.16, 12]} /><meshStandardMaterial color="#1a1f26" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* stacked papers */}
      <mesh position={[-2.8, 0.78, -0.8]} rotation-y={0.3} castShadow>
        <boxGeometry args={[0.6, 0.015, 0.45]} /><meshStandardMaterial color="#f0ede5" roughness={0.9} />
      </mesh>
      <mesh position={[-2.8, 0.797, -0.8]} rotation-y={0.08} castShadow>
        <boxGeometry args={[0.6, 0.015, 0.45]} /><meshStandardMaterial color="#e8e5dc" roughness={0.9} />
      </mesh>
      {/* glass orb */}
      <mesh position={[2.5, 0.92, -0.9]}>
        <sphereGeometry args={[0.11, 14, 10]} /><meshStandardMaterial color="#c9b6ff" roughness={0.05} metalness={0.9} />
      </mesh>
      {/* desk lamp */}
      <group position={[3.6, 0.76, -1.1]}>
        <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[0.07, 0.1, 0.16, 12]} /><meshStandardMaterial color="#1c1f24" metalness={0.75} roughness={0.25} /></mesh>
        <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.025, 0.025, 0.66, 8]} /><meshStandardMaterial color="#1c1f24" metalness={0.8} roughness={0.2} /></mesh>
        <mesh position={[0.14, 0.82, -0.1]} rotation-x={0.55}><coneGeometry args={[0.2, 0.3, 14]} /><meshStandardMaterial color="#1a1f24" metalness={0.6} roughness={0.3} /></mesh>
        <pointLight position={[0.1, 0.65, 0]} intensity={2.2} distance={5.5} color="#ffe4a0" decay={2} />
      </group>

      {/* === SOFA + GLASS COFFEE TABLE === */}
      <group position={[0, 0, 7.5]} rotation-y={Math.PI}>
        <mesh position={[0, 0.32, 0]} castShadow><boxGeometry args={[4.6, 0.5, 1.0]} /><meshStandardMaterial color="#252c36" roughness={0.9} /></mesh>
        <mesh position={[0, 0.76, 0.42]} castShadow><boxGeometry args={[4.6, 0.6, 0.18]} /><meshStandardMaterial color="#252c36" roughness={0.9} /></mesh>
        {[-2.2, 2.2].map((x) => <mesh key={x} position={[x, 0.6, 0]} castShadow><boxGeometry args={[0.2, 0.55, 1.0]} /><meshStandardMaterial color="#1c2028" /></mesh>)}
        {[-1.4, 0, 1.4].map((x) => <mesh key={x} position={[x, 0.63, -0.08]} castShadow><boxGeometry args={[1.3, 0.17, 0.88]} /><meshStandardMaterial color="#2e3744" roughness={0.95} /></mesh>)}
      </group>
      {/* glass coffee table */}
      <mesh position={[0, 0.44, 5.5]}><boxGeometry args={[2.2, 0.04, 0.95]} /><meshStandardMaterial color="#aec8d8" roughness={0.04} metalness={0.1} transparent opacity={0.55} /></mesh>
      {[[-0.9,-0.38],[0.9,-0.38],[-0.9,0.38],[0.9,0.38]].map(([x,z],i)=>(
        <mesh key={i} position={[x, 0.22, 5.5+z]}><boxGeometry args={[0.05,0.44,0.05]} /><meshStandardMaterial color="#2a2f36" metalness={0.7} /></mesh>
      ))}

      {/* === BOOKSHELF === */}
      <group position={[18.6, 0, 1]}>
        <mesh position={[0, 1.7, 0]} castShadow><boxGeometry args={[0.38, 3.4, 4.2]} /><meshStandardMaterial map={wood} roughness={0.65} /></mesh>
        {[0.5, 1.05, 1.6, 2.15].map((y, r) => [-1.9,-1.3,-0.7,-0.1,0.5,1.1,1.7].map((z, k) => (
          <mesh key={`${r}${k}`} position={[0.08, y, z]}><boxGeometry args={[0.26, 0.48, 0.22]} /><meshStandardMaterial color={['#7a2f2f','#2e3b4e','#3f5a48','#c9b28a','#4b4f55','#6b4a2f','#1f2328'][(k+r)%7]} /></mesh>
        )))}
      </group>

      {/* === PLANTS === */}
      {[[-17, -10], [17, -10], [-3, 11]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.42, 0]}><cylinderGeometry args={[0.46, 0.34, 0.84, 16]} /><meshStandardMaterial color="#e2ddd4" /></mesh>
          <mesh position={[0, 1.55, 0]}><icosahedronGeometry args={[0.88, 1]} /><meshStandardMaterial color="#4a6840" roughness={0.9} flatShading /></mesh>
        </group>
      ))}
    </group>
  );
}

const AISLE = [[-15.5, 6.0], [15.5, 6.0], [15.5, -2.15], [-15.5, -2.15]];
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
    <Html transform position={[0, 0, 0.031]} scale={0.107} zIndexRange={[20, 0]}>
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
      <mesh position={[0, 1.3, -1.2]} castShadow><boxGeometry args={[1.8, 0.78, 0.04]} /><meshStandardMaterial color="#9da7ae" roughness={0.9} /></mesh>
      {/* keyboard, mug */}
      <mesh position={[0, 0.775, -0.55]}><boxGeometry args={[0.46, 0.02, 0.15]} /><meshStandardMaterial color="#d9dadb" /></mesh>
      <mesh position={[0.55, 0.82, -0.55]}><cylinderGeometry args={[0.04, 0.04, 0.1, 12]} /><meshStandardMaterial color={['#e9e4da', '#2f4a6b', '#7a2f2f'][Math.abs(Math.round(seat.x)) % 3]} /></mesh>
      {/* monitor, facing the person (+z) */}
      <group position={[0, 1.65, -0.95]} onClick={(e) => { e.stopPropagation(); onPick(seat.id); }}>
        <mesh position={[0, -0.64, -0.04]}><boxGeometry args={[0.06, 0.52, 0.06]} /><meshStandardMaterial color="#3a3d41" metalness={0.6} /></mesh>
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
      {seats.some((st) => st.id === 'genesis') ? <ExecutiveOffice wood={wood} /> : (
        <>
          {DESKS.map(([x, z], i) => <CoworkerDesk key={i} x={x} z={z} i={i} wood={wood} empty={EMPTY.has(i)} floor={floor} />)}
          <Meeting wood={wood} />
          <CoffeeAndBoard />
          <Walker path={AISLE} i={1} offset={0} carry="coffee" />
          <Walker path={AISLE} i={2} offset={31} speed={0.95} carry="laptop" />
          <Walker path={AISLE} i={5} offset={58} speed={1.15} />
          <Walker path={SIDE} i={7} offset={5} speed={0.9} carry="coffee" />
        </>
      )}
      {seats.map((s) => <Workstation key={s.id} seat={s} run={run} picked={picked === s.id} onPick={clickScreen} wood={wood} />)}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={40} blur={2.2} far={3} />
      <CameraDirector controls={controls} seats={seats} zoom={zoom} />
      <CameraControls ref={controls} makeDefault minDistance={0.6} maxDistance={12} minPolarAngle={0.6} maxPolarAngle={1.62} dollySpeed={0.6} truckSpeed={1} />
    </Canvas>
  );
}
