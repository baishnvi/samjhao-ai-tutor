import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, chatJson, ApiError } from './bharatcode.js';
import { tutorSystem, quizPrompt, cardsPrompt } from './prompts.js';

const app = express();
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.json({ limit: '50kb' }));
app.use(express.static(publicDir));

// Tiny in-memory rate limit: 30 requests / minute / IP (protects your API quota).
const hits = new Map();
app.use('/api', (req, res, next) => {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 30) return res.status(429).json({ error: 'Too many requests. Wait a minute and try again.' });
  hits.set(req.ip, [...recent, now]);
  next();
});

const LEVELS = ['Class 6-8', 'Class 9-10', 'Class 11-12', 'College'];
const LANGS = ['hinglish', 'english', 'hindi'];
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const opts = (b) => ({
  subject: clean(b.subject, 60) || 'General',
  level: LEVELS.includes(b.level) ? b.level : 'Class 11-12',
  language: LANGS.includes(b.language) ? b.language : 'hinglish',
});
const need = (v, msg) => { if (!v) throw new ApiError(400, msg); return v; };
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => res.status(e.status || 500).json({ error: e.message || 'Something went wrong.' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, keyConfigured: Boolean(process.env.BHARATCODE_API_KEY) }));

app.post('/api/tutor', wrap(async (req, res) => {
  const o = opts(req.body);
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter((m) => ['user', 'assistant'].includes(m?.role))
    .slice(-12)
    .map((m) => ({ role: m.role, content: clean(m.content, 2000) }));
  need(history.length && history.at(-1).role === 'user', 'Send a question to start.');
  const reply = await chat([{ role: 'system', content: tutorSystem(o) }, ...history], { temperature: 0.5, maxTokens: 700 });
  res.json({ reply });
}));

app.post('/api/quiz', wrap(async (req, res) => {
  const o = opts(req.body);
  const topic = need(clean(req.body.topic, 120), 'Enter a topic for the quiz.');
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 3), 10);
  const raw = await chatJson([{ role: 'user', content: quizPrompt(o, topic, count) }]);
  const questions = (Array.isArray(raw) ? raw : raw.questions || [])
    .filter((x) => x?.q && Array.isArray(x.options) && x.options.length === 4 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4)
    .map((x) => ({ q: String(x.q), options: x.options.map(String), answer: x.answer, explanation: String(x.explanation || '') }));
  need(questions.length, 'Could not build a valid quiz. Try a more specific topic.');
  res.json({ topic, questions });
}));

app.post('/api/flashcards', wrap(async (req, res) => {
  const o = opts(req.body);
  const topic = need(clean(req.body.topic, 120), 'Enter a topic for the cards.');
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 8, 3), 15);
  const raw = await chatJson([{ role: 'user', content: cardsPrompt(o, topic, count) }]);
  const cards = (Array.isArray(raw) ? raw : raw.cards || [])
    .filter((c) => c?.front && c?.back)
    .map((c) => ({ front: String(c.front), back: String(c.back) }));
  need(cards.length, 'Could not build cards. Try a more specific topic.');
  res.json({ topic, cards });
}));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Samjhao running on http://localhost:${port}`));
