const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const settings = () => ({ subject: $('subject').value, level: $('level').value, language: $('language').value });

function setStatus(text, err = false) { const s = $('status'); s.textContent = text; s.className = 'status' + (err ? ' err' : ''); }
async function api(path, body, button) {
  if (button) button.disabled = true;
  setStatus('Thinking...');
  try {
    const res = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...settings(), ...body }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    setStatus('');
    return data;
  } catch (e) { setStatus(e.message, true); return null; }
  finally { if (button) button.disabled = false; }
}

// ---- Tabs ----
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== b.dataset.tab));
  if (b.dataset.tab === 'cards') renderCards();
  setStatus('');
}));

// ---- Tutor ----
let history = [];
function addMsg(role, text) {
  const chat = $('chat'); chat.querySelector('.empty')?.remove();
  const d = document.createElement('div'); d.className = 'msg ' + (role === 'user' ? 'user' : 'bot'); d.innerHTML = md(text);
  chat.append(d); chat.scrollTop = chat.scrollHeight;
}
$('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim(); if (!text) return;
  $('chatInput').value = ''; history.push({ role: 'user', content: text }); addMsg('user', text);
  const data = await api('tutor', { messages: history }, e.submitter);
  if (data) { history.push({ role: 'assistant', content: data.reply }); addMsg('bot', data.reply); }
  else history.pop();
});
$('chatClear').addEventListener('click', () => { history = []; $('chat').innerHTML = '<p class="empty">New chat started. Ask your next doubt.</p>'; });

// ---- Quiz ----
$('quizForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = await api('quiz', { topic: $('quizTopic').value, count: $('quizCount').value }, e.submitter);
  if (data) runQuiz(data);
});
function runQuiz({ topic, questions }) {
  const body = $('quizBody'); body.innerHTML = '';
  let answered = 0, correct = 0; const missed = [];
  const score = document.createElement('div');
  questions.forEach((q, i) => {
    const box = document.createElement('div'); box.className = 'q';
    box.innerHTML = `<h3>Q${i + 1}. ${esc(q.q)}</h3>`;
    const why = document.createElement('p'); why.className = 'why'; why.hidden = true; why.textContent = q.explanation;
    const btns = q.options.map((o, j) => {
      const b = document.createElement('button'); b.className = 'opt'; b.textContent = o;
      b.addEventListener('click', () => {
        btns.forEach((x, k) => { x.disabled = true; if (k === q.answer) x.classList.add('right'); });
        if (j === q.answer) correct++; else { b.classList.add('wrong'); missed.push({ front: q.q, back: `${q.options[q.answer]}. ${q.explanation}` }); }
        why.hidden = false; answered++;
        if (answered === questions.length) finish();
      });
      box.append(b); return b;
    });
    box.append(why); body.append(box);
  });
  body.append(score);
  function finish() {
    score.className = 'score'; score.textContent = `You scored ${correct} / ${questions.length}`;
    if (missed.length) {
      const b = document.createElement('button'); b.className = 'primary'; b.textContent = `Save ${missed.length} missed as flashcards`;
      b.addEventListener('click', () => { addCards(missed, topic); b.disabled = true; b.textContent = 'Saved to Revise cards'; });
      body.append(b);
    }
  }
}

// ---- Flashcards (Leitner-style boxes, stored in this browser) ----
const KEY = 'samjhao.cards', DAY = 864e5, GAPS = [0, 1, 3, 7, 14];
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { setStatus('Could not save cards in this browser.', true); } };
function addCards(list, topic) {
  const now = Date.now();
  save([...load(), ...list.map((c, i) => ({ id: now + i, topic, front: c.front, back: c.back, box: 0, due: now }))]);
  updateBadge();
}
const dueCards = () => load().filter((c) => c.due <= Date.now());
function updateBadge() { const n = dueCards().length; $('dueBadge').hidden = !n; $('dueBadge').textContent = n; }

$('cardForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const topic = $('cardTopic').value;
  const data = await api('flashcards', { topic, count: 8 }, e.submitter);
  if (data) { addCards(data.cards, data.topic); renderCards(); }
});
function renderCards() {
  const body = $('cardBody'); const all = load(); const due = dueCards();
  updateBadge();
  if (!all.length) { body.innerHTML = '<p class="empty">No cards yet. Make some above, or save the ones you missed in a quiz.</p>'; return; }
  if (!due.length) { body.innerHTML = `<p class="empty">All caught up. ${all.length} cards saved; the next ones come back on their schedule.</p>`; return; }
  const c = due[0]; let flipped = false;
  body.innerHTML = `<p class="hint">${due.length} due today &middot; ${esc(c.topic)}</p><div class="card" tabindex="0" role="button"></div><p class="hint">Tap the card to flip</p><div class="row" id="grade" hidden></div>`;
  const card = body.querySelector('.card'), grade = $('grade');
  const flip = () => { flipped = !flipped; card.textContent = flipped ? c.back : c.front; card.classList.toggle('back', flipped); grade.hidden = !flipped; };
  card.textContent = c.front;
  card.addEventListener('click', flip);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  [['Again', 0], ['Got it', 1]].forEach(([label, up]) => {
    const b = document.createElement('button'); b.className = up ? 'primary' : 'ghost'; b.textContent = label;
    b.addEventListener('click', () => {
      const cards = load(), t = cards.find((x) => x.id === c.id);
      t.box = up ? Math.min(t.box + 1, GAPS.length - 1) : 0; t.due = Date.now() + GAPS[t.box] * DAY;
      save(cards); renderCards();
    });
    grade.append(b);
  });
}
updateBadge();
