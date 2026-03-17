// PDF Processing utilities for bank statements
// Supports multiple Costa Rican bank formats including Grupo Mutual

export interface ExtractedTransaction {
  date: Date
  amount: number
  description: string
  month: string
  type: 'credit' | 'debit'
}

export interface ExtractedData {
  credits: ExtractedTransaction[]
  debits: ExtractedTransaction[]
  totalCredits: number
  totalDebits: number
  netFlow: number
}

// Credit indicators in transaction descriptions
const CREDIT_INDICATORS = [
  /^N\/C\s/i,                    // N/C at start (Nota de Crédito)
  /^N\/C@/i,                     // N/C@ variant
  /^N\/C\s*@/i,                  // N/C @ variant (with space before @)
  /N\/C\s+TRANSFERENCIA/i,       // N/C TRANSFERENCIA
  /N\/C\s+PAGO/i,                // N/C PAGO
  /^N\s*C\s+TRANSFERENCIA/i,     // N C TRANSFERENCIA (space instead of /)
  /\bN\s*C\s+TRANS/i,            // N C TRANS (with spaces)
  /\bN\s*C\s+SINPE/i,            // N C SINPE (with spaces)
  /DEPOSITOS?\s+CUENTAS/i,       // DEPOSITOS CUENTAS DE AHORRO
  /DEPÓSITOS?\s+CUENTAS/i,       // DEPÓSITOS variant
  /PAGO\s+INTERESES/i,           // PAGO INTERESES - bank pays interest to customer
  /^PAGO\s+INTERESES$/i,         // PAGO INTERESES alone
]

// Debit indicators
const DEBIT_INDICATORS = [
  /^N\/D\s/i,                    // N/D at start (Nota de Débito)
  /^N\/D@/i,                     // N/D@ variant
  /^N\/D\s*@/i,                  // N/D @ variant (with space before @)
  /N\/D\s+TRANSFERENCIA/i,       // N/D TRANSFERENCIA
  /N\/D\s+PAGO/i,                // N/D PAGO
  /\bN\s*D\s+PAGO/i,             // N D PAGO (space instead of /)
  /\bN\s*D\s+ICE/i,              // N D ICE (with spaces)
  /COMPRA\s*EN\s*COMERCIO/i,     // Purchase
  /COMPRA\s+EN\s+COMERCIO/i,     // Purchase (with spaces)
  /RETIRO\sCAJERO/i,             // ATM Withdrawal
  /RETIROS?\s+DE\s+CUENTAS/i,    // Account withdrawals
  /RETIROS?\s+CUENTAS/i,         // Retiros Cuentas (shorter variant)
  /COMISIÓN/i,                   // Commission
  /IMPUESTO/i,                   // Tax
  /PAGO\s+A\s+/i,                // Payment to
  /PAGO\s+AUTOMATICO/i,          // Automatic payment
  /SERVICIOS/i,                  // Services
]

// Clean amount string and convert to float
function cleanAmount(amountStr: string): number {
  if (!amountStr) return 0
  
  let cleaned = amountStr
    .replace(/[₡$¢]/g, '')
    .replace(/\s/g, '')
  
  // Handle Costa Rican format (comma as thousands separator, dot as decimal)
  const hasCommaAsDecimal = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
  
  if (hasCommaAsDecimal) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    cleaned = cleaned.replace(/,/g, '')
  }
  
  const amount = parseFloat(cleaned)
  return isNaN(amount) ? 0 : amount
}

// Parse date string to Date object
function parseDate(dateStr: string): Date | null {
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (match) {
    const [, day, month, year] = match
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  return null
}

// Get month string in YYYY-MM format
function getMonthString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// Determine transaction type from line content
function getTransactionType(line: string): 'credit' | 'debit' | null {
  const upperLine = line.toUpperCase()
  
  // Check for credit indicators first
  for (const pattern of CREDIT_INDICATORS) {
    if (pattern.test(upperLine)) {
      return 'credit'
    }
  }
  
  // Check for debit indicators
  for (const pattern of DEBIT_INDICATORS) {
    if (pattern.test(upperLine)) {
      return 'debit'
    }
  }
  
  return null
}

// Extract transactions from Grupo Mutual layout format
function extractFromGrupoMutualLayout(lines: string[]): ExtractedData {
  const credits: ExtractedTransaction[] = []
  const debits: ExtractedTransaction[] = []
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    // Look for lines starting with date pattern
    const dateMatch = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})/)
    if (!dateMatch) continue
    
    const date = parseDate(dateMatch[1])
    if (!date) continue
    
    // Find all amounts with their positions (including 0.00 for pattern detection)
    const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g
    const amountsWithPositions: { amount: number; position: number }[] = []
    let match
    
    while ((match = amountPattern.exec(line)) !== null) {
      const amount = cleanAmount(match[1])
      amountsWithPositions.push({ amount, position: match.index })
    }
    
    if (amountsWithPositions.length === 0) continue
    
    // Determine transaction type using multiple methods
    let type = getTransactionType(line)
    
    // Special detection for column-based format (Nov/Dec style)
    // Format: DATE | NUMBER | DESCRIPTION | DEBIT_AMT | CREDIT_AMT | SALDO
    // Credit: 0.00 in debit column (~pos 70-80), amount in credit column (~pos 85-100)
    // Debit: amount in debit column (~pos 70-80), 0.00 in credit column (~pos 85-100)
    
    const hasZeroInDebitColumn = amountsWithPositions.some(a => a.amount === 0 && a.position >= 65 && a.position < 85)
    const hasZeroInCreditColumn = amountsWithPositions.some(a => a.amount === 0 && a.position >= 85 && a.position < 105)
    const hasNonZeroInDebitColumn = amountsWithPositions.some(a => a.amount > 0 && a.position >= 65 && a.position < 85)
    const hasNonZeroInCreditColumn = amountsWithPositions.some(a => a.amount > 0 && a.position >= 85 && a.position < 105)
    
    // Column-based detection (Nov/Dec format)
    if (hasZeroInDebitColumn && hasNonZeroInCreditColumn) {
      type = 'credit'
    } else if (hasNonZeroInDebitColumn && hasZeroInCreditColumn) {
      type = 'debit'
    }
    
    if (!type) continue
    
    // Filter out 0.00 amounts for transaction amount extraction
    const nonZeroAmounts = amountsWithPositions.filter(a => a.amount > 0)
    
    if (nonZeroAmounts.length === 0) continue
    
    let transactionAmount = 0
    
    // Determine the correct amount based on format
    if (type === 'credit') {
      // For credits with column format, take amount in credit column (pos 85-105)
      const creditColAmount = nonZeroAmounts.find(a => a.position >= 85 && a.position < 105)
      if (creditColAmount) {
        transactionAmount = creditColAmount.amount
      } else {
        // Standard format: credit at position 105-125
        nonZeroAmounts.sort((a, b) => a.position - b.position)
        const standardCredit = nonZeroAmounts.find(a => a.position >= 100 && a.position < 125)
        transactionAmount = standardCredit ? standardCredit.amount : nonZeroAmounts[0].amount
      }
    } else {
      // For debits, take amount in debit column (pos 65-85)
      const debitColAmount = nonZeroAmounts.find(a => a.position >= 65 && a.position < 85)
      if (debitColAmount) {
        transactionAmount = debitColAmount.amount
      } else {
        // Standard format: debit at position 90-110
        nonZeroAmounts.sort((a, b) => a.position - b.position)
        const standardDebit = nonZeroAmounts.find(a => a.position >= 85 && a.position < 115)
        transactionAmount = standardDebit ? standardDebit.amount : nonZeroAmounts[0].amount
      }
    }
    
    if (transactionAmount <= 0) continue
    
    // Extract description
    let description = line
      .replace(/^\s*\d{2}\/\d{2}\/\d{4}\s+/, '')
      .replace(/\d{3,}\s+/g, '')
      .replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)
    
    const month = getMonthString(date)
    
    const transaction: ExtractedTransaction = {
      date,
      amount: transactionAmount,
      description: description || (type === 'credit' ? 'Transferencia recibida' : 'Pago realizado'),
      month,
      type,
    }
    
    if (type === 'credit') {
      credits.push(transaction)
      console.log('Found credit:', { date: date.toISOString().split('T')[0], amount: transactionAmount, description: description.substring(0, 40) })
    } else {
      debits.push(transaction)
      console.log('Found debit:', { date: date.toISOString().split('T')[0], amount: transactionAmount, description: description.substring(0, 40) })
    }
  }
  
  // Sort by date
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  return {
    credits,
    debits,
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits,
  }
}

// Extract from plain text (non-layout format)
function extractFromPlainText(text: string): ExtractedData {
  const credits: ExtractedTransaction[] = []
  const debits: ExtractedTransaction[] = []
  const lines = text.split('\n')
  
  let currentDate: Date | null = null
  let pendingTransaction: { date: Date; description: string; type: 'credit' | 'debit' } | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // Check for date
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (dateMatch) {
      currentDate = parseDate(dateMatch[1])
      
      // Determine transaction type
      const type = getTransactionType(line)
      if (currentDate && type) {
        pendingTransaction = {
          date: currentDate,
          description: line
            .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
            .replace(/\d{3,}/g, '')
            .replace(/\s+/g, ' ')
            .trim(),
          type,
        }
      }
    }
    
    // Check for amount on next line (common in some PDF formats)
    if (pendingTransaction) {
      const amountMatch = line.match(/^(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/)
      if (amountMatch) {
        const amount = cleanAmount(amountMatch[1])
        if (amount > 0 && amount < 10000000) {
          const month = getMonthString(pendingTransaction.date)
          
          const transaction: ExtractedTransaction = {
            date: pendingTransaction.date,
            amount,
            description: pendingTransaction.description.substring(0, 200) || 
              (pendingTransaction.type === 'credit' ? 'Transferencia recibida' : 'Pago realizado'),
            month,
            type: pendingTransaction.type,
          }
          
          if (pendingTransaction.type === 'credit') {
            credits.push(transaction)
          } else {
            debits.push(transaction)
          }
        }
        pendingTransaction = null
        continue
      }
      
      // Check for amount in current line
      const amounts = line.match(/\d{1,3}(?:,\d{3})*\.\d{2}/g)
      if (amounts && amounts.length > 0) {
        const amount = cleanAmount(amounts[0])
        if (amount > 0 && amount < 10000000) {
          const month = getMonthString(pendingTransaction.date)
          
          const transaction: ExtractedTransaction = {
            date: pendingTransaction.date,
            amount,
            description: pendingTransaction.description.substring(0, 200) || 
              (pendingTransaction.type === 'credit' ? 'Transferencia recibida' : 'Pago realizado'),
            month,
            type: pendingTransaction.type,
          }
          
          if (pendingTransaction.type === 'credit') {
            credits.push(transaction)
          } else {
            debits.push(transaction)
          }
        }
        pendingTransaction = null
      }
    }
  }
  
  // Sort by date
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  return {
    credits,
    debits,
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits,
  }
}

// Extract from OCR text (for scanned PDFs)
// OCR text has different patterns - amounts are space-separated, not column-aligned
function extractFromOCRText(lines: string[]): ExtractedData {
  const credits: ExtractedTransaction[] = []
  const debits: ExtractedTransaction[] = []
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    // Look for lines starting with date pattern
    const dateMatch = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})/)
    if (!dateMatch) continue
    
    const date = parseDate(dateMatch[1])
    if (!date) continue
    
    // Determine transaction type
    const type = getTransactionType(line)
    if (!type) continue
    
    // Find all amounts in the line
    const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g
    const amountsWithPositions: { amount: number; index: number }[] = []
    let match
    
    while ((match = amountPattern.exec(line)) !== null) {
      const amount = cleanAmount(match[1])
      amountsWithPositions.push({ amount, index: match.index })
    }
    
    const amounts = amountsWithPositions.map(a => a.amount)
    
    if (amounts.length === 0) continue
    
    let transactionAmount = 0
    
    // For OCR text from scanned PDFs:
    // - If 2+ amounts: first is transaction, last is saldo (running balance)
    // - If 1 amount: this is likely just the saldo, transaction amount was not captured
    //   We should skip these lines as we can't determine the actual transaction amount
    
    if (amounts.length >= 2) {
      // First amount is the transaction amount, last is the saldo
      transactionAmount = amounts[0]
    } else if (amounts.length === 1) {
      // Single amount in a credit/debit line - this is likely the saldo
      // Skip it as we can't determine the transaction amount
      // This happens with some scanned PDFs where OCR misses column data
      continue
    }
    
    // Validate transaction amount
    if (transactionAmount <= 0) continue
    if (transactionAmount > 1000000) continue // Unlikely transaction over 1 million colones
    
    // Extract description
    let description = line
      .replace(/^\s*\d{2}\/\d{2}\/\d{4}\s+/, '')
      .replace(/\d{3,}\s+/g, '')
      .replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)
    
    const month = getMonthString(date)
    
    const transaction: ExtractedTransaction = {
      date,
      amount: transactionAmount,
      description: description || (type === 'credit' ? 'Transferencia recibida' : 'Pago realizado'),
      month,
      type,
    }
    
    if (type === 'credit') {
      credits.push(transaction)
    } else {
      debits.push(transaction)
    }
  }
  
  // Sort by date
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  return {
    credits,
    debits,
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits,
  }
}

// Main function to extract all transactions from PDF text
export function extractAllTransactions(text: string): ExtractedData {
  console.log('extractAllTransactions: Processing text length', text.length)
  
  const upperText = text.toUpperCase()
  const lines = text.split('\n')
  
  let result: ExtractedData
  
  // Check if this looks like OCR text (no column structure, amounts are space-separated)
  const hasOCRLines = lines.some(line => {
    const amounts = (line.match(/\d{1,3}(?:,\d{3})*\.\d{2}/g) || [])
    return amounts.length >= 2 && line.includes('N/C') || line.includes('N/D')
  })
  
  // Check for column layout (multiple spaces with dates)
  const hasColumnLayout = lines.some(line => 
    /\s{3,}/.test(line) && /\d{2}\/\d{2}\/\d{4}/.test(line) && line.length > 100
  )
  
  // Detect bank format
  if (upperText.includes('GRUPO MUTUAL') || upperText.includes('MUTUAL ALAJUELA')) {
    console.log('Detected Grupo Mutual format')
    
    if (hasOCRLines && !hasColumnLayout) {
      console.log('Using OCR extraction (scanned PDF detected)')
      result = extractFromOCRText(lines)
    } else if (hasColumnLayout) {
      console.log('Using layout extraction')
      result = extractFromGrupoMutualLayout(lines)
    } else {
      console.log('Using plain text extraction')
      result = extractFromPlainText(text)
    }
  } else {
    console.log('Using standard bank format extraction')
    result = extractFromPlainText(text)
  }
  
  console.log('extractAllTransactions: Found', result.credits.length, 'credits and', result.debits.length, 'debits')
  console.log('Totals - Credits:', result.totalCredits, 'Debits:', result.totalDebits, 'Net:', result.netFlow)
  
  return result
}

// Legacy function for backward compatibility
export function extractTransactionsFromText(text: string): ExtractedTransaction[] {
  const data = extractAllTransactions(text)
  return data.credits
}

// Legacy function for backward compatibility
export function extractTransactionsFromTable(text: string): ExtractedTransaction[] {
  return extractTransactionsFromText(text)
}
