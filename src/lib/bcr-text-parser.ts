// BCR (Banco de Costa Rica) PDF Parser - Pattern-based analysis
// Uses keyword detection + debit column analysis (double validation)

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

// Check if line contains credit-related keywords
function hasCreditKeywords(text: string): boolean {
  const upper = text.toUpperCase()
  return upper.includes('SINPE') || 
         upper.includes('TRANSFERENCIA') ||
         upper.includes('TRANSFER')
}

// Find all amounts in a line with their positions
function findAmounts(line: string): { value: number; text: string; index: number }[] {
  const amounts: { value: number; text: string; index: number }[] = []
  const pattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g
  let match
  
  while ((match = pattern.exec(line)) !== null) {
    const value = parseAmount(match[1])
    amounts.push({
      value,
      text: match[1],
      index: match.index || 0
    })
  }
  
  return amounts
}

// Check if there's a "debit amount" (non-zero amount in debit position)
// In BCR statements, the pattern is typically:
// ... DESCRIPTION | DEBIT | CREDIT | BALANCE
// We detect this by analyzing the amounts pattern
function hasDebitAmount(amounts: { value: number; text: string; index: number }[], lineLength: number): boolean {
  if (amounts.length < 2) return false
  
  // In BCR text, when extracted linearly:
  // - If there are 3 amounts: typically DEBIT, CREDIT, BALANCE
  // - If there are 2 amounts: could be (DEBIT/CRÉDITO), BALANCE
  //
  // The KEY insight: When it's a CREDIT transaction, the DEBIT column shows 0.00 or is empty
  // When it's a DEBIT transaction, the DEBIT column has a real amount
  
  // Strategy: Look at the first transaction amount (not the balance)
  // If amounts.length >= 3: first amount is the transaction (debit or credit depending on column)
  // If amounts.length == 2: we need to determine which column the amount is in
  
  if (amounts.length >= 3) {
    // Pattern: DEBIT CREDIT BALANCE
    // The first amount is what we need to check
    const firstAmount = amounts[0].value
    const secondAmount = amounts[1].value
    
    // If first is non-zero and second is 0 or very small, it's a DEBIT
    // If first is 0 or very small and second is non-zero, it's a CREDIT
    
    if (firstAmount > 0 && secondAmount === 0) {
      // Debit column has amount, credit is 0 = DEBIT transaction
      return true
    } else if (firstAmount === 0 && secondAmount > 0) {
      // Debit column is 0, credit has amount = CREDIT transaction
      return false
    } else if (firstAmount > 0 && secondAmount > 0) {
      // Both have amounts - this shouldn't happen in normal transactions
      // Could be a summary row, treat as debit
      return true
    }
  } else if (amounts.length === 2) {
    // Pattern: could be TRANSACTION, BALANCE
    // We need to determine if the transaction is debit or credit
    // Use position heuristic: if the first amount is in the first half of the line,
    // it's more likely to be in the debit column
    
    const firstAmount = amounts[0]
    const relativePosition = firstAmount.index / lineLength
    
    // If amount appears before 60% of the line, it's likely in debit column
    if (relativePosition < 0.6 && firstAmount.value > 0) {
      return true
    }
    
    return false
  }
  
  return false
}

// Get the transaction amount (excluding balance)
function getTransactionAmount(amounts: { value: number; text: string; index: number }[]): number {
  if (amounts.length === 0) return 0
  
  if (amounts.length >= 3) {
    // Pattern: DEBIT CREDIT BALANCE
    // Return the non-zero amount between first two
    if (amounts[0].value > 0) return amounts[0].value
    if (amounts[1].value > 0) return amounts[1].value
    return 0
  } else if (amounts.length === 2) {
    // First amount is the transaction
    return amounts[0].value
  } else if (amounts.length === 1) {
    return amounts[0].value
  }
  
  return 0
}

// Main BCR parser with double validation logic
export function parseBCRText(text: string): BCRParseResult {
  const credits: BCRTransaction[] = []
  const debits: BCRTransaction[] = []
  
  console.log('=== BCR Pattern-Based Parser ===')
  console.log('Text length:', text.length)
  
  const lines = text.split('\n')
  console.log('Total lines:', lines.length)
  
  let transactionCount = 0
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue
    
    // Check if this is a transaction line (starts with date DD/MM/YY)
    const dateMatch = trimmedLine.match(/^(\d{2}\/\d{2}\/\d{2})/)
    if (!dateMatch) continue
    
    transactionCount++
    
    // Get the date
    const date = parseDate(dateMatch[1])
    if (!date) continue
    
    // Find all amounts
    const amounts = findAmounts(trimmedLine)
    if (amounts.length === 0) continue
    
    // Get transaction amount
    const transactionAmount = getTransactionAmount(amounts)
    if (transactionAmount <= 0) continue
    
    // Extract description
    let description = trimmedLine
      .replace(/^\d{2}\/\d{2}\/\d{2}\s+/, '') // Remove first date
      .replace(/^\d{2}\/\d{2}\/\d{2}\s+/, '') // Remove second date
      .replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '') // Remove amounts
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)
    
    // === DOUBLE VALIDATION LOGIC ===
    // 
    // 1. Tiene SINPE/Transferencia en la descripción?
    //    - SI + NO tiene monto en débito = INGRESO (CRÉDITO)
    //    - SI + SÍ tiene monto en débito = GASTO (DÉBITO)
    // 2. NO tiene SINPE/Transferencia = GASTO (DÉBITO)
    
    const hasKeywords = hasCreditKeywords(description)
    const hasDebit = hasDebitAmount(amounts, trimmedLine.length)
    
    let isCredit = false
    
    if (hasKeywords) {
      // Has SINPE/Transferencia keywords
      if (!hasDebit) {
        // No debit amount = INGRESO (CRÉDITO)
        isCredit = true
        console.log(`[INGRESO] ${dateMatch[1]} | ${transactionAmount} | ${description.substring(0, 40)}...`)
      } else {
        // Has debit amount = GASTO (DÉBITO)
        isCredit = false
        console.log(`[GASTO - con keyword] ${dateMatch[1]} | ${transactionAmount} | ${description.substring(0, 40)}...`)
      }
    } else {
      // No keywords = GASTO (DÉBITO)
      isCredit = false
    }
    
    const transaction: BCRTransaction = {
      date,
      amount: transactionAmount,
      description: description || 'Transacción',
      type: isCredit ? 'credit' : 'debit',
      rawLine: trimmedLine
    }
    
    if (isCredit) {
      credits.push(transaction)
    } else {
      debits.push(transaction)
    }
  }
  
  console.log('Transaction lines processed:', transactionCount)
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
