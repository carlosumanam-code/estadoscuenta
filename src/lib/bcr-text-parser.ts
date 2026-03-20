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
  'SINPE MOVIL',
  'SINPE MOVIL OTRA ENT',
  'MONEDERO SINPE',
  'PIN ENTRANTE SINPE',
  'DTR TIEMPOREAL SINPE',
  'TRANSFERENC BANCOBCR',
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
  'TASACION BANCOBCR',
  'DEBITO COMPENSADO',
]

// Determine if a transaction is a credit based on description
function isCreditTransaction(description: string): boolean {
  const upper = description.toUpperCase()
  
  // Check for credit keywords
  for (const keyword of CREDIT_KEYWORDS) {
    if (upper.includes(keyword)) {
      return true
    }
  }
  
  return false
}

// Determine if a transaction is a debit based on description
function isDebitTransaction(description: string): boolean {
  const upper = description.toUpperCase()
  
  // Check for debit keywords
  for (const keyword of DEBIT_KEYWORDS) {
    if (upper.includes(keyword)) {
      return true
    }
  }
  
  return false
}

// Main BCR parser
export function parseBCRText(text: string): BCRParseResult {
  const credits: BCRTransaction[] = []
  const debits: BCRTransaction[] = []
  
  console.log('=== BCR Parser ===')
  console.log('Text length:', text.length)
  
  // Pattern to match transaction lines
  // Format: DD/MM/YY DD/MM/YY XXXXXX DOC_NUM DESCRIPTION AMOUNT
  // Example: 31/08/24 02/09/24 80998792 PIN ENTRANTE SINPE - HUMBERTO 1,155,000.00
  
  const transactionPattern = /(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})\s+(\d+)\s+(\d+)\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})/g
  
  let match
  let transactionCount = 0
  
  while ((match = transactionPattern.exec(text)) !== null) {
    transactionCount++
    
    const dateStr = match[1]
    const description = match[5].trim()
    const amountStr = match[6]
    
    const date = parseDate(dateStr)
    const amount = parseAmount(amountStr)
    
    if (!date || amount <= 0) continue
    
    // Determine transaction type
    let type: 'credit' | 'debit' | null = null
    
    if (isCreditTransaction(description)) {
      type = 'credit'
    } else if (isDebitTransaction(description)) {
      type = 'debit'
    } else {
      // Unknown - default to debit but log it
      console.log('Unknown transaction type:', description.substring(0, 50))
      type = 'debit'
    }
    
    const transaction: BCRTransaction = {
      date,
      amount,
      description: description.substring(0, 200),
      type,
      rawLine: match[0]
    }
    
    if (type === 'credit') {
      credits.push(transaction)
    } else {
      debits.push(transaction)
    }
  }
  
  console.log('Transactions found:', transactionCount)
  console.log('Credits:', credits.length)
  console.log('Debits:', debits.length)
  
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
