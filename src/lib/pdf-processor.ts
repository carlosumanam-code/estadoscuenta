// PDF Processing utilities for bank statements
// Supports multiple Costa Rican bank formats including Grupo Mutual and BAC Credomatic

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

// Column positions for BAC format (detected from header)
interface BACColumnPositions {
  debitStart: number
  creditStart: number
  balanceStart: number
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

// Detect BAC column positions from header line
function detectBACColumnPositions(headerLine: string): BACColumnPositions | null {
  const upperLine = headerLine.toUpperCase()
  
  // Look for the header pattern: Fecha ... Debito ... Créditos ... Balance
  const debitMatch = upperLine.match(/DEBITO/i)
  const creditMatch = upperLine.match(/CR[EÉ]DITO/i)
  const balanceMatch = upperLine.match(/BALANCE/i)
  
  if (!debitMatch || !creditMatch || !balanceMatch) {
    return null
  }
  
  return {
    debitStart: debitMatch.index || 55,
    creditStart: creditMatch.index || 80,
    balanceStart: balanceMatch.index || 100,
  }
}

// Extract transactions from BAC Credomatic format
// BAC format: Fecha | Referencia | Código | Descripción | Débito | Créditos | Balance
function extractFromBACFormat(lines: string[]): ExtractedData {
  const credits: ExtractedTransaction[] = []
  const debits: ExtractedTransaction[] = []
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    const dateMatch = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})/)
    if (!dateMatch) continue
    
    const date = parseDate(dateMatch[1])
    if (!date) continue
    
    // BAC PDF structure analysis:
    // Line: "01/01/202588072TFSEGURO CVTD145372,072.000.002,126,757.47"
    // Structure: Date | Ref | Code | Description | Debit | Credit | Balance
    // 
    // The amounts at the end are ALWAYS: Debit, Credit, Balance
    // One of Debit/Credit is always "0.00"
    //
    // Key insight: The amounts are CONSECUTIVE with NO spaces
    // Pattern: ...DescriptionDebitAmountCreditAmountBalanceAmount
    //
    // Example expense: ...SEGURO CVTD145372,072.000.002,126,757.47
    //   - Debit: 2,072.00 (or merged as 372,072.00 if "37" from desc is captured)
    //   - Credit: 0.00
    //   - Balance: 2,126,757.47
    //
    // Example income: ...SINPE-PIN DE QUIROS0.00600,000.001,462,242.83
    //   - Debit: 0.00
    //   - Credit: 600,000.00
    //   - Balance: 1,462,242.83
    
    let debitAmount = 0
    let creditAmount = 0
    let amountsStartIndex = 0
    
    // Find ALL amount-like patterns: any sequence matching X,XXX.XX format
    // But be careful - the description can end with numbers that merge with amounts
    const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g
    const matches: { amount: number; index: number; raw: string }[] = []
    let m
    
    while ((m = amountPattern.exec(line)) !== null) {
      matches.push({
        amount: cleanAmount(m[1]),
        index: m.index,
        raw: m[1]
      })
    }
    
    if (matches.length < 2) continue
    
    // The LAST match is always the BALANCE (running total)
    const balanceMatch = matches[matches.length - 1]
    const balance = balanceMatch.amount
    
    // Look for 0.00 in the matches before balance
    // This is the key delimiter - one of debit/credit is always 0.00
    const zeroMatchIndex = matches.slice(0, -1).findIndex(m => m.raw === '0.00')
    
    if (zeroMatchIndex !== -1) {
      const actualZeroIndex = zeroMatchIndex
      
      if (actualZeroIndex === 0) {
        // Pattern: 0.00, Amount, Balance -> INCOME
        // The 0.00 is in DEBIT column, so the amount after it is CREDIT
        if (matches.length > 2) {
          const creditMatch = matches[1]
          creditAmount = creditMatch.amount
          amountsStartIndex = creditMatch.index
        }
      } else {
        // Pattern: Amount, 0.00, ...Balance -> EXPENSE
        // The amount before 0.00 is DEBIT
        const debitMatch = matches[actualZeroIndex - 1]
        
        // Check if the debit amount is reasonable
        // Problem: Sometimes description numbers merge with amount
        // e.g., "372,072.00" when correct is "2,072.00"
        
        // Heuristic: If debit > balance, it's probably merged incorrectly
        if (debitMatch.amount > balance) {
          // Try to extract the correct amount from the raw string
          // Look for pattern: last occurrence of ,XXX.XX (comma + 3 digits + dot + 2 digits)
          const rawStr = debitMatch.raw
          const validAmountMatch = rawStr.match(/,(\d{3}\.\d{2})$/)
          
          if (validAmountMatch) {
            // Extract the digits before the comma (1-2 digits for small/medium amounts)
            const beforeComma = rawStr.substring(0, rawStr.length - validAmountMatch[0].length)
            // Find the last 1-4 digits before the comma
            const digitsMatch = beforeComma.match(/(\d{1,4})$/)
            
            if (digitsMatch) {
              // Reconstruct: digits + comma + 3 digits + .XX
              const correctedRaw = digitsMatch[1] + validAmountMatch[0]
              const corrected = cleanAmount(correctedRaw)
              
              if (corrected > 0 && corrected <= balance) {
                debitAmount = corrected
                amountsStartIndex = debitMatch.index + (rawStr.length - correctedRaw.length)
              } else {
                // Fallback
                debitAmount = debitMatch.amount
                amountsStartIndex = debitMatch.index
              }
            } else {
              debitAmount = debitMatch.amount
              amountsStartIndex = debitMatch.index
            }
          } else {
            debitAmount = debitMatch.amount
            amountsStartIndex = debitMatch.index
          }
        } else {
          // Amount is reasonable, use as-is
          debitAmount = debitMatch.amount
          amountsStartIndex = debitMatch.index
        }
      }
    } else {
      // No 0.00 found - unusual case
      // Try to parse from position
      if (matches.length >= 3) {
        debitAmount = matches[0].amount
        creditAmount = matches[1].amount
        amountsStartIndex = matches[0].index
      } else if (matches.length === 2) {
        // Only one amount + balance
        const transactionMatch = matches[0]
        const detectedType = getTransactionType(line)
        
        if (detectedType === 'credit') {
          creditAmount = transactionMatch.amount
        } else {
          debitAmount = transactionMatch.amount
        }
        amountsStartIndex = transactionMatch.index
      }
    }
    
    // Determine final type
    let type: 'credit' | 'debit' | null = null
    let transactionAmount = 0
    
    if (creditAmount > 0 && debitAmount === 0) {
      type = 'credit'
      transactionAmount = creditAmount
    } else if (debitAmount > 0 && creditAmount === 0) {
      type = 'debit'
      transactionAmount = debitAmount
    } else if (creditAmount > 0 && debitAmount > 0) {
      const detectedType = getTransactionType(line)
      if (detectedType === 'credit') {
        type = 'credit'
        transactionAmount = creditAmount
      } else {
        type = 'debit'
        transactionAmount = debitAmount
      }
    }
    
    if (!type || transactionAmount <= 0) continue
    
    const description = extractBACDescription(line, amountsStartIndex)
    const month = getMonthString(date)
    
    const transaction: ExtractedTransaction = {
      date,
      amount: transactionAmount,
      description,
      month,
      type,
    }
    
    if (type === 'credit') {
      credits.push(transaction)
    } else {
      debits.push(transaction)
    }
  }
  
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  return { credits, debits, totalCredits, totalDebits, netFlow: totalCredits - totalDebits }
}

function extractBACDescription(line: string, amountsStartIndex: number): string {
  let desc = line.substring(0, amountsStartIndex)
  desc = desc
    .replace(/^\s*\d{2}\/\d{2}\/\d{4}/, '')
    .replace(/^\d+\s*/, '')
    .replace(/^[A-Z]{2,3}\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return desc.substring(0, 200) || 'Transacción'
}

// Extract transactions from Banco Nacional de Costa Rica (BNCR) format
// BNCR format: FECHA | NUMERO | DESCRIPCIÓN | MONTO (+/-) | SALDO DIARIO
// Amount ends with "+" for credits (ingresos) or "-" for debits (egresos)
function extractFromBNCRFormat(lines: string[]): ExtractedData {
  const credits: ExtractedTransaction[] = []
  const debits: ExtractedTransaction[] = []
  
  // Extract year from "FECHA ESTE ESTADO" or "FECHA ULTIMO ESTADO"
  let statementYear: number | null = null
  
  for (const line of lines) {
    const dateMatch = line.match(/FECHA\s+(?:ESTE\s+)?ESTADO\s+(\d{2})\/(\d{2})\/(\d{4})/i)
    if (dateMatch) {
      statementYear = parseInt(dateMatch[3])
      console.log('BNCR: Detected statement year:', statementYear)
      break
    }
    // Alternative: look for a date pattern near the top
    const altMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (altMatch && !statementYear) {
      statementYear = parseInt(altMatch[3])
    }
  }
  
  // If no year found, use current year
  if (!statementYear) {
    statementYear = new Date().getFullYear()
    console.log('BNCR: Using current year:', statementYear)
  }
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    // BNCR transaction lines start with date DD/MM format
    // Example: "11/04   302392          07-04-23 GESSA SUPER COMPRO TIB SAN JOSE CRI..."
    const dateMatch = line.match(/^\s*(\d{2})\/(\d{2})\s+/)
    if (!dateMatch) continue
    
    const day = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2])
    const date = new Date(statementYear, month - 1, day)
    
    // Look for amount pattern with +/- sign at the end
    // Pattern: amount followed by space and + or - sign
    // Example: "3,500.00 -" or "25,500.00 +"
    const amountSignMatch = line.match(/(\d{1,3}(?:,\d{3})*\.\d{2})\s+([+\-])/)
    
    if (!amountSignMatch) continue
    
    const amount = cleanAmount(amountSignMatch[1])
    const sign = amountSignMatch[2]
    
    if (amount <= 0) continue
    
    // Determine type based on sign
    // "+" = credit (ingreso), "-" = debit (egreso)
    const type: 'credit' | 'debit' = sign === '+' ? 'credit' : 'debit'
    
    // Extract description - text between the transaction number and the amount
    // Format: DD/MM   NUMBER   DESCRIPTION   AMOUNT +/-   SALDO
    let description = line
      .replace(/^\s*\d{2}\/\d{2}\s+/, '')  // Remove date
      .replace(/^\d+\s+/, '')               // Remove transaction number
      .replace(/\d{1,3}(?:,\d{3})*\.\d{2}\s+[+\-].*$/, '')  // Remove amount and everything after
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)
    
    const monthStr = getMonthString(date)
    
    const transaction: ExtractedTransaction = {
      date,
      amount,
      description: description || (type === 'credit' ? 'Transferencia recibida' : 'Pago realizado'),
      month: monthStr,
      type,
    }
    
    if (type === 'credit') {
      credits.push(transaction)
      console.log('BNCR Credit:', { date: date.toISOString().split('T')[0], amount, description: description.substring(0, 40) })
    } else {
      debits.push(transaction)
      console.log('BNCR Debit:', { date: date.toISOString().split('T')[0], amount, description: description.substring(0, 40) })
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

// Extract transactions from Banco de Costa Rica (BCR) format
// BCR format: Fecha Mov | Fecha Cont | Tarjeta | Doc | Concepto | Monto Débito | Monto Crédito
// STRATEGY: Use the position of the amount in the text line
// - CRÉDITOS (ingresos) appear at position 76-77
// - DÉBITOS (gastos) appear at position 78-79
// The cutoff is position 78
function extractFromBCRFormat(lines: string[]): ExtractedData {
  const credits: ExtractedTransaction[] = []
  const debits: ExtractedTransaction[] = []
  
  // Extract year from statement
  let statementYear: number | null = null
  for (const line of lines) {
    const periodMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})\s+al\s+(\d{2})\/(\d{2})\/(\d{4})/i)
    if (periodMatch) {
      statementYear = parseInt(periodMatch[6])
      break
    }
    const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (dateMatch && !statementYear) {
      statementYear = parseInt(dateMatch[3])
    }
  }
  
  if (!statementYear) {
    statementYear = new Date().getFullYear()
  }
  
  for (const line of lines) {
    if (!line.trim()) continue
    
    // BCR transaction lines start with date DD/MM/YY format
    const dateMatch = line.match(/^\s*(\d{2})\/(\d{2})\/(\d{2})/)
    if (!dateMatch) continue
    
    const day = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2])
    const year = parseInt(dateMatch[3]) + 2000
    const date = new Date(year, month - 1, day)
    
    // Find the amount at end of line and its position
    const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/;
    const match = line.match(amountPattern);
    
    if (!match) continue
    
    const amountPosition = match.index ?? 0;
    const transactionAmount = cleanAmount(match[1]);
    
    if (transactionAmount <= 0) continue
    
    // Determine type based on position
    // Position < 78 = CRÉDITO (ingreso)
    // Position >= 78 = DÉBITO (gasto)
    const type: 'credit' | 'debit' = amountPosition < 78 ? 'credit' : 'debit';
    
    // Extract description
    let description = line
      .replace(/^\s*\d{2}\/\d{2}\/\d{2}\s+/, '')
      .replace(/^\d{2}\/\d{2}\/\d{2}\s+/, '')
      .replace(/^\d+\s+/, '')
      .replace(/^\d+\s+/, '')
      .replace(/\d{1,3}(?:,\d{3})*\.\d{2}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200)
    
    const monthStr = getMonthString(date)
    
    const transaction: ExtractedTransaction = {
      date,
      amount: transactionAmount,
      description: description || 'Transacción',
      month: monthStr,
      type,
    }
    
    if (type === 'credit') {
      credits.push(transaction)
    } else {
      debits.push(transaction)
    }
  }
  
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  console.log('BCR Summary: Credits:', credits.length, '(', totalCredits, ') Debits:', debits.length, '(', totalDebits, ')')
  
  return { credits, debits, totalCredits, totalDebits, netFlow: totalCredits - totalDebits }
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

// Extract BCR transactions using position-aware data from pdfjs-dist
// This function receives transactions that already have debit/credit amounts determined by position
export function extractFromBCRWithPositions(transactions: TransactionLine[]): ExtractedData {
  const credits: ExtractedTransaction[] = []
  const debits: ExtractedTransaction[] = []
  
  // Get year from current date or transactions
  const currentYear = new Date().getFullYear()
  
  for (const tx of transactions) {
    // Parse date from DD/MM/YY format
    const dateMatch = tx.date.match(/(\d{2})\/?(\d{2})\/?(\d{2})/)
    if (!dateMatch) continue
    
    const day = parseInt(dateMatch[1])
    const month = parseInt(dateMatch[2])
    const year = parseInt(dateMatch[3]) + 2000
    const date = new Date(year, month - 1, day)
    
    // Only add credit transactions (what the user wants)
    if (tx.creditAmount && tx.creditAmount.value > 0) {
      const monthStr = getMonthString(date)
      
      credits.push({
        date,
        amount: tx.creditAmount.value,
        description: tx.description || 'Transacción',
        month: monthStr,
        type: 'credit'
      })
      
      console.log('BCR Credit (position-based):', {
        date: date.toISOString().split('T')[0],
        amount: tx.creditAmount.value,
        description: tx.description.substring(0, 50),
        x: tx.creditAmount.x
      })
    }
    
    // Also track debits for statistics
    if (tx.debitAmount && tx.debitAmount.value > 0) {
      const monthStr = getMonthString(date)
      
      debits.push({
        date,
        amount: tx.debitAmount.value,
        description: tx.description || 'Transacción',
        month: monthStr,
        type: 'debit'
      })
    }
  }
  
  // Sort by date
  credits.sort((a, b) => a.date.getTime() - b.date.getTime())
  debits.sort((a, b) => a.date.getTime() - b.date.getTime())
  
  const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
  const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
  
  console.log('BCR Position-based Summary: Credits:', credits.length, '(', totalCredits, ') Debits:', debits.length, '(', totalDebits, ')')
  
  return {
    credits,
    debits,
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits
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
  
  // Check for BAC format - has "Debito" and "Créditos" headers with "Balance"
  const isBACFormat = lines.some(line => {
    const upper = line.toUpperCase()
    return (upper.includes('DEBITO') || upper.includes('DÉBITO')) && 
           (upper.includes('CRÉDITO') || upper.includes('CREDITO')) && 
           upper.includes('BALANCE')
  })
  
  // Check for BCR (Banco de Costa Rica) format - has "Monto Débito" and "Monto Crédito" columns
  const isBCRFormat = lines.some(line => {
    const upper = line.toUpperCase()
    return (upper.includes('MONTO DÉBITO') || upper.includes('MONTO DEBITO')) && 
           (upper.includes('MONTO CRÉDITO') || upper.includes('MONTO CREDITO'))
  })
  
  // Check for BNCR (Banco Nacional) format - has amounts with +/- signs
  // BNCR specific: amounts end with +/- sign and header has "SALDO DIARIO" as column header
  const isBNCRFormat = lines.some(line => {
    const upper = line.toUpperCase()
    // BNCR has "SALDO DIARIO" as a column header (not just mention in text)
    const hasSaldoDiarioHeader = /^\s*FECHA\s+NUMERO.*SALDO/i.test(line)
    // Or amounts with +/- signs at the end
    const hasSignAmount = line.match(/\d{1,3}(?:,\d{3})*\.\d{2}\s+[+\-]/)
    return hasSaldoDiarioHeader || hasSignAmount
  })
  
  // Also check for amounts ending with +/- sign pattern (BNCR specific)
  const hasSignPattern = lines.some(line => 
    line.match(/\d{1,3}(?:,\d{3})*\.\d{2}\s+[+\-]/) && 
    line.match(/^\s*\d{2}\/\d{2}\s+/)
  )
  
  // Detect bank format - order matters! Check most specific first
  if (isBACFormat || upperText.includes('BAC CREDOMATIC')) {
    console.log('Detected BAC Credomatic format')
    result = extractFromBACFormat(lines)
  } else if (isBCRFormat) {
    console.log('Detected Banco de Costa Rica (BCR) format')
    result = extractFromBCRFormat(lines)
  } else if (isBNCRFormat || hasSignPattern || upperText.includes('BNCR') || upperText.includes('BANCO NACIONAL')) {
    console.log('Detected Banco Nacional (BNCR) format')
    result = extractFromBNCRFormat(lines)
  } else if (upperText.includes('GRUPO MUTUAL') || upperText.includes('MUTUAL ALAJUELA')) {
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
