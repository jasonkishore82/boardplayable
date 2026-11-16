// Saving a game: a screenshot of the board and a PDF with the final position and the move history.

export type Captured = { dataUrl: string; width: number; height: number; format: 'PNG' | 'JPEG' }

export type HistoryTable = { heading: string; header: string[]; rows: string[][] }

/** One game in the PDF. A room that played several games (rematches) gives one of these per game. */
export type PdfRound = {
  title: string
  subtitle: string
  /** Short lines under the title: players, result, scores. */
  lines: string[]
  image: Captured | null
  history: HistoryTable | null
}

export type PdfOptions = {
  /** Every game, in the order played. Each starts on a new page. */
  rounds: PdfRound[]
  filename: string
}

/** "chess-2026-11-10-1432" style names, safe for every file system. */
export function exportName(gameId: string, extension: string, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${gameId.replace(/[^a-z0-9-]/gi, '')}-${stamp}.${extension}`
}

/**
 * The move list as a table. Chess is laid out as numbered pairs (1. e4 e5), tic-tac-toe as a list of squares.
 * Returns null when no moves have been played.
 */
export function historyTable(gameId: string, history: string[] | undefined): HistoryTable | null {
  if (!history || history.length === 0) return null

  if (gameId === 'chess') {
    const rows: string[][] = []
    for (let i = 0; i < history.length; i += 2) {
      rows.push([String(i / 2 + 1), history[i], history[i + 1] ?? ''])
    }
    return { heading: 'Move history', header: ['#', 'White', 'Black'], rows }
  }

  if (gameId === 'tic-tac-toe') {
    // Entries look like "X5": the mark, then the square number 1 to 9.
    return {
      heading: 'Move history',
      header: ['#', 'Player', 'Square'],
      rows: history.map((move, i) => [String(i + 1), move.slice(0, 1), move.slice(1)]),
    }
  }

  if (gameId === 'cricket') {
    // Entries look like "home 4 v 2: 4 runs": the batting side, the two picks, then what happened.
    return {
      heading: 'Ball by ball',
      header: ['#', 'Batting', 'Bat', 'Bowl', 'Result'],
      rows: history.map((ball, i) => {
        const [side, bat, , bowl] = ball.split(/[ :]+/)
        const result = ball.split(': ')[1] ?? ''
        return [String(i + 1), side.charAt(0).toUpperCase() + side.slice(1), bat, bowl, result]
      }),
    }
  }

  return { heading: 'Move history', header: ['#', 'Move'], rows: history.map((move, i) => [String(i + 1), move]) }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Couldn’t read the screenshot.'))
    image.src = src
  })
}

/**
 * Takes a picture of one element. Anything inside it marked data-export-skip is left out.
 * PNG is sharpest for a saved screenshot; JPEG keeps the PDF small.
 */
export async function captureElement(element: HTMLElement, format: 'PNG' | 'JPEG' = 'PNG'): Promise<Captured> {
  const { toPng, toJpeg } = await import('html-to-image')
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0d1c'
  const options = {
    pixelRatio: format === 'PNG' ? 2 : 1.5,
    backgroundColor: background,
    cacheBust: true,
    quality: 0.92,
    filter: (node: Node) => !(node instanceof HTMLElement && node.dataset.exportSkip !== undefined),
  }
  const dataUrl = format === 'PNG' ? await toPng(element, options) : await toJpeg(element, options)
  const image = await loadImage(dataUrl)
  return { dataUrl, width: image.naturalWidth, height: image.naturalHeight, format }
}

/** The element that holds just the board: a game's flat board or its 3D stage. Falls back to `container`. */
export function boardElement(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('[data-export-board]') ?? container
}

/** Starts a download of a data URL. */
export function downloadDataUrl(filename: string, dataUrl: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

// The built-in PDF fonts only cover Latin-1, so anything else (some player names) is swapped for "?".
const latin1 = (text: string) => text.replace(/[^\x20-\x7e -ÿ]/g, '?')

export async function exportPdf(options: PdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const width = 210
  const height = 297
  const margin = 14

  options.rounds.forEach((round, index) => {
    if (index > 0) pdf.addPage()

    // Title band.
    pdf.setFillColor(11, 13, 28)
    pdf.rect(0, 0, width, 30, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(21)
    pdf.setTextColor(53, 240, 176)
    pdf.text(latin1(round.title), margin, 15)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(200, 204, 240)
    pdf.text(latin1(round.subtitle), margin, 23)

    // Players, result, scores.
    let y = 41
    pdf.setTextColor(30, 34, 70)
    pdf.setFontSize(11)
    for (const line of round.lines) {
      pdf.text(latin1(line), margin, y)
      y += 6
    }
    y += 3

    // The final position.
    if (round.image) {
      const maxWidth = width - margin * 2
      const maxHeight = 140
      const ratio = Math.min(maxWidth / round.image.width, maxHeight / round.image.height)
      const w = round.image.width * ratio
      const h = round.image.height * ratio
      pdf.addImage(round.image.dataUrl, round.image.format, (width - w) / 2, y, w, h)
      y += h + 10
    }

    // The move history, in two blocks side by side so a long game stays short.
    const table = round.history
    if (table) {
      const rowHeight = 5.6
      const blockWidth = (width - margin * 2 - 8) / 2
      const columnWidths = table.header.map((_, i) => (i === 0 ? 11 : (blockWidth - 11) / (table.header.length - 1)))

      const heading = () => {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(13)
        pdf.setTextColor(30, 34, 70)
        pdf.text(latin1(table.heading), margin, y)
        y += 7
      }

      const header = (x: number, top: number) => {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setFillColor(232, 234, 247)
        pdf.rect(x, top - 4, blockWidth, rowHeight, 'F')
        pdf.setTextColor(74, 80, 134)
        let cx = x + 1.5
        table.header.forEach((label, i) => {
          pdf.text(latin1(label), cx, top)
          cx += columnWidths[i]
        })
      }

      heading()
      let top = y
      let block = 0
      header(margin, top)
      let row = 0
      for (const cells of table.rows) {
        const rowY = top + rowHeight * (row + 1)
        if (rowY > height - margin - 6) {
          if (block === 0) {
            // Fill the right-hand block next.
            block = 1
            row = 0
            header(margin + blockWidth + 8, top)
          } else {
            pdf.addPage()
            y = margin + 6
            heading()
            top = y
            block = 0
            row = 0
            header(margin, top)
          }
        }
        const x = margin + block * (blockWidth + 8)
        const yy = top + rowHeight * (row + 1)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9.5)
        pdf.setTextColor(30, 34, 70)
        let cx = x + 1.5
        cells.forEach((cell, i) => {
          pdf.text(latin1(cell), cx, yy)
          cx += columnWidths[i]
        })
        row += 1
      }
    } else {
      pdf.setFont('helvetica', 'italic')
      pdf.setFontSize(10)
      pdf.setTextColor(110, 115, 160)
      pdf.text('No moves were played.', margin, y)
    }
  })

  // Footer on every page.
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(140, 144, 180)
    pdf.text(`Board Playable  ·  page ${page} of ${pages}`, margin, height - 8)
  }

  pdf.save(options.filename)
}
