import {
  parseVpl,
  serialiseVpl,
  toHex,
  colorsEqual,
  C64_COLOR_NAMES,
} from './vpl.js';
import {
  loadUserPalettes,
  addUserPalette,
  removeUserPalette,
} from './store.js';
import { initTheme } from './theme.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// All palettes available to compare, keyed by a stable key.
// Each entry: { key, name, source: 'server'|'user', id?, colors: [...] }
const palettes = new Map();

// Keys currently selected for the comparison view, in display order.
const selected = new Set();

// Which palette acts as the diff reference (a key), or null for "leftmost".
let referenceKey = null;

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const els = {
  serverList: document.getElementById('server-list'),
  userList: document.getElementById('user-list'),
  fileInput: document.getElementById('file-input'),
  dropZone: document.getElementById('drop-zone'),
  comparison: document.getElementById('comparison'),
  refSelect: document.getElementById('reference-select'),
  showHex: document.getElementById('toggle-hex'),
  showDiffOnly: document.getElementById('toggle-diff-only'),
  status: document.getElementById('status'),
  themeToggle: document.getElementById('theme-toggle'),
};

// ---------------------------------------------------------------------------
// Server palettes
// ---------------------------------------------------------------------------

async function loadServerPalettes() {
  let names;
  try {
    const res = await fetch('palettes/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    names = await res.json();
  } catch (e) {
    setStatus(
      'Could not load server palettes. If you opened this file directly, ' +
        'serve the folder over HTTP (e.g. `python3 -m http.server`) — browsers ' +
        'block fetch() on file:// URLs. Uploads still work.',
      'error',
    );
    return;
  }

  const results = await Promise.all(
    names.map(async (file) => {
      try {
        const res = await fetch(`palettes/${file}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const colors = parseVpl(await res.text());
        return { file, colors };
      } catch (e) {
        console.warn(`Failed to load palette ${file}:`, e);
        return null;
      }
    }),
  );

  for (const r of results) {
    if (!r) continue;
    const key = `server:${r.file}`;
    palettes.set(key, {
      key,
      name: r.file.replace(/\.vpl$/i, ''),
      source: 'server',
      colors: r.colors,
    });
    selected.add(key); // server palettes are shown by default
  }
}

// ---------------------------------------------------------------------------
// User palettes (localStorage)
// ---------------------------------------------------------------------------

function loadStoredUserPalettes() {
  for (const rec of loadUserPalettes()) {
    const key = `user:${rec.id}`;
    palettes.set(key, {
      key,
      name: rec.name,
      source: 'user',
      id: rec.id,
      colors: rec.colors,
    });
    selected.add(key);
  }
}

async function handleFiles(fileList) {
  const files = Array.from(fileList);
  let added = 0;
  const errors = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const colors = parseVpl(text);
      const name = file.name.replace(/\.vpl$/i, '');
      const rec = addUserPalette(name, colors);
      const key = `user:${rec.id}`;
      palettes.set(key, {
        key,
        name: rec.name,
        source: 'user',
        id: rec.id,
        colors: rec.colors,
      });
      selected.add(key);
      added++;
    } catch (e) {
      errors.push(`${file.name}: ${e.message}`);
    }
  }

  render();
  if (added) setStatus(`Added ${added} palette${added > 1 ? 's' : ''}.`, 'ok');
  if (errors.length) setStatus(errors.join(' · '), 'error');
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  renderPaletteLists();
  renderReferenceSelect();
  renderComparison();
}

function renderPaletteLists() {
  const server = [...palettes.values()].filter((p) => p.source === 'server');
  const user = [...palettes.values()].filter((p) => p.source === 'user');

  els.serverList.innerHTML = '';
  for (const p of server) els.serverList.appendChild(paletteListItem(p));
  if (server.length === 0) {
    els.serverList.innerHTML = '<li class="empty">No server palettes loaded.</li>';
  }

  els.userList.innerHTML = '';
  for (const p of user) els.userList.appendChild(paletteListItem(p, true));
  if (user.length === 0) {
    els.userList.innerHTML = '<li class="empty">No uploaded palettes yet.</li>';
  }
}

function paletteListItem(p, removable = false) {
  const li = document.createElement('li');

  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = selected.has(p.key);
  cb.addEventListener('change', () => {
    if (cb.checked) selected.add(p.key);
    else selected.delete(p.key);
    renderReferenceSelect();
    renderComparison();
  });
  label.appendChild(cb);

  // Mini swatch strip preview of the palette.
  const strip = document.createElement('span');
  strip.className = 'strip';
  for (const c of p.colors) {
    const sw = document.createElement('span');
    sw.className = 'strip-swatch';
    sw.style.backgroundColor = toHex(c);
    strip.appendChild(sw);
  }
  label.appendChild(strip);

  const name = document.createElement('span');
  name.className = 'pal-name';
  name.textContent = p.name;
  name.title = `${p.colors.length} colours`;
  label.appendChild(name);

  li.appendChild(label);

  const actions = document.createElement('span');
  actions.className = 'actions';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'link';
  exportBtn.textContent = 'export';
  exportBtn.title = 'Download as .vpl';
  exportBtn.addEventListener('click', () => exportPalette(p));
  actions.appendChild(exportBtn);

  if (removable) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'link danger';
    del.textContent = 'remove';
    del.addEventListener('click', () => {
      removeUserPalette(p.id);
      palettes.delete(p.key);
      selected.delete(p.key);
      if (referenceKey === p.key) referenceKey = null;
      render();
    });
    actions.appendChild(del);
  }

  li.appendChild(actions);
  return li;
}

function renderReferenceSelect() {
  const keys = orderedSelectedKeys();
  els.refSelect.innerHTML = '';

  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Leftmost palette';
  els.refSelect.appendChild(auto);

  for (const key of keys) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = palettes.get(key).name;
    els.refSelect.appendChild(opt);
  }

  if (referenceKey && !keys.includes(referenceKey)) referenceKey = null;
  els.refSelect.value = referenceKey || '';
}

// Selected palettes in a stable order: server first, then user, insertion order.
function orderedSelectedKeys() {
  return [...palettes.keys()].filter((k) => selected.has(k));
}

function renderComparison() {
  const keys = orderedSelectedKeys();
  els.comparison.innerHTML = '';

  if (keys.length === 0) {
    els.comparison.innerHTML =
      '<p class="empty">Select at least one palette to compare.</p>';
    return;
  }

  const cols = keys.map((k) => palettes.get(k));
  const refPalette = referenceKey ? palettes.get(referenceKey) : cols[0];
  const rowCount = Math.max(...cols.map((c) => c.colors.length));
  const showHex = els.showHex.checked;
  const diffOnly = els.showDiffOnly.checked;

  const table = document.createElement('table');
  table.className = 'compare';

  // Header row.
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  hrow.appendChild(th('#'));
  for (const c of cols) {
    const cell = th(c.name);
    cell.className = c.source === 'user' ? 'user-col' : 'server-col';
    if (refPalette && c.key === refPalette.key) cell.classList.add('is-ref');
    hrow.appendChild(cell);
  }
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const diffCounts = new Map(cols.map((c) => [c.key, 0]));

  for (let i = 0; i < rowCount; i++) {
    const refColor = refPalette ? refPalette.colors[i] : null;
    const rowColors = cols.map((c) => c.colors[i]);
    const rowHasDiff = rowColors.some((c) => !colorsEqual(c, refColor));

    const tr = document.createElement('tr');
    if (rowHasDiff) tr.classList.add('row-diff');

    const idxCell = document.createElement('th');
    idxCell.className = 'idx';
    idxCell.innerHTML = `<span class="idx-num">${i}</span>` +
      `<span class="idx-name">${C64_COLOR_NAMES[i] || ''}</span>`;
    tr.appendChild(idxCell);

    for (const c of cols) {
      const color = c.colors[i];
      const td = document.createElement('td');
      td.className = 'swatch-cell';

      if (!color) {
        td.classList.add('missing');
        td.textContent = '—';
        tr.appendChild(td);
        continue;
      }

      const differs = !colorsEqual(color, refColor);
      if (differs) {
        td.classList.add('diff');
        diffCounts.set(c.key, diffCounts.get(c.key) + 1);
      }

      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.backgroundColor = toHex(color);
      swatch.title = `${c.name} — index ${i}\n${toHex(color)}\nrgb(${color.r}, ${color.g}, ${color.b})`;

      if (showHex) {
        const cap = document.createElement('span');
        cap.className = 'swatch-cap';
        cap.textContent = toHex(color).toUpperCase();
        swatch.appendChild(cap);
      }
      td.appendChild(swatch);
      tr.appendChild(td);
    }

    if (!diffOnly || rowHasDiff) tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  // Footer: per-column diff counts vs the reference.
  const tfoot = document.createElement('tfoot');
  const frow = document.createElement('tr');
  frow.appendChild(th('Δ vs ref'));
  for (const c of cols) {
    const n = diffCounts.get(c.key);
    const cell = document.createElement('td');
    cell.className = 'diff-count';
    cell.textContent = c.key === refPalette.key ? 'reference' : `${n} differ`;
    frow.appendChild(cell);
  }
  tfoot.appendChild(frow);
  table.appendChild(tfoot);

  els.comparison.appendChild(table);
}

function th(text) {
  const el = document.createElement('th');
  el.textContent = text;
  return el;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function exportPalette(p) {
  const text = serialiseVpl(p.colors, p.name);
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.name}.vpl`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Status line
// ---------------------------------------------------------------------------

let statusTimer = null;
function setStatus(msg, kind = 'ok') {
  els.status.textContent = msg;
  els.status.className = `status ${kind}`;
  clearTimeout(statusTimer);
  if (kind === 'ok') {
    statusTimer = setTimeout(() => {
      els.status.textContent = '';
      els.status.className = 'status';
    }, 4000);
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function wireEvents() {
  els.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    els.fileInput.value = '';
  });

  els.dropZone.addEventListener('click', () => els.fileInput.click());
  els.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.fileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.add('dragover');
    }),
  );
  ['dragleave', 'dragend', 'drop'].forEach((ev) =>
    els.dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove('dragover');
    }),
  );
  els.dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });

  els.refSelect.addEventListener('change', () => {
    referenceKey = els.refSelect.value || null;
    renderComparison();
  });
  els.showHex.addEventListener('change', renderComparison);
  els.showDiffOnly.addEventListener('change', renderComparison);
}

async function init() {
  initTheme(els.themeToggle);
  wireEvents();
  loadStoredUserPalettes();
  render();
  await loadServerPalettes();
  render();
}

init();
