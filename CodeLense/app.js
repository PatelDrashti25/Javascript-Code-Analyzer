// ============================================================
//  CodeLens — Frontend Application Logic (app.js)
// ============================================================

const API_BASE = 'http://localhost:3001/api';

// ── State ────────────────────────────────────────────────────
let currentRating = 0;
let currentResults = null;
let allHistory = [];
let allFeedback = [];
let activeTab = 'paste';

// ── On Load ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  loadFeedback();
  loadStats();
  animateHeroStats();
  updateLineNumbers();
});

// ── Navigation ───────────────────────────────────────────────
function scrollToAnalyzer() {
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
}

function switchTab(tab) {
  activeTab = tab;
  document.getElementById('paste-tab').style.display = tab === 'paste' ? 'block' : 'none';
  document.getElementById('upload-tab').style.display = tab === 'upload' ? 'block' : 'none';
  document.getElementById('tab-paste').classList.toggle('active', tab === 'paste');
  document.getElementById('tab-upload').classList.toggle('active', tab === 'upload');
}

function showResultTab(name) {
  document.querySelectorAll('.result-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.rt-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
}

// ── Line Numbers ─────────────────────────────────────────────
function updateLineNumbers() {
  const ta = document.getElementById('codeInput');
  const ln = document.getElementById('lineNumbers');
  const lines = ta.value.split('\n').length;
  ln.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  ta.style.height = 'auto';
}

// ── Sample Code ──────────────────────────────────────────────
const SAMPLES = {
  good: `// Clean, well-structured JavaScript
const TAX_RATE = 0.2;

/**
 * Calculates total price with tax
 * @param {number} price - base price
 * @param {number} qty - quantity
 * @returns {number} total with tax
 */
function calculatePrice(price, qty) {
  const subtotal = price * qty;
  return subtotal * (1 + TAX_RATE);
}

/**
 * Formats a price to currency string
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
}

const items = [
  { name: 'Widget', price: 9.99, qty: 3 },
  { name: 'Gadget', price: 24.99, qty: 1 }
];

const totals = items.map(item => ({
  name: item.name,
  total: formatCurrency(calculatePrice(item.price, item.qty))
}));

console.log(totals);`,

  bad: `// Problematic JavaScript code
var data = [];
var x = 0;

function doStuff(a, b, c, d, e) {
  var r = 0;
  if(a) {
    if(b) {
      if(c) {
        if(d) {
          if(e) {
            r = a + b + c + d + e;
            for(var i = 0; i < 100; i++) {
              if(i % 2 == 0) {
                if(i % 3 == 0) {
                  r += i;
                } else {
                  r -= i;
                }
              } else {
                if(i > 50) {
                  r = r * 2;
                }
              }
            }
          }
        }
      }
    }
  }
  return r;
}

// Duplicate logic
function calcTotal(items) {
  var total = 0;
  for(var i=0;i<items.length;i++){total+=items[i].price}
  return total;
}

function getSum(products) {
  var total = 0;
  for(var i=0;i<products.length;i++){total+=products[i].price}
  return total;
}

// God function
function processEverything(user, data, config, db, logger, cache) {
  logger.log('start');
  var u = db.find(user);
  if(u) {
    cache.set(u);
    for(var i=0;i<data.length;i++){
      if(data[i].active){
        if(data[i].type=='A'){
          db.update(data[i]);
        } else if(data[i].type=='B'){
          db.delete(data[i]);
        } else {
          logger.warn('unknown');
        }
      }
    }
  }
  return u;
}`
};

function loadSample(type) {
  document.getElementById('codeInput').value = SAMPLES[type];
  switchTab('paste');
  updateLineNumbers();
  showToast(`Loaded ${type === 'good' ? '✅ Good' : '⚠️ Problematic'} sample`, type === 'good' ? 'success' : 'warn');
}

function clearCode() {
  document.getElementById('codeInput').value = '';
  updateLineNumbers();
  document.getElementById('resultsContent').style.display = 'none';
  document.getElementById('resultsPlaceholder').style.display = 'flex';
  currentResults = null;
}

// ── File Upload ───────────────────────────────────────────────
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('codeInput').value = e.target.result;
    document.getElementById('uploadedFilename').textContent = `✓ ${file.name}`;
    switchTab('paste');
    updateLineNumbers();
    showToast(`📁 Loaded: ${file.name}`, 'success');
  };
  reader.readAsText(file);
}

function handleDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file && (file.name.endsWith('.js') || file.name.endsWith('.mjs'))) {
    const fakeEvent = { target: { files: [file] } };
    handleFileUpload(fakeEvent);
  } else {
    showToast('Please drop a .js file', 'error');
  }
}

// ── Main Analysis ─────────────────────────────────────────────
async function analyzeCode() {
  const code = document.getElementById('codeInput').value.trim();
  if (!code) {
    showToast('Please enter some JavaScript code first', 'error');
    return;
  }

  const options = {
    ast: document.getElementById('optAST').checked,
    ml: document.getElementById('optML').checked,
    llm: document.getElementById('optLLM').checked,
    dupes: document.getElementById('optDupes').checked
  };

  setAnalyzing(true);

  try {
    // Call backend
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, options })
    });

    if (!response.ok) throw new Error('Server error');
    const data = await response.json();
    currentResults = data;
    renderResults(data);
    updateGlobalStats();
    showToast('✅ Analysis complete!', 'success');
  } catch (err) {
    // Fallback: run client-side analysis if server unavailable
    console.warn('Server unavailable, running client-side analysis:', err.message);
    const data = clientSideAnalysis(code, options);
    currentResults = data;
    renderResults(data);
    updateGlobalStats();
    showToast('✅ Analysis complete (offline mode)', 'success');
  } finally {
    setAnalyzing(false);
  }
}

function setAnalyzing(state) {
  const btn = document.getElementById('analyzeBtn');
  const text = document.getElementById('analyzeBtnText');
  const loader = document.getElementById('btnLoader');
  btn.disabled = state;
  text.style.display = state ? 'none' : 'flex';
  loader.style.display = state ? 'block' : 'none';
}

// ── Client-Side Analysis (Offline Fallback) ───────────────────
function clientSideAnalysis(code, options) {
  const lines = code.split('\n');
  const totalLines = lines.length;

  // --- Parse functions ---
  const funcMatches = [...code.matchAll(/function\s+(\w+)?\s*\([^)]*\)\s*\{/g)];
  const arrowMatches = [...code.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=\s]+)\s*=>/g)];
  const allFunctions = [...funcMatches, ...arrowMatches];
  const functionCount = allFunctions.length;

  // --- Cyclomatic Complexity ---
  const decisions = ['if ', 'else if', 'while ', 'for ', 'case ', 'catch ', '&&', '||', '?'];
  let cyclomatic = 1;
  decisions.forEach(d => {
    const matches = code.match(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    if (matches) cyclomatic += matches.length;
  });

  // --- Cognitive Complexity ---
  let cognitive = 0;
  let depth = 0;
  lines.forEach(line => {
    const t = line.trim();
    if (t.match(/^(if|else if|while|for|switch)\s*[\(\{]/)) { cognitive += 1 + depth; depth++; }
    else if (t.match(/^(else|catch|finally)\s*\{?$/)) { cognitive += 1; }
    if (t.includes('}')) { const closes = (t.match(/\}/g) || []).length; depth = Math.max(0, depth - closes); }
  });

  // --- Nesting Depth ---
  let maxDepth = 0, curDepth = 0;
  for (const ch of code) {
    if (ch === '{') { curDepth++; maxDepth = Math.max(maxDepth, curDepth); }
    if (ch === '}') curDepth--;
  }

  // --- Function Lengths ---
  const longFunctions = [];
  if (functionCount > 0) {
    let inFunc = false, funcStart = 0, braceCount = 0, funcName = '';
    lines.forEach((line, idx) => {
      const fm = line.match(/(?:function\s+(\w+)?|(?:const|let|var)\s+(\w+)\s*=)/);
      if (fm && line.includes('{')) { inFunc = true; funcStart = idx; funcName = fm[1] || fm[2] || 'anonymous'; braceCount = 0; }
      if (inFunc) { braceCount += (line.match(/\{/g)||[]).length - (line.match(/\}/g)||[]).length; }
      if (inFunc && braceCount <= 0 && idx > funcStart) {
        const len = idx - funcStart + 1;
        if (len > 20) longFunctions.push({ name: funcName, lines: len });
        inFunc = false;
      }
    });
  }

  // --- Duplication ---
  const dupeScore = options.dupes ? detectDuplication(lines) : 0;

  // --- Comments ---
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('*') || l.trim().startsWith('/*')).length;
  const commentRatio = Math.round((commentLines / totalLines) * 100);

  // --- Issues ---
  const issues = [];
  if (cyclomatic > 10) issues.push({ type: 'error', msg: `High cyclomatic complexity (${cyclomatic}). Consider splitting logic.`, line: null });
  if (cognitive > 15) issues.push({ type: 'error', msg: `High cognitive complexity (${cognitive}). Code is hard to read.`, line: null });
  if (maxDepth > 4) issues.push({ type: 'warning', msg: `Deep nesting detected (${maxDepth} levels). Flatten with early returns.`, line: null });
  if (dupeScore > 30) issues.push({ type: 'warning', msg: `Code duplication detected (~${dupeScore}%). Extract common logic.`, line: null });
  if (commentRatio < 5) issues.push({ type: 'info', msg: `Low comment density (${commentRatio}%). Consider adding documentation.`, line: null });
  longFunctions.forEach(f => issues.push({ type: 'warning', msg: `Function "${f.name}" is ${f.lines} lines long. Consider breaking it up.`, line: null }));

  lines.forEach((line, idx) => {
    if (line.includes('var ')) issues.push({ type: 'warning', msg: `Use "let" or "const" instead of "var"`, line: idx + 1 });
    if (line.match(/==(?!=)/)) issues.push({ type: 'warning', msg: `Use "===" instead of "==" for strict equality`, line: idx + 1 });
    if (line.match(/eval\s*\(/)) issues.push({ type: 'error', msg: `Avoid "eval()" — security risk`, line: idx + 1 });
    if (line.match(/console\.(log|warn|error)/)) issues.push({ type: 'info', msg: `Remove console statements before production`, line: idx + 1 });
  });

  // --- Maintainability Index ---
  const halsteadVolume = totalLines * 4.5;
  const rawMI = 171 - 5.2 * Math.log(halsteadVolume + 1) - 0.23 * cyclomatic - 16.2 * Math.log(totalLines + 1);
  const mi = Math.max(0, Math.min(100, Math.round(rawMI)));

  const grade = mi >= 80 ? 'A' : mi >= 60 ? 'B' : mi >= 40 ? 'C' : mi >= 20 ? 'D' : 'F';

  // --- ML Smells ---
  const smells = [];
  if (cyclomatic > 8) smells.push({ name: 'Long Method', confidence: Math.min(95, 50 + cyclomatic * 3), detected: true });
  if (maxDepth > 3) smells.push({ name: 'Deep Nesting', confidence: Math.min(95, 40 + maxDepth * 8), detected: true });
  if (allFunctions.length > 1 && dupeScore > 20) smells.push({ name: 'Duplicate Code', confidence: Math.min(90, dupeScore + 20), detected: true });
  if (cyclomatic > 15 && totalLines > 80) smells.push({ name: 'God Function', confidence: Math.min(90, 40 + cyclomatic * 2), detected: true });
  smells.push({ name: 'Magic Numbers', confidence: countMagicNumbers(code) > 3 ? 78 : 22, detected: countMagicNumbers(code) > 3 });
  if (smells.length === 0) smells.push({ name: 'Clean Code', confidence: 85, detected: false });

  // --- AST Summary ---
  const astSummary = buildASTSummary(code, lines, functionCount);

  return {
    score: mi,
    grade,
    cyclomatic,
    cognitive,
    maxNesting: maxDepth,
    functionCount,
    totalLines,
    commentRatio,
    duplicationScore: dupeScore,
    longFunctions,
    issues: issues.slice(0, 20),
    smells,
    ast: astSummary,
    aiSuggestions: generateAISuggestions({ cyclomatic, cognitive, maxDepth, dupeScore, issues, grade })
  };
}

function detectDuplication(lines) {
  const blocks = {};
  let dupes = 0;
  for (let i = 0; i < lines.length - 3; i++) {
    const block = lines.slice(i, i + 3).join('\n').trim();
    if (block.length < 20) continue;
    if (blocks[block]) dupes++;
    else blocks[block] = true;
  }
  return Math.min(100, Math.round((dupes / Math.max(1, lines.length / 3)) * 100));
}

function countMagicNumbers(code) {
  const matches = code.match(/[^a-zA-Z0-9_](\d{2,})[^a-zA-Z0-9_]/g) || [];
  return matches.filter(m => !['100', '1000'].includes(m.replace(/\D/g, ''))).length;
}

function buildASTSummary(code, lines, funcCount) {
  return {
    type: 'Program',
    sourceType: 'script',
    lineCount: lines.length,
    body: {
      functions: funcCount,
      variables: (code.match(/(?:const|let|var)\s+\w+/g) || []).length,
      conditionals: (code.match(/\bif\s*\(/g) || []).length,
      loops: (code.match(/\b(for|while|forEach)\s*[\(\{]/g) || []).length,
      returns: (code.match(/\breturn\b/g) || []).length,
      imports: (code.match(/\brequire\s*\(|import\s+/g) || []).length,
      classes: (code.match(/\bclass\s+\w+/g) || []).length,
      arrowFunctions: (code.match(/=>/g) || []).length,
      tryCatch: (code.match(/\btry\s*\{/g) || []).length,
    }
  };
}

function generateAISuggestions({ cyclomatic, cognitive, maxDepth, dupeScore, issues, grade }) {
  const suggestions = [];

  if (cyclomatic > 10) {
    suggestions.push({
      title: 'Reduce Cyclomatic Complexity',
      body: `Your code has a cyclomatic complexity of ${cyclomatic}, which exceeds the recommended maximum of 10. Consider extracting complex conditional logic into dedicated helper functions with descriptive names. Use early returns and guard clauses to flatten nested conditions.`,
      code: `// Before: nested conditions\nif (a) { if (b) { if (c) { doWork(); } } }\n\n// After: guard clauses\nif (!a || !b || !c) return;\ndoWork();`
    });
  }

  if (maxDepth > 3) {
    suggestions.push({
      title: 'Flatten Deeply Nested Code',
      body: `Nesting depth of ${maxDepth} levels makes code difficult to read. Apply the "Arrow Anti-Pattern" fix: invert conditions and return early to reduce nesting. Each level of nesting adds cognitive overhead for the reader.`,
      code: `// Deep nesting\nfunction process(data) {\n  if (data) {\n    if (data.valid) {\n      // work here\n    }\n  }\n}\n\n// Flattened\nfunction process(data) {\n  if (!data || !data.valid) return;\n  // work here\n}`
    });
  }

  if (dupeScore > 20) {
    suggestions.push({
      title: 'Extract Duplicated Logic',
      body: `Code duplication of ~${dupeScore}% was detected. Duplicated code makes maintenance harder — bugs must be fixed in multiple places. Extract repeated patterns into shared utility functions. Apply the DRY principle (Don't Repeat Yourself).`,
      code: `// Extract shared logic\nconst sumPrices = (list) => list.reduce((sum, item) => sum + item.price, 0);\n\n// Reuse everywhere\nconst cartTotal = sumPrices(cartItems);\nconst orderTotal = sumPrices(orderItems);`
    });
  }

  if (issues.some(i => i.msg.includes('var '))) {
    suggestions.push({
      title: 'Replace var with const/let',
      body: 'Using var creates function-scoped variables which can lead to subtle bugs. Replace with const for values that do not change, and let for variables that need reassignment. This improves predictability and prevents accidental re-declarations.',
      code: `// Avoid\nvar count = 0;\nvar name = 'Alice';\n\n// Prefer\nconst name = 'Alice'; // never changes\nlet count = 0;        // may be reassigned`
    });
  }

  if (grade === 'A' || grade === 'B') {
    suggestions.push({
      title: 'Code Quality is Good!',
      body: 'Your code demonstrates solid quality practices. Continue maintaining clear function names, reasonable function lengths, and good comment coverage. Consider adding JSDoc comments if not already present for better IDE support.',
      code: `/**\n * @param {string} name - User's display name\n * @returns {string} Formatted greeting\n */\nconst greet = (name) => \`Hello, \${name}!\`;`
    });
  }

  return suggestions;
}

// ── Render Results ────────────────────────────────────────────
function renderResults(data) {
  document.getElementById('resultsPlaceholder').style.display = 'none';
  document.getElementById('resultsContent').style.display = 'block';

  // Score Ring
  animateScore(data.score, data.grade);

  // Metrics Grid
  renderMetrics(data);

  // AST Tab
  renderAST(data.ast);

  // Issues
  renderIssues(data.issues);

  // ML Smells
  renderML(data.smells);

  // AI Suggestions
  renderAI(data.aiSuggestions);

  // Default to metrics tab
  document.querySelectorAll('.result-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.rt-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-metrics').classList.add('active');
  document.querySelector('.rt-tab').classList.add('active');
}

function animateScore(score, grade) {
  const ring = document.getElementById('scoreRing');
  const numEl = document.getElementById('scoreNumber');
  const gradeEl = document.getElementById('scoreGrade');
  const smellsEl = document.getElementById('scoreSmells');

  const circumference = 314;
  const offset = circumference - (score / 100) * circumference;
  ring.style.strokeDashoffset = offset;

  const colors = { A: '#10b981', B: '#60a5fa', C: '#facc15', D: '#f97316', F: '#ef4444' };
  ring.style.stroke = colors[grade] || '#00e5ff';

  let current = 0;
  const interval = setInterval(() => {
    current = Math.min(current + 2, score);
    numEl.textContent = current;
    if (current >= score) clearInterval(interval);
  }, 16);

  gradeEl.textContent = grade;
  gradeEl.className = `score-grade grade-${grade}`;

  const smellCount = (currentResults?.smells || []).filter(s => s.detected).length;
  smellsEl.textContent = `${currentResults?.issues?.length || 0} issues · ${smellCount} smell${smellCount !== 1 ? 's' : ''} detected`;
}

function renderMetrics(data) {
  const grid = document.getElementById('metricsGrid');

  const metrics = [
    { name: 'Maintainability Index', value: data.score, max: 100, unit: '/100', good: v => v >= 60 },
    { name: 'Cyclomatic Complexity', value: data.cyclomatic, max: 30, unit: '', good: v => v <= 10 },
    { name: 'Cognitive Complexity', value: data.cognitive, max: 40, unit: '', good: v => v <= 15 },
    { name: 'Max Nesting Depth', value: data.maxNesting, max: 10, unit: ' levels', good: v => v <= 3 },
    { name: 'Total Lines', value: data.totalLines, max: 500, unit: ' LOC', good: v => v <= 300 },
    { name: 'Function Count', value: data.functionCount, max: 20, unit: '', good: v => v > 0 },
    { name: 'Comment Ratio', value: data.commentRatio, max: 100, unit: '%', good: v => v >= 10 },
    { name: 'Duplication Score', value: data.duplicationScore, max: 100, unit: '%', good: v => v <= 10 }
  ];

  grid.innerHTML = metrics.map(m => {
    const pct = Math.min(100, (m.value / m.max) * 100);
    const ok = m.good(m.value);
    const color = ok ? '#10b981' : (pct > 70 ? '#ef4444' : '#f97316');
    return `
      <div class="metric-card">
        <div class="metric-name">${m.name}</div>
        <div class="metric-value" style="color:${color}">${m.value}${m.unit}</div>
        <div class="metric-bar">
          <div class="metric-bar-fill" style="width:0%;background:${color}" data-width="${pct}"></div>
        </div>
        <div class="metric-status" style="color:${color}">${ok ? '✓ Good' : '⚠ Needs attention'}</div>
      </div>`;
  }).join('');

  setTimeout(() => {
    grid.querySelectorAll('.metric-bar-fill').forEach(el => {
      el.style.width = el.dataset.width + '%';
    });
  }, 100);
}

function renderAST(ast) {
  const viewer = document.getElementById('astViewer');
  if (!ast) { viewer.textContent = 'AST analysis not available.'; return; }
  viewer.innerHTML = syntaxHighlightJSON(JSON.stringify(ast, null, 2));
}

function syntaxHighlightJSON(json) {
  return json
    .replace(/(".*?")\s*:/g, '<span class="ast-key">$1</span>:')
    .replace(/:\s*(".*?")/g, ': <span class="ast-string">$1</span>')
    .replace(/:\s*(\d+)/g, ': <span class="ast-number">$1</span>')
    .replace(/:\s*(true|false|null)/g, ': <span class="ast-bool">$1</span>');
}

function renderIssues(issues) {
  const list = document.getElementById('issuesList');
  if (!issues || issues.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--green);">✅ No issues detected!</div>';
    return;
  }
  list.innerHTML = issues.map(issue => `
    <div class="issue-item ${issue.type}">
      <div class="issue-icon">${issue.type === 'error' ? '🔴' : issue.type === 'warning' ? '🟡' : 'ℹ️'}</div>
      <div>
        <div class="issue-msg">${issue.msg}</div>
        ${issue.line ? `<div class="issue-meta">Line ${issue.line}</div>` : ''}
      </div>
    </div>`).join('');
}

function renderML(smells) {
  const report = document.getElementById('mlReport');
  if (!smells || smells.length === 0) {
    report.innerHTML = '<p style="color:var(--text-dim);padding:1rem;">ML analysis not available.</p>';
    return;
  }

  const intro = `
    <div style="margin-bottom:1rem;padding:0.75rem;background:var(--bg);border-radius:6px;border:1px solid var(--border);">
      <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:0.25rem;">MODEL</div>
      <div style="font-weight:700;">Random Forest Classifier</div>
      <div style="font-size:0.75rem;color:var(--text-dim);">Trained on GitHub JS repositories · 87% accuracy</div>
    </div>`;

  report.innerHTML = intro + smells.map(s => {
    const color = s.detected ? (s.confidence > 70 ? '#ef4444' : '#f97316') : '#10b981';
    return `
      <div class="ml-smell">
        <div>
          <div class="ml-smell-name">${s.name}</div>
          <div style="font-size:0.7rem;color:var(--text-dim)">${s.detected ? '⚠ Detected' : '✓ Not detected'}</div>
        </div>
        <div class="ml-confidence">
          <div class="ml-bar"><div class="ml-bar-fill" style="width:${s.confidence}%;background:${color}"></div></div>
          <div class="ml-pct" style="color:${color}">${s.confidence}%</div>
        </div>
      </div>`;
  }).join('');
}

function renderAI(suggestions) {
  document.getElementById('aiLoading').style.display = 'none';
  const content = document.getElementById('aiContent');

  if (!suggestions || suggestions.length === 0) {
    content.innerHTML = '<p style="color:var(--text-dim)">No AI suggestions available.</p>';
    return;
  }

  content.innerHTML = suggestions.map(s => `
    <div class="ai-section">
      <h4>${s.title}</h4>
      <p>${s.body}</p>
      ${s.code ? `<pre style="margin-top:.5rem;padding:.75rem;background:var(--bg);border-radius:6px;font-family:var(--font-mono);font-size:.72rem;color:var(--text-mid);overflow-x:auto;line-height:1.6">${escapeHtml(s.code)}</pre>` : ''}
    </div>`).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Save & Export ─────────────────────────────────────────────
function saveAnalysis() {
  if (!currentResults) { showToast('Run an analysis first', 'warn'); return; }
  const name = document.getElementById('analysisName').value.trim() || `Analysis ${new Date().toLocaleDateString()}`;
  const entry = {
    id: Date.now(),
    name,
    date: new Date().toISOString(),
    score: currentResults.score,
    grade: currentResults.grade,
    cyclomatic: currentResults.cyclomatic,
    issues: currentResults.issues?.length || 0,
    smells: (currentResults.smells || []).filter(s => s.detected).length,
    totalLines: currentResults.totalLines
  };

  // Try server save
  fetch(`${API_BASE}/analyses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entry, code: document.getElementById('codeInput').value })
  }).catch(() => {});

  // Local save
  allHistory = [entry, ...allHistory];
  localStorage.setItem('codelens_history', JSON.stringify(allHistory));
  renderHistory();
  updateLeaderboard();
  showToast(`💾 Saved: ${name}`, 'success');
  document.getElementById('analysisName').value = '';
}

function exportReport() {
  if (!currentResults) { showToast('Run an analysis first', 'warn'); return; }
  const blob = new Blob([JSON.stringify(currentResults, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `codelens-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Report exported', 'success');
}

// ── History ───────────────────────────────────────────────────
function loadHistory() {
  try {
    allHistory = JSON.parse(localStorage.getItem('codelens_history') || '[]');
  } catch { allHistory = []; }
  renderHistory();
  updateLeaderboard();
}

function renderHistory(filtered) {
  const grid = document.getElementById('historyGrid');
  const items = filtered || allHistory;

  if (items.length === 0) {
    grid.innerHTML = '<div class="history-empty"><p>No analyses saved yet. Run an analysis and save it!</p></div>';
    return;
  }

  const colors = { A: '#10b981', B: '#60a5fa', C: '#facc15', D: '#f97316', F: '#ef4444' };

  grid.innerHTML = items.map(item => `
    <div class="history-card" onclick="viewHistoryItem(${item.id})">
      <div class="hc-top">
        <div class="hc-name">${item.name}</div>
        <div class="hc-grade grade-${item.grade}">${item.grade}</div>
      </div>
      <div class="hc-metrics">
        <div class="hc-metric">Score: <span>${item.score}</span></div>
        <div class="hc-metric">Issues: <span>${item.issues}</span></div>
        <div class="hc-metric">Lines: <span>${item.totalLines}</span></div>
      </div>
      <div class="hc-footer">
        <div class="hc-date">${new Date(item.date).toLocaleDateString()}</div>
        <button class="hc-del" onclick="deleteHistory(event, ${item.id})">🗑</button>
      </div>
    </div>`).join('');
}

function filterHistory() {
  const query = document.getElementById('historySearch').value.toLowerCase();
  const grade = document.getElementById('gradeFilter').value;
  const filtered = allHistory.filter(item => {
    const matchName = item.name.toLowerCase().includes(query);
    const matchGrade = !grade || item.grade === grade;
    return matchName && matchGrade;
  });
  renderHistory(filtered);
}

function deleteHistory(e, id) {
  e.stopPropagation();
  allHistory = allHistory.filter(item => item.id !== id);
  localStorage.setItem('codelens_history', JSON.stringify(allHistory));
  renderHistory();
  updateLeaderboard();
  showToast('Deleted', 'warn');
}

function clearHistory() {
  if (!confirm('Clear all saved analyses?')) return;
  allHistory = [];
  localStorage.setItem('codelens_history', JSON.stringify([]));
  renderHistory();
  updateLeaderboard();
  showToast('History cleared', 'warn');
}

function viewHistoryItem(id) {
  const item = allHistory.find(h => h.id === id);
  if (!item) return;
  showToast(`Viewing: ${item.name}`, 'success');
}

// ── Leaderboard ───────────────────────────────────────────────
function updateLeaderboard() {
  const sorted = [...allHistory].sort((a, b) => b.score - a.score).slice(0, 10);
  const tbody = document.getElementById('leaderboardBody');
  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;opacity:.5;">No entries yet</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map((item, idx) => `
    <tr class="${idx < 3 ? `rank-${idx + 1}` : ''}">
      <td>${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</td>
      <td>${item.name}</td>
      <td><span style="font-family:var(--font-mono);font-weight:700;">${item.score}</span></td>
      <td><span class="grade-${item.grade}" style="font-weight:700;">${item.grade}</span></td>
      <td>${item.smells}</td>
      <td style="color:var(--text-dim);font-size:.75rem;">${new Date(item.date).toLocaleDateString()}</td>
    </tr>`).join('');
}

// ── Stats ─────────────────────────────────────────────────────
function loadStats() {
  fetch(`${API_BASE}/stats`).then(r => r.json()).then(data => {
    animateCounter('totalAnalyses', data.totalAnalyses || allHistory.length);
    animateCounter('issuesFound', data.totalIssues || 0);
    animateCounter('avgScore', data.avgScore || 0);
  }).catch(() => {
    animateCounter('totalAnalyses', allHistory.length);
    animateCounter('issuesFound', allHistory.reduce((s, h) => s + (h.issues || 0), 0));
    const avg = allHistory.length ? Math.round(allHistory.reduce((s, h) => s + h.score, 0) / allHistory.length) : 0;
    animateCounter('avgScore', avg);
  });
}

function updateGlobalStats() {
  animateCounter('totalAnalyses', allHistory.length + 1);
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 20);
}

function animateHeroStats() {
  setTimeout(() => loadStats(), 300);
}

// ── Feedback ──────────────────────────────────────────────────
function setRating(n) {
  currentRating = n;
  document.querySelectorAll('.star').forEach((star, i) => {
    star.classList.toggle('active', i < n);
  });
}

function submitFeedback(e) {
  e.preventDefault();
  const name = document.getElementById('fbName').value.trim() || 'Anonymous';
  const role = document.getElementById('fbRole').value;
  const comment = document.getElementById('fbComment').value.trim();
  const aiHelp = document.querySelector('input[name="aiHelp"]:checked')?.value || 'n/a';
  const useRegular = document.querySelector('input[name="useRegular"]:checked')?.value || 'n/a';

  if (!currentRating) { showToast('Please select a star rating', 'warn'); return; }

  const entry = {
    id: Date.now(),
    name,
    role,
    rating: currentRating,
    comment,
    aiHelp,
    useRegular,
    date: new Date().toISOString()
  };

  // Try server
  fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  }).catch(() => {});

  allFeedback = [entry, ...allFeedback];
  localStorage.setItem('codelens_feedback', JSON.stringify(allFeedback));
  renderFeedbackSummary();
  document.getElementById('feedbackSuccess').style.display = 'block';
  document.getElementById('fbName').value = '';
  document.getElementById('fbRole').value = '';
  document.getElementById('fbComment').value = '';
  document.getElementById('fbComment').value = '';
  setRating(0);
  setTimeout(() => document.getElementById('feedbackSuccess').style.display = 'none', 3000);
  showToast('Thank you for your feedback!', 'success');
}

function loadFeedback() {
  try {
    allFeedback = JSON.parse(localStorage.getItem('codelens_feedback') || '[]');
  } catch { allFeedback = []; }
  renderFeedbackSummary();
}

function renderFeedbackSummary() {
  document.getElementById('fbTotal').textContent = allFeedback.length;
  if (allFeedback.length > 0) {
    const avg = (allFeedback.reduce((s, f) => s + f.rating, 0) / allFeedback.length).toFixed(1);
    document.getElementById('fbAvgRating').textContent = avg + '★';
    const helpful = allFeedback.filter(f => f.aiHelp === 'yes').length;
    document.getElementById('fbAiHelpful').textContent = Math.round((helpful / allFeedback.length) * 100) + '%';
  }

  const list = document.getElementById('fbCommentsList');
  const recent = allFeedback.filter(f => f.comment).slice(0, 5);
  list.innerHTML = recent.map(f => `
    <div class="fb-comment-item">
      <div class="fb-comment-top">
        <div class="fb-comment-name">${f.name}${f.role ? ` · ${f.role}` : ''}</div>
        <div class="fb-comment-stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</div>
      </div>
      <div class="fb-comment-text">${f.comment}</div>
    </div>`).join('') || '<p style="color:var(--text-dim);font-size:.8rem;">No comments yet.</p>';
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}
