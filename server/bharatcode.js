// Thin client for the BharatCode model API (OpenAI-compatible chat completions).
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function chat(messages, { temperature = 0.4, maxTokens = 1500 } = {}) {
  const key = process.env.BHARATCODE_API_KEY;
  if (!key) throw new ApiError(503, 'BHARATCODE_API_KEY is not set. Add it to your .env file.');
  const base = (process.env.BHARATCODE_BASE_URL || 'https://api.bharatcode.ai/v1').replace(/\/$/, '');
  const model = process.env.BHARATCODE_MODEL || 'qwen-3.8-27b';

  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ApiError(504, 'Could not reach the BharatCode API. Check your connection and BHARATCODE_BASE_URL.');
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw new ApiError(502, `BharatCode API returned ${res.status}. ${detail}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new ApiError(502, 'BharatCode API returned an empty response.');
  return text.trim();
}

// Ask for JSON, parse defensively, retry once with a stricter reminder.
export async function chatJson(messages, opts = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(
      attempt ? [...messages, { role: 'user', content: 'Reply with valid JSON only. No prose, no code fences.' }] : messages,
      { temperature: 0.3, maxTokens: 2500, ...opts }
    );
    const m = text.replace(/```json|```/g, '').match(/[\[{][\s\S]*[\]}]/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* retry */ } }
  }
  throw new ApiError(502, 'The model did not return valid JSON. Please try again.');
}
