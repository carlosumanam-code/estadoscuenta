// Simple PDF text extractor - no external dependencies that need DOM
// Works by parsing PDF content streams directly

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('Starting simple PDF extraction, buffer size:', buffer.length)

  try {
    // Check PDF header
    const header = buffer.slice(0, 4).toString()
    if (header !== '%PDF') {
      throw new Error('File is not a valid PDF')
    }

    const content = buffer.toString('latin1')
    
    // Extract text from PDF content streams
    // PDFs store text in Tj (single string) and TJ (array) operators
    // Text strings are typically enclosed in parentheses
    
    const textParts: string[] = []
    
    // Pattern 1: (text)Tj - single text string
    const tjPattern = /\(([^)]*)\)\s*Tj/g
    let match
    while ((match = tjPattern.exec(content)) !== null) {
      if (match[1] && match[1].trim()) {
        textParts.push(decodePdfString(match[1]))
      }
    }
    
    // Pattern 2: [(text)]TJ - array of text strings
    const tjArrayPattern = /\[\s*(?:\(([^)]*)\)[^[\]]*)+\s*\]\s*TJ/g
    while ((match = tjArrayPattern.exec(content)) !== null) {
      const arrayContent = match[0]
      const strings = arrayContent.match(/\(([^)]*)\)/g) || []
      for (const s of strings) {
        const text = s.slice(1, -1)
        if (text.trim()) {
          textParts.push(decodePdfString(text))
        }
      }
    }
    
    // Pattern 3: Look for text between BT and ET markers (Begin/End Text)
    const btEtPattern = /BT\s*([\s\S]*?)\s*ET/g
    while ((match = btEtPattern.exec(content)) !== null) {
      const textBlock = match[1]
      const strings = textBlock.match(/\(([^)]*)\)/g) || []
      for (const s of strings) {
        const text = s.slice(1, -1)
        if (text.trim()) {
          textParts.push(decodePdfString(text))
        }
      }
    }
    
    // Combine and clean up
    let result = textParts.join(' ')
    
    // Clean up common PDF escape sequences
    result = result
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\s+/g, ' ')
      .trim()
    
    console.log('Extracted text parts:', textParts.length)
    console.log('Combined text length:', result.length)
    
    if (result.length > 0) {
      return result
    }
    
    // Fallback: Try to extract any readable text
    console.log('Trying fallback text extraction...')
    return extractReadableText(content)
    
  } catch (error: any) {
    console.error('PDF extraction error:', error.message)
    throw new Error(`Error al extraer texto del PDF: ${error.message}`)
  }
}

// Decode PDF string escape sequences
function decodePdfString(str: string): string {
  return str
    .replace(/\\(\d{1,3})/g, (_, octal) => {
      return String.fromCharCode(parseInt(octal, 8))
    })
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
}

// Fallback: extract any readable ASCII/Latin text
function extractReadableText(content: string): string {
  const results: string[] = []
  
  // Find sequences of printable characters
  const pattern = /[\x20-\x7EáéíóúñÁÉÍÓÚÑüÜ]{4,}/g
  let match
  
  while ((match = pattern.exec(content)) !== null) {
    const text = match[0]
    // Filter out things that look like binary data
    if (text.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{2,}/)) {
      results.push(text)
    }
  }
  
  return results.join(' ')
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
