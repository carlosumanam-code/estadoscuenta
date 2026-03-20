// PDF text extractor - decompresses FlateDecode streams
import zlib from 'zlib'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('Starting PDF extraction with decompression, buffer size:', buffer.length)

  try {
    // Check PDF header
    const header = buffer.slice(0, 4).toString()
    if (header !== '%PDF') {
      throw new Error('File is not a valid PDF')
    }

    const content = buffer.toString('latin1')
    const textParts: string[] = []
    
    // Find all stream objects and decompress them
    // Pattern: stream ... endstream
    const streamPattern = /<<[^>]*>>\s*stream\r?\n([\s\S]*?)\r?\n?endstream/gi
    
    let match
    while ((match = streamPattern.exec(content)) !== null) {
      const streamHeader = match[0].match(/<<[^>]*>>/)?.[0] || ''
      const streamContent = match[1]
      
      // Check if this stream is FlateDecode (compressed)
      if (streamHeader.includes('FlateDecode') || streamHeader.includes('/Filter')) {
        try {
          // Convert latin1 string back to buffer for decompression
          const compressedBuffer = Buffer.from(streamContent, 'latin1')
          
          // Decompress
          const decompressed = zlib.inflateSync(compressedBuffer, { finishFlush: zlib.constants.Z_SYNC_FLUSH })
          const streamText = decompressed.toString('latin1')
          
          // Extract text from decompressed stream
          const texts = extractTextFromStream(streamText)
          textParts.push(...texts)
          
        } catch (decompressError: any) {
          // Some streams might not be compressed or might be malformed
          console.log('Could not decompress stream:', decompressError.message)
          
          // Try to extract text anyway
          const texts = extractTextFromStream(streamContent)
          textParts.push(...texts)
        }
      } else {
        // Not compressed, extract directly
        const texts = extractTextFromStream(streamContent)
        textParts.push(...texts)
      }
    }
    
    // Also extract from metadata (Title, Author, etc.)
    const metaPattern = /\/(Title|Author|Subject|Keywords|Creator)\s*\(([^)]+)\)/g
    while ((match = metaPattern.exec(content)) !== null) {
      if (match[2] && match[2].trim()) {
        textParts.push(match[2])
      }
    }
    
    // Combine all text - use newlines to preserve line structure
    // This is important for parsers that expect line-based format (like BAC)
    let result = textParts.join('\n')
    
    // Clean up escape sequences while preserving line structure
    result = result
      .replace(/\\n/g, ' ')        // Literal \n string -> space
      .replace(/\\r/g, ' ')        // Literal \r string -> space
      .replace(/\\t/g, ' ')        // Literal \t string -> space
      .replace(/\\\(/g, '(')       // Unescape parentheses
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')      // Unescape backslash
      .replace(/\\(\d{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/[ \t]+/g, ' ')     // Collapse multiple spaces/tabs to single space (preserve newlines)
      .replace(/\n\s+/g, '\n')     // Remove leading spaces on lines
      .replace(/\s+\n/g, '\n')     // Remove trailing spaces on lines
      .replace(/\n{3,}/g, '\n\n')  // Collapse multiple blank lines to double
      .trim()
    
    console.log('Extracted text parts:', textParts.length)
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

// Extract text operators from a PDF content stream
// Preserves line structure by detecting BT/ET blocks as separate lines
function extractTextFromStream(streamText: string): string[] {
  const lines: string[] = []
  
  // Process BT...ET blocks (text blocks) - each block is typically a line
  const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g
  let match
  
  while ((match = btEtPattern.exec(streamText)) !== null) {
    const block = match[1]
    const lineParts: string[] = []
    
    // Pattern 1: (text)Tj - show text
    const tjPattern = /\(([^)]*)\)\s*Tj/g
    let tjMatch
    while ((tjMatch = tjPattern.exec(block)) !== null) {
      if (tjMatch[1] && tjMatch[1].trim()) {
        lineParts.push(decodePdfString(tjMatch[1]))
      }
    }
    
    // Pattern 2: [(texts)]TJ - show text with positioning
    const tjArrayPattern = /\[\s*([^\]]+)\s*\]\s*TJ/g
    let tjArrayMatch
    while ((tjArrayMatch = tjArrayPattern.exec(block)) !== null) {
      const arrayContent = tjArrayMatch[1]
      const strings = arrayContent.match(/\(([^)]*)\)/g) || []
      for (const s of strings) {
        const text = s.slice(1, -1)
        if (text.trim()) {
          lineParts.push(decodePdfString(text))
        }
      }
    }
    
    if (lineParts.length > 0) {
      lines.push(lineParts.join(' '))
    }
  }
  
  // If no BT/ET blocks found, try simple text extraction
  if (lines.length === 0) {
    const texts: string[] = []
    
    const tjPattern = /\(([^)]*)\)\s*Tj/g
    let simpleMatch
    while ((simpleMatch = tjPattern.exec(streamText)) !== null) {
      if (simpleMatch[1] && simpleMatch[1].trim()) {
        texts.push(decodePdfString(simpleMatch[1]))
      }
    }
    
    const tjArrayPattern = /\[\s*([^\]]+)\s*\]\s*TJ/g
    while ((simpleMatch = tjArrayPattern.exec(streamText)) !== null) {
      const arrayContent = simpleMatch[1]
      const strings = arrayContent.match(/\(([^)]*)\)/g) || []
      for (const s of strings) {
        const text = s.slice(1, -1)
        if (text.trim()) {
          texts.push(decodePdfString(text))
        }
      }
    }
    
    return texts
  }
  
  return lines
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
