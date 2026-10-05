import { QR_ALIGNMENTS, QR_BLOCKS } from './qrTables';

// Byte-mode QR encoder, versions 1–10 / correction L. The matrix is generated
// on the device, so profile links are never sent to a third-party QR service.
export function createProfileQr(value: string): { modules: boolean[][]; version: number; mask: number } {
  const bytes = Array.from(new TextEncoder().encode(value));
  let version = 1; let blocks: { total: number; data: number }[] = []; let capacity = 0;
  for (; version <= 10; version++) {
    const spec = QR_BLOCKS[version - 1]; blocks = [];
    for (let i = 0; i < spec.length; i += 3) for (let n = 0; n < spec[i]; n++) blocks.push({ total: spec[i + 1], data: spec[i + 2] });
    capacity = blocks.reduce((sum, block) => sum + block.data, 0);
    if (4 + (version < 10 ? 8 : 16) + bytes.length * 8 <= capacity * 8) break;
  }
  if (version > 10) throw new Error('This profile link is too long for a QR code. You can still copy or share the link.');
  const bits: number[] = [];
  const append = (number: number, count: number) => { for (let i = count - 1; i >= 0; i--) bits.push((number >>> i) & 1); };
  append(4, 4); append(bytes.length, version < 10 ? 8 : 16); bytes.forEach(byte => append(byte, 8));
  append(0, Math.min(4, capacity * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((number, bit) => (number << 1) | bit, 0));
  for (let pad = 0; data.length < capacity; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  const multiply = (a: number, b: number) => {
    let product = 0;
    while (b) { if (b & 1) product ^= a; b >>>= 1; a <<= 1; if (a & 0x100) a ^= 0x11d; }
    return product;
  };
  const remainder = (part: number[], degree: number) => {
    let generator = [1]; let root = 1;
    for (let i = 0; i < degree; i++) {
      const next = Array(generator.length + 1).fill(0);
      generator.forEach((coefficient, index) => { next[index] ^= coefficient; next[index + 1] ^= multiply(coefficient, root); });
      generator = next; root = multiply(root, 2);
    }
    const result = [...part, ...Array(degree).fill(0)];
    part.forEach((_, index) => { const factor = result[index]; generator.forEach((coefficient, offset) => { result[index + offset] ^= multiply(coefficient, factor); }); });
    return result.slice(part.length);
  };
  let offset = 0;
  const encoded = blocks.map(block => { const part = data.slice(offset, offset + block.data); offset += block.data; return { data: part, ecc: remainder(part, block.total - block.data) }; });
  const stream: number[] = [];
  for (const key of ['data', 'ecc'] as const) for (let i = 0; i < Math.max(...encoded.map(block => block[key].length)); i++) for (const block of encoded) if (i < block[key].length) stream.push(block[key][i]);
  const size = version * 4 + 17;
  function build(mask: number) {
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) { matrix[y][x] = dark; reserved[y][x] = true; } };
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
    for (let i = 8; i < size - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    for (const y of QR_ALIGNMENTS[version - 1]) for (const x of QR_ALIGNMENTS[version - 1]) {
      if ((x === 6 && (y === 6 || y === size - 7)) || (x === size - 7 && y === 6)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    let formatRemainder = (8 | mask) << 10;
    for (let i = 14; i >= 10; i--) if ((formatRemainder >>> i) & 1) formatRemainder ^= 0x537 << (i - 10);
    const format = (((8 | mask) << 10) | formatRemainder) ^ 0x5412;
    const f = (i: number) => !!((format >>> i) & 1);
    for (let i = 0; i <= 5; i++) set(8, i, f(i));
    set(8, 7, f(6)); set(8, 8, f(7)); set(7, 8, f(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, f(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, f(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, f(i));
    set(8, size - 8, true);
    if (version >= 7) {
      let rem = version << 12; for (let i = 17; i >= 12; i--) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
      const info = (version << 12) | rem;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3; const b = Math.floor(i / 3); set(a, b, !!((info >>> i) & 1)); set(b, a, !!((info >>> i) & 1)); }
    }
    const masked = (x: number, y: number) => [
      (x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0,
      (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
      (x * y) % 2 + (x * y) % 3 === 0,
      ((x * y) % 2 + (x * y) % 3) % 2 === 0,
      ((x + y) % 2 + (x * y) % 3) % 2 === 0,
    ][mask];
    let bit = 0; let upwards = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical++) {
        const y = upwards ? size - 1 - vertical : vertical;
        for (let i = 0; i < 2; i++) { const x = right - i; if (reserved[y][x]) continue;
          const dark = bit < stream.length * 8 && !!((stream[bit >>> 3] >>> (7 - bit % 8)) & 1);
          matrix[y][x] = dark !== masked(x, y); bit++;
        }
      }
      upwards = !upwards;
    }
    return matrix;
  }
  function penalty(matrix: boolean[][]) {
    let score = 0; let dark = 0;
    const lineScore = (line: boolean[]) => {
      let points = 0; let run = 1;
      for (let i = 1; i <= line.length; i++) { if (i < line.length && line[i] === line[i - 1]) run++; else { if (run >= 5) points += run - 2; run = 1; } }
      const text = line.map(cell => cell ? '1' : '0').join('');
      for (let i = 0; i <= text.length - 11; i++) if (['00001011101', '10111010000'].includes(text.slice(i, i + 11))) points += 40;
      return points;
    };
    for (let y = 0; y < size; y++) { score += lineScore(matrix[y]); score += lineScore(matrix.map(row => row[y]));
      for (let x = 0; x < size; x++) { if (matrix[y][x]) dark++; if (x && y && matrix[y][x] === matrix[y - 1][x] && matrix[y][x] === matrix[y][x - 1] && matrix[y][x] === matrix[y - 1][x - 1]) score += 3; }
    }
    return score + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  }
  let mask = 0; let modules = build(0); let best = penalty(modules);
  for (let candidate = 1; candidate < 8; candidate++) { const matrix = build(candidate); const score = penalty(matrix); if (score < best) { best = score; mask = candidate; modules = matrix; } }
  return { modules, version, mask };
}
