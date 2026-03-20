// Test the actual pdf-processor with the BAC PDF
import { execSync } from 'child_process'
import * as fs from 'fs'

// Read the PDF processor code
const processorCode = fs.readFileSync('./src/lib/pdf-processor.ts', 'utf-8')

// Extract text from PDF
const pdfPath = './upload/Transacciones Rolando.pdf'
const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 })

console.log('PDF Text length:', text.length)

// Parse the text to extract transactions
const lines = text.split('\n')

// Check detection
const upperText = text.toUpperCase()
const isBACFormat = upperText.includes('BAC') || 
                    upperText.includes('CREDOMATIC') ||
                    upperText.includes('SALDO EN LIBROS') ||
                    upperText.includes('SALDO DISPONIBLE')

console.log('\nIs BAC format?', isBACFormat)

// Find header columns
let debitColStart = 75
let debitColEnd = 95
let creditColStart = 95
let creditColEnd = 118
let balanceColStart = 118

for (const line of lines) {
  if (!line.includes('Fecha')) continue
  if (!line.match(/Debito|Débito|DEBITO/i)) continue
  if (!line.match(/Cr[eé]dito|CR[EÉ]DITO/i)) continue
  if (!line.match(/Balance|BALANCE/i)) continue
  
  const upperLine = line.toUpperCase()
  
  const debitMatch = upperLine.match(/\bDEBITO\b/i)
  const creditMatch = upperLine.match(/\bCR[EÉ]DITOS?\b/i)
  const balanceMatch = upperLine.match(/\bBALANCE\b/i)
  
  if (debitMatch) {
    debitColStart = Math.max(0, debitMatch.index! - 5)
    debitColEnd = debitMatch.index! + 20
  }
  if (creditMatch) {
    creditColStart = Math.max(0, creditMatch.index! - 5)
    creditColEnd = creditMatch.index! + 20
  }
  if (balanceMatch) {
    balanceColStart = Math.max(0, balanceMatch.index! - 5)
  }
  
  console.log('\nHeader found:', line.trim())
  console.log('Column positions:', { debitColStart, creditColStart, balanceColStart })
  break
}

// Process first 5 transaction lines
console.log('\n=== Processing transactions ===')

let creditCount = 0
let debitCount = 0

for (const line of lines) {
  if (!line.trim()) continue
  if (line.includes('Código Movimiento') || line.includes('Comisión de')) continue
  if (line.match(/^(MC|PT|CR|MD|TF|TS)\s+/i)) continue
  
  const dateMatch = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})/)
  if (!dateMatch) continue
  
  // Find amounts with positions
  const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g
  const amounts: { amount: number; position: number }[] = []
  let match
  
  while ((match = amountPattern.exec(line)) !== null) {
    const amount = parseFloat(match[1].replace(/,/g, ''))
    amounts.push({ amount, position: match.index })
  }
  
  if (amounts.length === 0) continue
  
  let debitAmount = 0
  let creditAmount = 0
  
  for (const amt of amounts) {
    if (amt.position >= balanceColStart) continue
    
    if (amt.position >= debitColStart && amt.position < debitColEnd) {
      if (amt.amount > 0) debitAmount = amt.amount
    } else if (amt.position >= creditColStart && amt.position < creditColEnd) {
      if (amt.amount > 0) creditAmount = amt.amount
    }
  }
  
  const type = creditAmount > 0 ? 'CREDITO (INGRESO)' : debitAmount > 0 ? 'DEBITO (GASTO)' : 'UNKNOWN'
  
  if (creditAmount > 0) creditCount++
  else if (debitAmount > 0) debitCount++
  
  console.log(`\nLine: ${line.substring(0, 80)}...`)
  console.log(`Amounts: ${amounts.map(a => `₡${a.amount}@${a.position}`).join(', ')}`)
  console.log(`Result: ${type} - ₡${creditAmount || debitAmount}`)
  
  if (creditCount + debitCount >= 10) break
}

console.log('\n=== SUMMARY ===')
console.log('Total credits detected:', creditCount)
console.log('Total debits detected:', debitCount)
