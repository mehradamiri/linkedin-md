// Draws the extension icons from scratch (no image deps) so the repo carries no binary
// blobs a contributor cannot regenerate: `pnpm icons`.
//
// The mark is the Markdown "M + down arrow" in white on a LinkedIn-blue rounded square.
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import { Buffer } from "node:buffer"

const SIZES = [16, 32, 48, 128]
const OUT_DIR = new URL("../public/icons/", import.meta.url)
const BRAND = [10, 102, 194] // #0A66C2
const SAMPLES = 4 // supersampling per axis, for antialiased edges

/** Distance from point p to segment ab, all in unit coordinates. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)),
  )
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby))
}

function insideRoundedSquare(x, y, radius) {
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - radius), 0)
  const dy = Math.max(Math.abs(y - 0.5) - (0.5 - radius), 0)
  return Math.hypot(dx, dy) <= radius
}

// "M" strokes plus an arrow shaft, in unit coordinates.
const STROKES = [
  [0.22, 0.68, 0.22, 0.32], // left upright
  [0.22, 0.32, 0.36, 0.5], // down to the middle valley
  [0.36, 0.5, 0.5, 0.32], // back up
  [0.5, 0.32, 0.5, 0.68], // right upright
  [0.72, 0.32, 0.72, 0.58], // arrow shaft
]
const ARROW_HEAD = [
  [0.6, 0.55],
  [0.84, 0.55],
  [0.72, 0.7],
]

function insideTriangle(px, py, tri) {
  const sign = (ax, ay, bx, by, cx, cy) =>
    (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)
  const [a, b, c] = tri
  const d1 = sign(px, py, a[0], a[1], b[0], b[1])
  const d2 = sign(px, py, b[0], b[1], c[0], c[1])
  const d3 = sign(px, py, c[0], c[1], a[0], a[1])
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function insideMark(x, y, strokeWidth) {
  const onStroke = STROKES.some(
    ([ax, ay, bx, by]) =>
      distanceToSegment(x, y, ax, ay, bx, by) <= strokeWidth / 2,
  )
  return onStroke || insideTriangle(x, y, ARROW_HEAD)
}

/** Returns raw RGBA rows for one icon size. */
function render(size) {
  const strokeWidth = size <= 16 ? 0.13 : 0.1
  const radius = 0.22
  const rows = []

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4) // leading PNG filter byte (0 = none)
    for (let x = 0; x < size; x++) {
      let bg = 0
      let mark = 0
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const ux = (x + (sx + 0.5) / SAMPLES) / size
          const uy = (y + (sy + 0.5) / SAMPLES) / size
          if (!insideRoundedSquare(ux, uy, radius)) continue
          bg++
          if (insideMark(ux, uy, strokeWidth)) mark++
        }
      }
      const total = SAMPLES * SAMPLES
      const alpha = bg / total
      const markRatio = bg === 0 ? 0 : mark / bg
      const offset = 1 + x * 4
      // White mark composited over the brand-blue tile.
      row[offset] = Math.round(BRAND[0] + (255 - BRAND[0]) * markRatio)
      row[offset + 1] = Math.round(BRAND[1] + (255 - BRAND[1]) * markRatio)
      row[offset + 2] = Math.round(BRAND[2] + (255 - BRAND[2]) * markRatio)
      row[offset + 3] = Math.round(alpha * 255)
    }
    rows.push(row)
  }
  return Buffer.concat(rows)
}

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function toPng(size, raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const file = new URL(`icon${size}.png`, OUT_DIR)
  writeFileSync(file, toPng(size, render(size)))
  console.log(`wrote public/icons/icon${size}.png`)
}
