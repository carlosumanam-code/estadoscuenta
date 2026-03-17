import { extractTransactionsFromText } from './src/lib/pdf-processor'
import { execSync } from 'child_process'

// Extract text from PDF with layout
const pdfPath = '/home/z/my-project/upload/ESTADOS DE CUENTA MUTUAL MARIA JOSEFA UGALDE.pdf'
const text = execSync(`pdftotext -layout "${pdfPath}" - 2>/dev/null`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 })

console.log('Text length:', text.length)

const transactions = extractTransactionsFromText(text)

console.log('\n=== RESULTS ===')
console.log('Total transactions found:', transactions.length)

let total = 0
const byMonth: Record<string, number> = {}

for (const t of transactions) {
  console.log(`- ${t.date.toISOString().split('T')[0]}: ₡${t.amount.toLocaleString()} - ${t.description.substring(0, 50)}...`)
  total += t.amount
  byMonth[t.month] = (byMonth[t.month] || 0) + t.amount
}

console.log('\nTotal amount: ₡' + total.toLocaleString())
console.log('\nBy month:', byMonth)
