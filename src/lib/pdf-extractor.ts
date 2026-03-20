// PDF extractor using pdf-parse - NO worker dependencies
// This version uses text pattern analysis instead of X,Y positions

import pdfParse from 'pdf-parse'

// Configure pdf-parse options - minimal config to avoid worker issues
// The patch applied to pdf-parse should handle worker disabling at the source
const PDF_PARSE_OPTIONS = {
  max: 0, // No page limit
  version: 'v1.10.100' // Use specific pdf.js version bundled with pdf-parse
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

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('Starting PDF extraction, buffer size:', buffer.length)

  try {
    // Simple extraction - patch handles worker disabling
    const data = await pdfParse(buffer, PDF_PARSE_OPTIONS)

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

// Extract text with positions - dummy implementation that uses text analysis instead
export async function extractTextWithPositions(buffer: Buffer): Promise<TextItemWithPosition[]> {
  console.log('Starting PDF text extraction, buffer size:', buffer.length)
  
  try {
    const data = await pdfParse(buffer, PDF_PARSE_OPTIONS)
    const text = data.text
    
    // Parse the text into items (one per line, with estimated positions)
    const lines = text.split('\n')
    const items: TextItemWithPosition[] = []
    let y = 800
    
    for (const line of lines) {
      if (!line.trim()) {
        y -= 12
        continue
      }
      
      // Split line into tokens and estimate X positions
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
    
  } catch (error: any) {
    console.error('PDF extraction error:', error)
    throw new Error(`Error al extraer PDF: ${error.message}`)
  }
}

// Detect BCR column positions from header
export interface BCRColumnPositions {
  debitX: number
  creditX: number
  debitEnd: number
  creditEnd: number
}

export function detectBCRColumns(items: TextItemWithPosition[]): BCRColumnPositions | null {
  // Return default positions - not used in text-based analysis
  return {
    debitX: 350,
    creditX: 450,
    debitEnd: 400,
    creditEnd: 550
  }
}

// Parse BCR transactions using text pattern analysis instead of X,Y positions
export function parseBCRTransactionsFromPositions(
  items: TextItemWithPosition[],
  columns: BCRColumnPositions
): TransactionLine[] {
  const transactions: TransactionLine[] = []
  
  // Group items by Y position (same line)
  const lineMap = new Map<string, TextItemWithPosition[]>()
  
  for (const item of items) {
    const yKey = item.y.toFixed(2)
    
    if (!lineMap.has(yKey)) {
      lineMap.set(yKey, [])
    }
    lineMap.get(yKey)!.push(item)
  }
  
  const sortedYKeys = Array.from(lineMap.keys()).sort((a, b) => parseFloat(b) - parseFloat(a))
  
  // Process each line looking for transaction patterns
  for (const yKey of sortedYKeys) {
    const lineItems = lineMap.get(yKey)!
    const lineText = lineItems.map(i => i.text).join(' ')
    
    // Look for date pattern at start: DD/MM/YY
    const dateMatch = lineText.match(/^(\d{2}\/\d{2}\/\d{2})/)
    if (!dateMatch) continue
    
    const date = dateMatch[1]
    
    // Find amounts in the line (pattern: X,XXX.XX)
    const amountMatches = lineText.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{2})/g)
    const amounts: { value: number; text: string; index: number }[] = []
    
    for (const match of amountMatches) {
      const value = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(value) && value > 0) {
        amounts.push({ value, text: match[1], index: match.index || 0 })
      }
    }
    
    if (amounts.length === 0) continue
    
    // BCR text pattern analysis:
    // Lines with credit transactions typically have the amount towards the end
    // Lines with debit transactions also have amount towards the end
    // The KEY difference: We need to look at the STRUCTURE of the line
    
    // For BCR statements:
    // - Transaction lines have: DATE | DATE2 | CARD | DOC | DESCRIPTION | DEBIT | CREDIT
    // - When DEBIT column has amount, CREDIT is empty (and vice versa)
    // - The LAST amount is typically the balance (running total)
    
    // Strategy: Look for lines with 2 amounts
    // - If 2 amounts: first is transaction, second is balance
    // - Determine credit vs debit by looking at the position in the line
    
    let transactionAmount: { value: number; x: number } | null = null
    let isCredit = false
    let isDebit = false
    
    if (amounts.length >= 2) {
      // Get the transaction amount (not the balance)
      const txAmount = amounts[amounts.length - 2] // Second to last is transaction
      const balanceAmount = amounts[amounts.length - 1] // Last is balance
      
      // Determine if credit or debit based on position in text
      // Credits appear later in the line (higher X position)
      // We'll use character position as a proxy for X position
      const lineLength = lineText.length
      const amountPosition = txAmount.index
      const relativePosition = amountPosition / lineLength
      
      // If the amount is in the last 35% of the line, it's likely a credit
      // If it's in the 20-50% range, it's likely a debit
      if (relativePosition > 0.65) {
        isCredit = true
        transactionAmount = { value: txAmount.value, x: 500 }
      } else if (relativePosition > 0.35) {
        isDebit = true
        transactionAmount = { value: txAmount.value, x: 400 }
      }
    } else if (amounts.length === 1) {
      // Single amount - this could be a transaction
      // Check position to determine type
      const txAmount = amounts[0]
      const lineLength = lineText.length
      const relativePosition = txAmount.index / lineLength
      
      if (relativePosition > 0.6) {
        isCredit = true
        transactionAmount = { value: txAmount.value, x: 500 }
      } else {
        isDebit = true
        transactionAmount = { value: txAmount.value, x: 400 }
      }
    }
    
    if (!transactionAmount) continue
    
    // Extract description - everything between dates and amounts
    let description = lineText
      .replace(/^\d{2}\/\d{2}\/\d{2}\s+/, '') // Remove first date
      .replace(/^\d{2}\/\d{2}\/\d{2}\s+/, '') // Remove second date
      .replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '') // Remove amounts
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)
    
    transactions.push({
      date,
      description: description || 'Transacción',
      debitAmount: isDebit ? transactionAmount : null,
      creditAmount: isCredit ? transactionAmount : null,
      rawLine: lineText,
      y: parseFloat(yKey)
    })
  }
  
  console.log('Parsed', transactions.length, 'BCR transactions from text')
  
  const credits = transactions.filter(t => t.creditAmount && t.creditAmount.value > 0)
  const debits = transactions.filter(t => t.debitAmount && t.debitAmount.value > 0)
  console.log('Summary: Credits:', credits.length, 'Debits:', debits.length)
  
  return transactions
}
