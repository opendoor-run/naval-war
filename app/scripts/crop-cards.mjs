import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const cardsSrcDir = path.resolve(root, '../cards')
const outDir = path.join(root, 'public', 'cards')
mkdirSync(outDir, { recursive: true })

// Crop coordinates (sheet/row/col) live in a build-only file, separate from the runtime
// cards.json that ships to the client - the client never needs to know where on a scanned
// sheet a card's art came from.
const data = JSON.parse(readFileSync(path.join(root, 'src/data/cards-crop.json'), 'utf8'))
const allCards = [...data.shipDeck, ...data.playDeck]

// pic81863 is physically a 3x7 sheet with a blank 7th row (confirmed by
// pixel inspection), so its 6 populated rows are each 900/7 tall. Every
// other sheet is a plain 3x6 grid (900/6 tall).
const COLS = 3
const SEVEN_SLOT_SHEETS = new Set(['pic81863'])

const sheetMeta = new Map()

for (const card of allCards) {
  const { id, sheet, row, col } = card
  const sheetPath = path.join(cardsSrcDir, `${sheet}.webp`)

  if (!sheetMeta.has(sheet)) {
    const meta = await sharp(sheetPath).metadata()
    sheetMeta.set(sheet, meta)
  }
  const meta = sheetMeta.get(sheet)
  const colW = Math.floor(meta.width / COLS)
  const rowSlots = SEVEN_SLOT_SHEETS.has(sheet) ? 7 : 6
  const rowHf = meta.height / rowSlots

  const left = col * colW
  const top = Math.round(row * rowHf)
  const width = col === COLS - 1 ? meta.width - left : colW
  const height = Math.round((row + 1) * rowHf) - top

  const outPath = path.join(outDir, `${id}.webp`)
  await sharp(sheetPath)
    .extract({ left, top, width, height })
    .toFile(outPath)
}

console.log(`Cropped ${allCards.length} cards into ${outDir}`)
