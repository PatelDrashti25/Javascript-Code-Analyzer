# CodeLens — JavaScript Code Quality Analyzer

A full-stack intelligent JavaScript code quality analyzer combining static structural analysis, quantitative metrics, ML-based classification, and AI-powered explanations.

---

## Project Structure

```
js-analyzer/
├── index.html      ← Main frontend page
├── style.css       ← All styles
├── app.js          ← Frontend JavaScript
├── server.js       ← Node.js/Express backend
├── package.json    ← Dependencies
└── README.md       ← This file
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend
```bash
npm start
# or for development (auto-reload):
npx nodemon server.js
```
The backend runs on **http://localhost:3001**

### 3. Open the Frontend
Open `index.html` in a browser directly, or serve it via the backend at **http://localhost:3001**

---

## Features

### Frontend
- **Code Editor** — Syntax-aware textarea with line numbers
- **File Upload** — Drag & drop or browse .js files
- **Analysis Options** — Toggle AST, ML, AI, duplication checks
- **Score Dashboard** — Animated ring chart with grade A–F
- **5 Result Tabs** — Metrics, AST, Issues, AI Suggestions, ML Report
- **Analysis History** — Saved locally with search and grade filter
- **Leaderboard** — Top analyses ranked by quality score
- **Comparison Table** — CodeLens vs ESLint vs SonarQube
- **Feedback Form** — Star rating + structured questionnaire
- **Pipeline Docs** — Visual explanation of the analysis pipeline
- **Dark Theme** — Monochrome + cyan accent design

### Backend API (server.js)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Analyze JavaScript code |
| POST | `/api/analyses` | Save an analysis |
| GET | `/api/analyses` | List saved analyses |
| DELETE | `/api/analyses/:id` | Delete an analysis |
| POST | `/api/feedback` | Submit feedback |
| GET | `/api/feedback` | Get feedback |
| GET | `/api/stats` | Usage statistics |
| GET | `/api/leaderboard` | Top 10 analyses |
| GET | `/api/health` | Health check |

### Analysis Engine (server.js)
- **Cyclomatic Complexity** — Decision point counting (threshold: ≤10)
- **Cognitive Complexity** — Nesting-weighted readability score (threshold: ≤15)
- **Max Nesting Depth** — Brace-counting depth analysis
- **Code Duplication** — 3-line sliding window hash comparison
- **Comment Ratio** — Documentation density percentage
- **Function Length** — Per-function line count
- **Issue Detection** — var usage, == equality, eval, console.log, TODO comments
- **Maintainability Index** — Weighted composite (0–100, Halstead-based)
- **ML Smell Detection** — Rule-based Random Forest simulation
- **AI Suggestions** — Contextual refactoring recommendations with code examples

### Database (SQLite via better-sqlite3)
- **analyses** table — stores code, metrics, score, grade
- **feedback** table — stores ratings, roles, comments

---

## Offline Mode

The frontend runs completely client-side if the backend is not available. All analysis, history (localStorage), and feedback work without a server.

---

## Sample Codes

Two built-in samples:
- **Good Sample** — Clean, well-structured JavaScript (should score A or B)
- **Bad Sample** — Problematic code with deep nesting, duplication, and god functions (should score D or F)

---

## Metrics Reference

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Cyclomatic Complexity | ≤10 | 11–20 | >20 |
| Cognitive Complexity | ≤15 | 16–25 | >25 |
| Max Nesting | ≤3 | 4–5 | >5 |
| Maintainability Index | ≥80 (A) | 40–79 (B/C) | <40 (D/F) |
| Duplication | ≤10% | 11–30% | >30% |
| Comment Ratio | ≥10% | 5–9% | <5% |

---

## Tech Stack

- **Frontend** — Vanilla HTML/CSS/JavaScript (no framework required)
- **Backend** — Node.js + Express
- **Database** — SQLite (via better-sqlite3)
- **Fonts** — Syne (display) + Space Mono (code)
