// Persistence of user-uploaded palettes in localStorage.
//
// Uploaded .vpl files never touch a server; they are parsed client-side and
// their colour data is stored under a single localStorage key as an array of
// records: { id, name, colors: [{r,g,b,dither}, ...], addedAt }.

const STORAGE_KEY = 'vpl-diff:user-palettes';

export function loadUserPalettes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('Could not read user palettes from localStorage:', e);
    return [];
  }
}

function save(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Add a palette; returns the created record.
export function addUserPalette(name, colors) {
  const list = loadUserPalettes();
  const record = {
    id: makeId(),
    name: uniqueName(name, list),
    colors,
    addedAt: new Date().toISOString(),
  };
  list.push(record);
  save(list);
  return record;
}

export function removeUserPalette(id) {
  save(loadUserPalettes().filter((p) => p.id !== id));
}

export function renameUserPalette(id, name) {
  const list = loadUserPalettes();
  const p = list.find((x) => x.id === id);
  if (p) {
    p.name = name;
    save(list);
  }
}

function makeId() {
  return 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Ensure the display name is unique among stored palettes by appending (2), (3)…
function uniqueName(name, list) {
  const taken = new Set(list.map((p) => p.name));
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}
