// Browser build: no API key in a public page, so every agent runs offline.
export const LIVE = false;
export const MODEL = null;
export async function callAgent() { throw new Error('Live mode needs the local server'); }
export function parseJSON(t) { return JSON.parse(t); }
