// Procedural facade textures (no downloads, so they work inside a hosted page).
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const cache = new Map();

// One "tile" = one bay wide, one storey tall. Repeated across a building face.
function tile(kind, seed) {
  const key = `${kind}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const r = rng(seed * 97 + 13);
  const [c, g] = canvas(128, 128);
  if (kind === 'glass') {
    const base = ['#5d7891', '#6b8399', '#4f6a82', '#7d93a6'][seed % 4];
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, base); grad.addColorStop(1, '#3b5166');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, 128, 40);
    g.fillStyle = '#2b3a48'; g.fillRect(0, 0, 4, 128); g.fillRect(0, 0, 128, 8);
    g.fillStyle = '#9aa7b2'; g.fillRect(0, 118, 128, 10);
  } else if (kind === 'stone') {
    g.fillStyle = ['#d9cfbd', '#cfc3ae', '#e2d9c8', '#c8bba5'][seed % 4]; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * 128, r() * 128, 2, 2); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 104, 128, 3);
    g.fillStyle = r() < 0.2 ? '#f3dcae' : '#2d3640'; g.fillRect(34, 22, 60, 72);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(34, 22, 60, 10);
    g.fillStyle = '#b6a98f'; g.fillRect(30, 94, 68, 5);
  } else { // brick
    g.fillStyle = ['#8f4f3c', '#9b5a45', '#7e4636', '#a5614a'][seed % 4]; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < 128; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    g.fillStyle = r() < 0.15 ? '#f0d7a6' : '#26303a'; g.fillRect(36, 24, 56, 70);
    g.fillStyle = '#e8e2d6'; g.fillRect(32, 92, 64, 6); g.fillRect(32, 20, 64, 4);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(36, 24, 56, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

// Material for a box face of a given size: texture repeated per bay/storey.
const matCache = new Map();
export function facadeMaterial(kind, seed, w, h) {
  const bayW = kind === 'glass' ? 3 : 3.4, storey = kind === 'glass' ? 3.6 : 3.4;
  const rx = Math.max(1, Math.round(w / bayW)), ry = Math.max(1, Math.round(h / storey));
  const key = `${kind}:${seed % 4}:${rx}:${ry}`;
  if (matCache.has(key)) return matCache.get(key);
  const t = tile(kind, seed % 4).clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  const m = new THREE.MeshStandardMaterial({
    map: t,
    roughness: kind === 'glass' ? 0.15 : 0.85,
    metalness: kind === 'glass' ? 0.55 : 0.02,
    envMapIntensity: kind === 'glass' ? 1.2 : 0.4,
  });
  matCache.set(key, m);
  return m;
}

export function roofMaterial() {
  if (matCache.has('roof')) return matCache.get('roof');
  const m = new THREE.MeshStandardMaterial({ color: '#8b8f93', roughness: 0.95 });
  matCache.set('roof', m);
  return m;
}

// Soft puff used by the cloud sprites.
export function cloudTextureURL() {
  if (cache.has('cloud')) return cache.get('cloud');
  const [c, g] = canvas(256, 256);
  const r = rng(3);
  for (let i = 0; i < 26; i++) {
    const x = 70 + r() * 116, y = 80 + r() * 96, rad = 30 + r() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const url = c.toDataURL('image/png');
  cache.set('cloud', url);
  return url;
}

export function woodTexture() {
  if (cache.has('wood')) return cache.get('wood');
  const [c, g] = canvas(256, 256);
  const r = rng(9);
  g.fillStyle = '#b48a62'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(80,50,25,${0.03 + r() * 0.06})`; g.fillRect(0, y, 256, 1 + r() * 2); }
  for (let x = 0; x < 256; x += 64) { g.fillStyle = 'rgba(60,35,15,0.25)'; g.fillRect(x, 0, 1, 256); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
  cache.set('wood', t);
  return t;
}
