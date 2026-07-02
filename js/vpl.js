// VICE .vpl palette parsing / serialising.
//
// VICE palette format is a plain-text file. Lines beginning with `#` are
// comments and blank lines are ignored. Each data line holds whitespace
// separated hexadecimal bytes: `Red Green Blue [Dither]`. We only care about
// the first three values (the RGB triplet); the optional dither nibble is
// kept when present so we can round-trip a file, but it is not used for
// comparison.

// The canonical names of the 16 C64 colours, used as row labels.
export const C64_COLOR_NAMES = [
  'Black', 'White', 'Red', 'Cyan',
  'Purple', 'Green', 'Blue', 'Yellow',
  'Orange', 'Brown', 'Light Red', 'Dark Grey',
  'Grey', 'Light Green', 'Light Blue', 'Light Grey',
];

// Parse .vpl text into an array of colours. Each colour is
// `{ r, g, b, dither }` with r/g/b in 0..255 and dither in 0..15 (or null).
// Throws if no valid colour lines are found.
export function parseVpl(text) {
  const colors = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    // Strip trailing comments, then trim.
    const line = lines[i].replace(/#.*$/, '').trim();
    if (!line) continue;

    const tokens = line.split(/\s+/);
    if (tokens.length < 3) {
      throw new Error(`Line ${i + 1}: expected at least 3 values, got "${lines[i].trim()}"`);
    }

    const [r, g, b] = tokens.slice(0, 3).map(parseHexByte);
    if ([r, g, b].some((v) => v === null)) {
      throw new Error(`Line ${i + 1}: invalid hex byte in "${lines[i].trim()}"`);
    }

    let dither = null;
    if (tokens.length >= 4) {
      const d = parseInt(tokens[3], 16);
      dither = Number.isNaN(d) ? null : d & 0xf;
    }

    colors.push({ r, g, b, dither });
  }

  if (colors.length === 0) {
    throw new Error('No colour values found in file.');
  }
  return colors;
}

function parseHexByte(token) {
  if (!/^[0-9a-fA-F]{1,2}$/.test(token)) return null;
  const v = parseInt(token, 16);
  return Number.isNaN(v) ? null : v;
}

// A #rrggbb CSS hex string for a colour.
export function toHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Two colours are equal when their RGB triplets match (dither is ignored).
export function colorsEqual(a, b) {
  if (!a || !b) return false;
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

// Serialise colours back into a VICE .vpl file (used for exporting).
export function serialiseVpl(colors, title = 'Exported palette') {
  const header = [
    '# VICE Palette file',
    '#',
    `# ${title}`,
    '#',
    '# Syntax:',
    '# Red Green Blue Dither',
    '#',
  ];
  const rows = colors.map((c, i) => {
    const hex = (v) => v.toString(16).padStart(2, '0');
    const dither = (c.dither == null ? 0 : c.dither).toString(16);
    const name = C64_COLOR_NAMES[i] ? `\t# ${C64_COLOR_NAMES[i]}` : '';
    return `${hex(c.r)} ${hex(c.g)} ${hex(c.b)} ${dither}${name}`;
  });
  return header.concat(rows).join('\n') + '\n';
}
