import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPDF } from '@/lib/pdf-extractor'

export const runtime = 'nodejs'
export const maxDuration = 60

// Debug endpoint specifically for BAC format parsing
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Extract text from PDF
    const text = await extractTextFromPDF(buffer)
    const lines = text.split('\n')
    
    // Parse ALL transaction lines in detail
    const transactionDetails: any[] = []
    let creditCount = 0
    let debitCount = 0
    
    for (const line of lines) {
      const dateMatch = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})/)
      if (!dateMatch) continue
      
      // Find all amounts with positions
      const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g
      const amountsWithPositions: { amount: string; position: number; rawValue: number }[] = []
      let match
      
      while ((match = amountPattern.exec(line)) !== null) {
        const rawValue = parseFloat(match[1].replace(/,/g, ''))
        amountsWithPositions.push({ 
          amount: match[1], 
          position: match.index || 0,
          rawValue
        })
      }
      
      if (amountsWithPositions.length < 2) continue
      
      // Get last 3 amounts
      const lastAmounts = amountsWithPositions.slice(-3)
      
      let debitAmount = 0
      let creditAmount = 0
      let detectedType = 'unknown'
      
      if (lastAmounts.length >= 3) {
        debitAmount = lastAmounts[0].rawValue
        creditAmount = lastAmounts[1].rawValue
        
        // Determine type
        if (creditAmount > 0 && debitAmount === 0) {
          detectedType = 'CREDIT (ingreso)'
          creditCount++
        } else if (debitAmount > 0 && creditAmount === 0) {
          detectedType = 'DEBIT (gasto)'
          debitCount++
        } else if (creditAmount > 0 && debitAmount > 0) {
          detectedType = 'BOTH - check description'
        }
      }
      
      transactionDetails.push({
        date: dateMatch[1],
        line: line.substring(0, 100),
        rawAmounts: lastAmounts.map(a => a.amount),
        debitValue: debitAmount,
        creditValue: creditAmount,
        balanceValue: lastAmounts[2]?.rawValue || 0,
        detectedType
      })
    }
    
    // Find credit transactions specifically
    const creditTransactions = transactionDetails.filter(t => t.detectedType === 'CREDIT (ingreso)')
    const debitTransactions = transactionDetails.filter(t => t.detectedType === 'DEBIT (gasto)')
    
    return NextResponse.json({
      success: true,
      summary: {
        total: transactionDetails.length,
        credits: creditCount,
        debits: debitCount
      },
      creditTransactions,
      debitTransactions: debitTransactions.slice(0, 10), // First 10 debits
      allTransactions: transactionDetails
    })
    
  } catch (error: any) {
    console.error('Debug BAC error:', error)
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
