// PDF extractor - works in serverless environments

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('Starting PDF extraction, buffer size:', buffer.length)

  // Set up polyfills dynamically
  if (typeof globalThis !== 'undefined') {
    // @ts-ignore
    if (typeof globalThis.document === 'undefined') {
      // @ts-ignore
      globalThis.document = {
        createElement: () => ({ getContext: () => null, style: {} }),
        createElementNS: () => ({ getContext: () => null, style: {} }),
        getElementsByTagName: () => [],
        head: { appendChild: () => {} },
        body: { appendChild: () => {} },
        documentElement: { style: {} },
      }
    }
    // @ts-ignore
    if (typeof globalThis.window === 'undefined') {
      // @ts-ignore
      globalThis.window = { document: globalThis.document, navigator: { userAgent: 'node' } }
    }
    // @ts-ignore
    if (typeof globalThis.navigator === 'undefined') {
      // @ts-ignore
      globalThis.navigator = { userAgent: 'node' }
    }
    // @ts-ignore
    if (typeof globalThis.URL === 'undefined') {
      // @ts-ignore
      globalThis.URL = { createObjectURL: () => '', revokeObjectURL: () => {} }
    }
  }

  try {
    // Dynamic import to ensure polyfills are set first
    const pdfParse = (await import('pdf-parse')).default || (await import('pdf-parse'))
    
    const data = await pdfParse(buffer, { max: 0 })

    console.log('PDF pages:', data.numpages)
    console.log('Text length:', data.text?.length || 0)

    if (data.text && data.text.trim()) {
      console.log('PDF extraction successful')
      return data.text
    }

    throw new Error('No text was extracted from the PDF')

  } catch (error: any) {
    console.error('PDF extraction error:', error.message)
    throw new Error(`Error al extraer texto del PDF: ${error.message}`)
  }
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
