// PDF extractor - works in serverless environments
// Set up polyfills BEFORE importing pdf-parse

// Mock DOM objects that pdf.js expects in Node.js
if (typeof globalThis !== 'undefined') {
  // @ts-ignore
  if (typeof globalThis.document === 'undefined') {
    // @ts-ignore
    globalThis.document = {
      createElement: () => ({
        getContext: () => null,
        style: {},
      }),
      createElementNS: () => ({
        getContext: () => null,
        style: {},
      }),
      getElementsByTagName: () => [],
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      documentElement: {
        style: {},
      },
    }
  }
  
  // @ts-ignore
  if (typeof globalThis.window === 'undefined') {
    // @ts-ignore
    globalThis.window = {
      document: globalThis.document,
      navigator: { userAgent: 'node' },
      URL: {
        createObjectURL: () => '',
        revokeObjectURL: () => {},
      },
    }
  }
  
  // @ts-ignore
  if (typeof globalThis.navigator === 'undefined') {
    // @ts-ignore
    globalThis.navigator = { userAgent: 'node' }
  }

  // @ts-ignore
  if (typeof globalThis.URL === 'undefined') {
    // @ts-ignore
    globalThis.URL = {
      createObjectURL: () => '',
      revokeObjectURL: () => {},
    }
  }
}

// Now import pdf-parse after polyfills are set up
import pdfParse from 'pdf-parse'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('Starting PDF extraction, buffer size:', buffer.length)

  try {
    // Simple options - the patch handles worker issues
    const data = await pdfParse(buffer, { 
      max: 0,  // No page limit
    })

    console.log('PDF pages:', data.numpages)
    console.log('PDF info:', data.info)
    console.log('Text length:', data.text?.length || 0)

    if (data.text && data.text.trim()) {
      console.log('PDF extraction successful')
      return data.text
    }

    throw new Error('No text was extracted from the PDF - the file may be a scanned image without OCR')

  } catch (error: any) {
    console.error('PDF extraction error:', error.message)
    console.error('Error stack:', error.stack)
    throw new Error(`Error al extraer texto del PDF: ${error.message}`)
  }
}

// Text item with position information (kept for interface compatibility)
export interface TextItemWithPosition {
  text: string
  x: number
  y: number
  width: number
  height: number
  page: number
}

// Transaction line with position-aware amounts
export interface TransactionLine {
  date: string
  description: string
  debitAmount: { value: number; x: number } | null
  creditAmount: { value: number; x: number } | null
  rawLine: string
  y: number
}

// Extract text with positions - dummy implementation
export async function extractTextWithPositions(buffer: Buffer): Promise<TextItemWithPosition[]> {
  console.log('Starting PDF text extraction, buffer size:', buffer.length)
  
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
        items.push({
          text: token,
          x,
          y,
          width: token.length * 6,
          height: 10,
          page: 1
        })
      }
      x += (token.length + 1) * 6
    }
    
    y -= 12
  }
  
  console.log('Extracted', items.length, 'text items')
  return items
}

// BCR column positions interface
export interface BCRColumnPositions {
  debitX: number
  creditX: number
  debitEnd: number
  creditEnd: number
}

// Detect BCR columns (not used in text-based analysis)
export function detectBCRColumns(items: TextItemWithPosition[]): BCRColumnPositions | null {
  return {
    debitX: 350,
    creditX: 450,
    debitEnd: 400,
    creditEnd: 550
  }
}

// Parse BCR transactions from positions (not used)
export function parseBCRTransactionsFromPositions(
  items: TextItemWithPosition[],
  columns: BCRColumnPositions
): TransactionLine[] {
  return []
}
