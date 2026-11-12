// Thin Claude wrapper. Live mode turns on automatically when ANTHROPIC_API_KEY is set
// (and MOCK isn't 1). Otherwise every agent runs offline from the same fact sheet.
import Anthropic from '@anthropic-ai/sdk';

export const LIVE = Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MOCK !== '1';
export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const client = LIVE ? new Anthropic() : null;

export function parseJSON(text) {
  const t = String(text).replace(/```(?:json)?/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('No JSON object in model output');
  return JSON.parse(t.slice(a, b + 1));
}

// Streams tokens to onText (shown live on the agent's floor) and returns parsed JSON.
export async function callAgent({ system, user, schema, onText, maxTokens = 1400, signal }) {
  const messages = [{ role: 'user', content: `${user}\n\nReturn JSON exactly in this shape:\n${schema}` }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = client.messages.stream({ model: MODEL, max_tokens: maxTokens, system, messages }, { signal });
    stream.on('text', (t) => onText?.(t));
    const msg = await stream.finalMessage();
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    try { return parseJSON(text); } catch (e) {
      if (attempt === 1) throw e;
      onText?.('\n[retrying: output was not valid JSON]\n');
      messages.push({ role: 'assistant', content: text }, { role: 'user', content: 'That was not valid JSON. Reply with ONLY the JSON object.' });
    }
  }
}
