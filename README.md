# Samjhao (समझाओ) - AI study companion for Indian students

Built for the **BharatCode Build League** (category: Learning & education).

Most AI answers just hand students a final answer. Samjhao behaves like a good senior: it explains in the student's own language (Hinglish, Hindi or English), gives hints before answers, and asks a check question after every explanation. Then it turns what you got wrong into revision.

## Features
- **Ask tutor** - Socratic chat tuned by subject, level (Class 6 to college) and language.
- **Take a quiz** - exam-style MCQs on any topic, graded instantly with an explanation for each answer.
- **Revise cards** - flashcards generated from a topic, or saved from questions you missed. Leitner-style schedule (1, 3, 7, 14 days) stored in your browser.

## How it uses BharatCode
Every model call goes through `server/bharatcode.js`, which calls `POST {BHARATCODE_BASE_URL}/chat/completions` with the BharatCode API (default model `qwen-3.8-27b`). The API key lives only on the server. `server/prompts.js` holds the prompts that make up the tutoring harness; JSON outputs are validated before they reach the UI.

## Run locally
```bash
npm install
cp .env.example .env     # add your BHARATCODE_API_KEY
npm start                # http://localhost:3000
```
Requires Node 18+. If the BharatCode docs list a different base URL or model name, change them in `.env`.

## Project structure
```
server/index.js        Express routes, validation, rate limit
server/bharatcode.js   BharatCode API client + safe JSON parsing
server/prompts.js      Tutor / quiz / flashcard prompts
public/                Vanilla JS front end (no build step)
BharatCode.txt         Hackathon submission file
```

## Roadmap
Photo-of-a-textbook-page questions, WhatsApp bot front end, teacher dashboards.

MIT licensed. Author: Baishnvi Goswami.

## Live Demo
<img width="1366" height="768" alt="Screenshot (494)" src="https://github.com/user-attachments/assets/9bc8e9c0-8eb7-412a-be8e-456a11955cc0" />

