// ============================================================
//  CodeLens — Backend Server (server.js)
//  Node.js + Express + SQLite
//  Run: npm install && node server.js
// ============================================================

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

// ── Database Setup ────────────────────────────────────────────
const db = new Database('codelens.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    code        TEXT,
    score       INTEGER,
    grade       TEXT,
    cyclomatic  INTEGER,
    cognitive   INTEGER,
    max_nesting INTEGER,
    total_lines INTEGER,
    issues      INTEGER,
    smells      INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT,
    role        TEXT,
    rating      INTEGER,
    comment     TEXT,
    ai_help     TEXT,
    use_regular TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Static Analysis Engine ────────────────────────────────────
function analyzeJavaScript(code, options = {}) {
  const lines = code.split('\n');
  const totalLines = lines.length;

  // Function detection
  const funcMatches = [...code.matchAll(/function\s+(\w+)?\s*\([^)]*\)\s*\{/g)];
  const arrowMatches = [...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=\s]+)\s*=>/g)];
  const functionCount = funcMatches.length + arrowMatches.length;

  // Cyclomatic Complexity
  const decisions = ['if ', 'else if', 'while ', 'for ', 'case ', 'catch ', '&&', '||', '?'];
  let cyclomatic = 1;
  decisions.forEach(d => {
    const re = new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const m = code.match(re);
    if (m) cyclomatic += m.length;
  });

  // Cognitive Complexity
  let cognitive = 0, depth = 0;
  lines.forEach(line => {
    const t = line.trim();
    if (t.match(/^(if|else if|while|for|switch)\s*[\(\{]/)) { cognitive += 1 + depth; depth++; }
    else if (t.match(/^(else|catch|finally)\s*\{?$/)) cognitive += 1;
    if (t.includes('}')) depth = Math.max(0, depth - (t.match(/\}/g) || []).length);
  });

  // Max Nesting
  let maxNesting = 0, curDepth = 0;
  for (const ch of code) {
    if (ch === '{') { curDepth++; maxNesting = Math.max(maxNesting, curDepth); }
    if (ch === '}') curDepth = Math.max(0, curDepth - 1);
  }

  // Code Duplication
  let duplicationScore = 0;
  if (options.dupes !== false) {
    const blocks = {};
    let dupes = 0;
    for (let i = 0; i < lines.length - 3; i++) {
      const block = lines.slice(i, i + 3).join('\n').trim();
      if (block.length < 20) continue;
      if (blocks[block]) dupes++;
      else blocks[block] = true;
    }
    duplicationScore = Math.min(100, Math.round((dupes / Math.max(1, lines.length / 3)) * 100));
  }

  // Comment Ratio
  const commentLines = lines.filter(l => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  }).length;
  const commentRatio = Math.round((commentLines / totalLines) * 100);

  // Issue Detection
  const issues = [];
  if (cyclomatic > 10) issues.push({ type: 'error', msg: `High cyclomatic complexity (${cyclomatic})` });
  if (cognitive > 15) issues.push({ type: 'error', msg: `High cognitive complexity (${cognitive})` });
  if (maxNesting > 4) issues.push({ type: 'warning', msg: `Deep nesting (${maxNesting} levels)` });
  if (duplicationScore > 30) issues.push({ type: 'warning', msg: `Code duplication ~${duplicationScore}%` });
  if (commentRatio < 5) issues.push({ type: 'info', msg: `Low comment density (${commentRatio}%)` });

  lines.forEach((line, idx) => {
    if (/\bvar\s/.test(line)) issues.push({ type: 'warning', msg: 'Use const/let instead of var', line: idx + 1 });
    if (/[^=!<>]==[^=]/.test(line)) issues.push({ type: 'warning', msg: 'Use === instead of ==', line: idx + 1 });
    if (/\beval\s*\(/.test(line)) issues.push({ type: 'error', msg: 'Avoid eval() — security risk', line: idx + 1 });
    if (/console\.(log|warn|error)/.test(line)) issues.push({ type: 'info', msg: 'Remove console statements', line: idx + 1 });
    if (/TODO|FIXME|HACK/.test(line)) issues.push({ type: 'info', msg: `Found ${line.match(/TODO|FIXME|HACK/)[0]} comment`, line: idx + 1 });
  });

  // Long functions
  let inFunc = false, funcStart = 0, braceCount = 0, funcName = '';
  lines.forEach((line, idx) => {
    const fm = line.match(/(?:function\s+(\w+)?|(?:const|let|var)\s+(\w+)\s*=)/);
    if (fm && line.includes('{')) { inFunc = true; funcStart = idx; funcName = fm[1] || fm[2] || 'anonymous'; braceCount = 0; }
    if (inFunc) { braceCount += (line.match(/\{/g)||[]).length - (line.match(/\}/g)||[]).length; }
    if (inFunc && braceCount <= 0 && idx > funcStart) {
      const len = idx - funcStart + 1;
      if (len > 25) issues.push({ type: 'warning', msg: `Function "${funcName}" is ${len} lines — consider splitting`, line: funcStart + 1 });
      inFunc = false;
    }
  });

  // Maintainability Index
  const halsteadVolume = totalLines * 4.5;
  const rawMI = 171 - 5.2 * Math.log(halsteadVolume + 1) - 0.23 * cyclomatic - 16.2 * Math.log(totalLines + 1);
  const score = Math.max(0, Math.min(100, Math.round(rawMI)));
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';

  // ML Smells Simulation
  const smells = [];
  if (cyclomatic > 8) smells.push({ name: 'Long Method', confidence: Math.min(95, 50 + cyclomatic * 3), detected: true });
  if (maxNesting > 3) smells.push({ name: 'Deep Nesting', confidence: Math.min(95, 40 + maxNesting * 8), detected: true });
  if (duplicationScore > 20) smells.push({ name: 'Duplicate Code', confidence: Math.min(90, duplicationScore + 20), detected: true });
  if (cyclomatic > 15 && totalLines > 80) smells.push({ name: 'God Function', confidence: Math.min(90, 40 + cyclomatic * 2), detected: true });
  const magicNums = (code.match(/[^a-zA-Z0-9_](\d{2,})/g) || []).length;
  smells.push({ name: 'Magic Numbers', confidence: magicNums > 3 ? 78 : 22, detected: magicNums > 3 });
  smells.push({ name: 'Missing Comments', confidence: commentRatio < 5 ? 80 : 20, detected: commentRatio < 5 });

  // AST Summary
  const ast = {
    type: 'Program',
    sourceType: code.includes('import ') || code.includes('export ') ? 'module' : 'script',
    lineCount: totalLines,
    body: {
      functions: functionCount,
      variables: (code.match(/(?:const|let|var)\s+\w+/g) || []).length,
      conditionals: (code.match(/\bif\s*\(/g) || []).length,
      loops: (code.match(/\b(for|while|forEach)\s*[\(\{]/g) || []).length,
      returns: (code.match(/\breturn\b/g) || []).length,
      imports: (code.match(/\brequire\s*\(|import\s+/g) || []).length,
      classes: (code.match(/\bclass\s+\w+/g) || []).length,
      arrowFunctions: (code.match(/=>/g) || []).length,
      tryCatch: (code.match(/\btry\s*\{/g) || []).length,
      ternary: (code.match(/\?(?!=)/g) || []).length,
      async: (code.match(/\basync\s+/g) || []).length,
    }
  };

  // AI Suggestions
  const aiSuggestions = generateSuggestions({ cyclomatic, cognitive, maxNesting, duplicationScore, issues, grade, commentRatio });

  return {
    score, grade, cyclomatic, cognitive,
    maxNesting, functionCount, totalLines,
    commentRatio, duplicationScore,
    issues: issues.slice(0, 25),
    smells, ast, aiSuggestions
  };
}

function generateSuggestions({ cyclomatic, cognitive, maxNesting, duplicationScore, issues, grade, commentRatio }) {
  const suggestions = [];

  if (cyclomatic > 10) suggestions.push({
    title: 'Reduce Cyclomatic Complexity',
    body: `Cyclomatic complexity is ${cyclomatic} — exceeding the recommended maximum of 10. Extract complex conditional logic into focused helper functions, and use guard clauses (early returns) to flatten conditions. Each function should do one thing well.`,
    code: `// Before\nfunction validate(user) {\n  if (user) {\n    if (user.age > 0) {\n      if (user.email) { return true; }\n    }\n  }\n  return false;\n}\n\n// After\nfunction validate(user) {\n  if (!user) return false;\n  if (user.age <= 0) return false;\n  if (!user.email) return false;\n  return true;\n}`
  });

  if (maxNesting > 3) suggestions.push({
    title: 'Flatten Deeply Nested Code',
    body: `Nesting depth of ${maxNesting} makes code hard to read and test. Invert conditions to return early, extract inner blocks into named functions, and consider replacing loops with Array methods like .filter(), .map(), and .reduce().`,
    code: `// Instead of nested loops\nconst result = data\n  .filter(item => item.active)\n  .map(item => item.value)\n  .reduce((sum, v) => sum + v, 0);`
  });

  if (duplicationScore > 20) suggestions.push({
    title: 'Extract Duplicated Logic',
    body: `~${duplicationScore}% code duplication detected. Extract shared patterns into reusable utility functions. Apply the DRY principle — bugs in duplicated code must be fixed in every copy, and duplication signals an abstraction waiting to be created.`,
    code: `// Extract shared logic into utilities\nconst sumBy = (arr, key) => arr.reduce((s, i) => s + i[key], 0);\n\nconst cartTotal = sumBy(cartItems, 'price');\nconst orderTotal = sumBy(orderItems, 'price');`
  });

  if (issues.some(i => i.msg.includes('var'))) suggestions.push({
    title: 'Modernise Variable Declarations',
    body: 'Replace var with const and let. var is function-scoped and hoisted, which can cause subtle bugs. const communicates immutability, and let signals re-assignment. Both are block-scoped, which makes code more predictable.',
    code: `const PI = 3.14159;       // never changes\nlet counter = 0;          // will be reassigned\n\n// Avoid\nvar name = 'Alice'; // function-scoped, hoisted`
  });

  if (commentRatio < 5) suggestions.push({
    title: 'Add Documentation Comments',
    body: 'Low comment density detected. Add JSDoc comments to exported functions to improve IDE support and code maintainability. Focus on the "why" rather than the "what" when writing comments.',
    code: `/**\n * Calculates the discounted price\n * @param {number} price - Original price in GBP\n * @param {number} discount - Discount percentage (0-100)\n * @returns {number} Final price after discount\n */\nfunction applyDiscount(price, discount) {\n  return price * (1 - discount / 100);\n}`
  });

  if ((grade === 'A' || grade === 'B') && suggestions.length < 2) suggestions.push({
    title: '✅ Excellent Code Quality!',
    body: 'Your code demonstrates strong quality practices. It has good maintainability, manageable complexity, and clean structure. Consider these advanced improvements: add TypeScript types for better IDE support, add unit tests for each function, and consider performance profiling for hot paths.',
    code: null
  });

  return suggestions;
}

// ── Routes ────────────────────────────────────────────────────

// POST /api/analyze
app.post('/api/analyze', (req, res) => {
  try {
    const { code, options = {} } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code is required' });
    }
    if (code.length > 100000) {
      return res.status(400).json({ error: 'Code too large (max 100KB)' });
    }
    const result = analyzeJavaScript(code, options);
    res.json(result);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed', message: err.message });
  }
});

// POST /api/analyses — save analysis
app.post('/api/analyses', (req, res) => {
  try {
    const { name, code, score, grade, cyclomatic, cognitive, max_nesting, total_lines, issues, smells } = req.body;
    const stmt = db.prepare(`
      INSERT INTO analyses (name, code, score, grade, cyclomatic, cognitive, max_nesting, total_lines, issues, smells)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, code, score, grade, cyclomatic, cognitive, max_nesting, total_lines, issues, smells);
    res.json({ id: result.lastInsertRowid, message: 'Saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analyses
app.get('/api/analyses', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM analyses ORDER BY created_at DESC LIMIT 100').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/analyses/:id
app.delete('/api/analyses/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM analyses WHERE id = ?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/feedback
app.post('/api/feedback', (req, res) => {
  try {
    const { name, role, rating, comment, ai_help, use_regular } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1-5' });
    }
    const stmt = db.prepare(`
      INSERT INTO feedback (name, role, rating, comment, ai_help, use_regular)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name || 'Anonymous', role, rating, comment, ai_help, use_regular);
    res.json({ id: result.lastInsertRowid, message: 'Feedback saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/feedback
app.get('/api/feedback', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 50').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  try {
    const totalAnalyses = db.prepare('SELECT COUNT(*) as cnt FROM analyses').get().cnt;
    const totalIssues = db.prepare('SELECT SUM(issues) as total FROM analyses').get().total || 0;
    const avgScoreRow = db.prepare('SELECT AVG(score) as avg FROM analyses').get();
    const avgScore = avgScoreRow.avg ? Math.round(avgScoreRow.avg) : 0;
    const gradeDistRow = db.prepare("SELECT grade, COUNT(*) as cnt FROM analyses GROUP BY grade").all();
    res.json({ totalAnalyses, totalIssues, avgScore, gradeDistribution: gradeDistRow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, score, grade, smells, created_at FROM analyses ORDER BY score DESC LIMIT 10').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   CodeLens Backend — Running         ║
║   http://localhost:${PORT}              ║
╚══════════════════════════════════════╝
  `);
  console.log('Database: codelens.db (SQLite)');
  console.log('Endpoints:');
  console.log('  POST /api/analyze      — Analyze JavaScript code');
  console.log('  GET  /api/analyses     — List saved analyses');
  console.log('  POST /api/analyses     — Save analysis');
  console.log('  DELETE /api/analyses/:id — Delete analysis');
  console.log('  POST /api/feedback     — Submit feedback');
  console.log('  GET  /api/feedback     — Get all feedback');
  console.log('  GET  /api/stats        — Usage statistics');
  console.log('  GET  /api/leaderboard  — Top analyses');
  console.log('  GET  /api/health       — Health check');
});

module.exports = app;
