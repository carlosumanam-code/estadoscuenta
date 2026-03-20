// BCR (Banco de Costa Rica) PDF Parser
// Parses transaction data extracted from BCR PDF statements

export interface BCRTransaction {
  date: Date
  amount: number
  description: string
  type: 'credit' | 'debit'
  rawLine: string
}

export interface BCRParseResult {
  credits: BCRTransaction[]
  debits: BCRTransaction[]
  totalCredits: number
  totalDebits: number
}

// Parse amount string to number
function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Parse date string DD/MM/YY to Date
function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{2})/)
  if (!match) return null
  
  const day = parseInt(match[1])
  const month = parseInt(match[2])
  const year = parseInt(match[3]) + 2000
  
  return new Date(year, month - 1, day)
}

// Keywords that indicate CREDIT transactions (ingresos)
const CREDIT_KEYWORDS = [
  'SINPE',
  'TRANSFERENC',
  'MONEDERO',
  'PIN ENTRANTE',
  'DTR TIEMPOREAL',
  'NC DEPOSITO',
  'CREDITO POR DEP',
  'DEPOSITOS -',
  'INTS GANADOS',
]

// Keywords that indicate DEBIT transactions (gastos)
const DEBIT_KEYWORDS = [
  'COMPRAS EN COMERCIOS',
  'DB AH PAGO',
  'ND AH',
  'PG AH',
  'PAG SERV PUB',
  'TASACION',
  'DEBITO COMPENSADO',
  'COSEVI',
]

// Determine transaction type based on description
function getTransactionType(description: string): 'credit' | 'debit' {
  const upper = description.toUpperCase()
  
  // Check for credit keywords first
  for (const keyword of CREDIT_KEYWORDS) {
    if (upper.includes(keyword)) {
      return 'credit'
    }
  }
  
  // Check for debit keywords
  for (const keyword of DEBIT_KEYWORDS) {
    if (upper.includes(keyword)) {
      return 'debit'
    }
  }
  
  // Default to debit
  return 'debit'
}

// Main BCR parser
export function parseBCRText(text: string): BCRParseResult {
  const credits: BCRTransaction[] = []
  const debits: BCRTransaction[] = []
  
  console.log('=== BCR Parser ===')
  console.log('Text length:', text.length)
  
  // Pattern 1: Format with tarjeta + documento (COMPRAS EN COMERCIOS)
  // DD/MM/YY DD/MM/YY TARJETA DOCUMENTO DESCRIPCION MONTO
  // Example: 29/08/24 02/09/24 1494 271671 COMPRAS EN COMERCIOS - ... 7,357.35
  const pattern1 = /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s+(\d+)\s+(\d+)\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})/g
  
  // Pattern 2: Format with single documento (SINPE, TRANSFERENCIAS)
  // DD/MM/YY DD/MM/YY DOCUMENTO DESCRIPCION MONTO
  // Example: 31/08/24 02/09/24 80998792 PIN ENTRANTE SINPE - ... 1,155,000.00
  const pattern2 = /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{7,})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})/g
  
  const processedLines = new Set<string>()
  let match
  
  // Process pattern 1 (with tarjeta + documento)
  while ((match = pattern1.exec(text)) !== null) {
    const dateStr = match[1]
    const description = match[5].trim()
    const amountStr = match[6]
    const lineKey = `${dateStr}|${amountStr}|${description.substring(0, 30)}`
    
    if (processedLines.has(lineKey)) continue
    processedLines.add(lineKey)
    
    const date = parseDate(dateStr)
    const amount = parseAmount(amountStr)
    
    if (!date || amount <= 0) continue
    
    const type = getTransactionType(description)
    
    const transaction: BCRTransaction = {
      date,
      amount,
      description: description.substring(0, 200),
      type,
      rawLine: match[0]
    }
    
    if (type === 'credit') {
      credits.push(transaction)
      console.log(`[CREDIT] ${dateStr} | ${amount} | ${description.substring(0, 40)}`)
    } else {
      debits.push(transaction)
    }
  }
  
  // Process pattern 2 (single documento - 7+ digits)
  while ((match = pattern2.exec(text)) !== null) {
    const dateStr = match[1]
    const description = match[4].trim()
    const amountStr = match[5]
    const lineKey = `${dateStr}|${amountStr}|${description.substring(0, 30)}`
    
    if (processedLines.has(lineKey)) continue
    processedLines.add(lineKey)
    
    const date = parseDate(dateStr)
    const amount = parseAmount(amountStr)
    
    if (!date || amount <= 0) continue
    
    const type = getTransactionType(description)
    
    const transaction: BCRTransaction = {
      date,
      amount,
      description: description.substring(0, 200),
      type,
      rawLine: match[0]
    }
    
    if (type === 'credit') {
      credits.push(transaction)
      console.log(`[CREDIT] ${dateStr} | ${amount} | ${description.substring(0, 40)}`)
    } else {
      debits.push(transaction)
    }
  }
  
  console.log('Credits found:', credits.length)
  console.log('Debits found:', debits.length)
  
  // Sort by date
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  console.log('Total credits:', totalCredits)
  console.log('Total debits:', totalDebits)
  
  return {
    credits,
    debits,
    totalCredits,
    totalDebits
  }
}
