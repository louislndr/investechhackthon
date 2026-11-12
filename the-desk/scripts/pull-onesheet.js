// Pull data from the Onesheet API into server/data/live so the loader picks it up.
// Usage:
//   ONESHEET_API_KEY=... node scripts/pull-onesheet.js <url> [<url> ...]
//   npm run pull -- "https://api.onesheet.ca/....?ticker=XYZ"
// The endpoint shapes come from the hackathon docs (emailed Nov 9). Whatever JSON or CSV comes
// back is saved as-is, and the universal loader flattens it. Check the result in the UI header.
import { mkdirSync, writeFileSync } from 'node:fs';
import '../server/env.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'server/data/live');
mkdirSync(out, { recursive: true });
const urls = process.argv.slice(2);
if (!urls.length) { console.log('Give one or more URLs. See comments at the top of this file.'); process.exit(1); }

const headers = {};
if (process.env.ONESHEET_API_KEY) {
  // Unknown auth style: send the common ones. Adjust once you see the docs.
  headers.Authorization = `Bearer ${process.env.ONESHEET_API_KEY}`;
  headers['x-api-key'] = process.env.ONESHEET_API_KEY;
}

for (const [i, url] of urls.entries()) {
  const res = await fetch(url, { headers });
  const type = res.headers.get('content-type') || '';
  const body = await res.text();
  if (!res.ok) { console.error(`✗ ${res.status} ${url}\n${body.slice(0, 300)}`); continue; }
  const ext = type.includes('csv') || /\.csv(\?|$)/.test(url) ? 'csv' : 'json';
  const name = `pull-${i + 1}-${new URL(url).pathname.split('/').filter(Boolean).pop() || 'data'}.${ext}`.replace(/[^\w.-]/g, '_');
  writeFileSync(join(out, name), body);
  console.log(`✓ saved ${name} (${body.length.toLocaleString()} bytes)`);
}
console.log(`\nRestart the server (or use "Load Onesheet data" in the UI). Data dir: ${out}`);
