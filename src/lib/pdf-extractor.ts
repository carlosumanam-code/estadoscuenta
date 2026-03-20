// PDF text extractor - decompresses FlateDecode streams and tracks Y positions
import zlib from 'zlib'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('Starting PDF extraction with position tracking, buffer size:', buffer.length)

  try {
    // Check PDF header
    const header = buffer.slice(0, 4).toString()
    if (header !== '%PDF') {
      throw new Error('File is not a valid PDF')
    }

    const content = buffer.toString('latin1')
    
    // Collect text items with Y positions
    const textItems: { text: string; y: number; x: number }[] = []
    
    // Find all stream objects and decompress them
    const streamPattern = /<<[^>]*>>\s*stream\r?\n([\s\S]*?)\r?\n?endstream/gi
    
    let match
    while ((match = streamPattern.exec(content)) !== null) {
      const streamHeader = match[0].match(/<<[^>]*>>/)?.[0] || ''
      const streamContent = match[1]
      
      // Check if this stream is FlateDecode (compressed)
      if (streamHeader.includes('FlateDecode') || streamHeader.includes('/Filter')) {
        try {
          const compressedBuffer = Buffer.from(streamContent, 'latin1')
          const decompressed = zlib.inflateSync(compressedBuffer, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
          const streamText = decompressed.toString('latin1')
          
          const items = extractTextWithPositions(streamText)
          textItems.push(...items)
          
        } catch (decompressError: any) {
          console.log('Could not decompress stream:', decompressError.message)
          const items = extractTextWithPositions(streamContent)
          textItems.push(...items)
        }
      } else {
        const items = extractTextWithPositions(streamContent)
        textItems.push(...items)
      }
    }
    
    // Also extract from metadata
    const metaPattern = /\/(Title|Author|Subject|Keywords|Creator)\s*\(([^)]+)\)/g
    while ((match = metaPattern.exec(content)) !== null) {
      if (match[2] && match[2].trim()) {
        textItems.push({ text: decodePdfString(match[2]), y: 0, x: 0 })
      }
    }
    
    // Group texts by Y position (within tolerance of 2 units)
    const yTolerance = 2
    const yGroups = new Map<number, { text: string; x: number }[]>()
    
    for (const item of textItems) {
      // Find existing group or create new one
      let foundY = item.y
      for (const existingY of yGroups.keys()) {
        if (Math.abs(existingY - item.y) <= yTolerance) {
          foundY = existingY
          break
        }
      }
      
      if (!yGroups.has(foundY)) {
        yGroups.set(foundY, [])
      }
      yGroups.get(foundY)!.push({ text: item.text, x: item.x })
    }
    
    // Sort Y positions (descending - PDF Y goes from bottom to top)
    const sortedYs = Array.from(yGroups.keys()).sort((a, b) => b - a)
    
    // Build lines by combining texts at same Y, sorted by X
    const lines: string[] = []
    for (const y of sortedYs) {
      const items = yGroups.get(y)!
      items.sort((a, b) => a.x - b.x)
      const lineText = items.map(i => i.text).join(' ')
      if (lineText.trim()) {
        lines.push(lineText.trim())
      }
    }
    
    let result = lines.join('\n')
    
    // Clean up
    result = result
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\(\d{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    
    console.log('Extracted text items:', textItems.length)
    console.log('Lines with content:', lines.length)
    console.log('Combined text length:', result.length)
    
    if (result.length > 0) {
      return result
    }
    
    throw new Error('No text could be extracted from PDF')
    
  } catch (error: any) {
    console.error('PDF extraction error:', error.message)
    throw new Error(`Error al extraer texto del PDF: ${error.message}`)
  }
}

// Extract text with Y position tracking from PDF content stream
function extractTextWithPositions(streamText: string): { text: string; y: number; x: number }[] {
  const items: { text: string; y: number; x: number }[] = []
  
  // Current text matrix (for position tracking)
  let currentX = 0
  let currentY = 0
  let textMatrix = [1, 0, 0, 1, 0, 0] // Identity matrix
  
  // Process BT...ET blocks
  const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g
  let match
  
  while ((match = btEtPattern.exec(streamText)) !== null) {
    const block = match[1]
    
    // Reset matrix at start of BT
    textMatrix = [1, 0, 0, 1, 0, 0]
    currentX = 0
    currentY = 0
    
    // Parse operators in order
    // Tm - set text matrix: a b c d e f
    const tmPattern = /(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+Tm/g
    let tmMatch
    while ((tmMatch = tmPattern.exec(block)) !== null) {
      textMatrix = [
        parseFloat(tmMatch[1]),
        parseFloat(tmMatch[2]),
        parseFloat(tmMatch[3]),
        parseFloat(tmMatch[4]),
        parseFloat(tmMatch[5]),
        parseFloat(tmMatch[6])
      ]
      currentX = textMatrix[4]
      currentY = textMatrix[5]
    }
    
    // Td/TD - move text position: x y Td
    const tdPattern = /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+TD?/g
    let tdMatch
    while ((tdMatch = tdPattern.exec(block)) !== null) {
      const dx = parseFloat(tdMatch[1])
      const dy = parseFloat(tdMatch[2])
      currentX += dx
      currentY += dy
      textMatrix[4] = currentX
      textMatrix[5] = currentY
    }
    
    // Extract text with position
    // Pattern 1: (text)Tj
    const tjPattern = /\(([^)]*)\)\s*Tj/g
    let tjMatch
    while ((tjMatch = tjPattern.exec(block)) !== null) {
      if (tjMatch[1] && tjMatch[1].trim()) {
        items.push({
          text: decodePdfString(tjMatch[1]),
          y: currentY,
          x: currentX
        })
      }
    }
    
    // Pattern 2: [(texts)]TJ
    const tjArrayPattern = /\[\s*([^\]]+)\s*\]\s*TJ/g
    let tjArrayMatch
    while ((tjArrayMatch = tjArrayPattern.exec(block)) !== null) {
      const arrayContent = tjArrayMatch[1]
      const strings = arrayContent.match(/\(([^)]*)\)/g) || []
      let xPos = currentX
      for (const s of strings) {
        const text = s.slice(1, -1)
        if (text.trim()) {
          items.push({
            text: decodePdfString(text),
            y: currentY,
            x: xPos
          })
          xPos += text.length * 5 // Approximate width
        }
      }
    }
  }
  
  // If no items found with position tracking, try simple extraction
  if (items.length === 0) {
    // Fallback: extract without positions
    const tjPattern = /\(([^)]*)\)\s*Tj/g
    let simpleMatch
    let y = 800
    while ((simpleMatch = tjPattern.exec(streamText)) !== null) {
      if (simpleMatch[1] && simpleMatch[1].trim()) {
        items.push({
          text: decodePdfString(simpleMatch[1]),
          y: y,
          x: 0
        })
        y -= 12
      }
    }
    
    const tjArrayPattern = /\[\s*([^\]]+)\s*\]\s*TJ/g
    while ((simpleMatch = tjArrayPattern.exec(streamText)) !== null) {
      const arrayContent = simpleMatch[1]
      const strings = arrayContent.match(/\(([^)]*)\)/g) || []
      for (const s of strings) {
        const text = s.slice(1, -1)
        if (text.trim()) {
          items.push({
            text: decodePdfString(text),
            y: y,
            x: 0
          })
          y -= 12
        }
      }
    }
  }
  
  return items
}

// Decode PDF string escape sequences
function decodePdfString(str: string): string {
  return str
    .replace(/\\(\d{1,3})/g, (_, octal) => {
      try {
        return String.fromCharCode(parseInt(octal, 8))
      } catch {
        return ''
      }
    })
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

// Interfaces kept for compatibility
export interface TextItemWithPosition {
  text: string
  x: number
  y: number
  width: number
  height: number
  page: number
}

export interface TransactionLine {
  date: string
  description: string
  debitAmount: { value: number; x: number } | null
  creditAmount: { value: number; x: number } | null
  rawLine: string
  y: number
}

export async function extractTextWithPositions(buffer: Buffer): Promise<TextItemWithPosition[]> {
  const text = await extractTextFromPDF(buffer)
  const lines = text.split('\n')
  const items: TextItemWithPosition[] = []
  let y = 800
  
  for (const line of lines) {
    if (!line.trim()) {
      y -= 12
      continue
    }
    const tokens = line.split(/\s+/)
    let x = 50
    for (const token of tokens) {
      if (token.trim()) {
        items.push({ text: token, x, y, width: token.length * 6, height: 10, page: 1 })
      }
      x += (token.length + 1) * 6
    }
    y -= 12
  }
  return items
}

export interface BCRColumnPositions {
  debitX: number
  creditX: number
  debitEnd: number
  creditEnd: number
}

export function detectBCRColumns(items: TextItemWithPosition[]): BCRColumnPositions | null {
  return { debitX: 350, creditX: 450, debitEnd: 400, creditEnd: 550 }
}

export function parseBCRTransactionsFromPositions(
  items: TextItemWithPosition[],
  columns: BCRColumnPositions
): TransactionLine[] {
  return []
}
