import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { extractAllTransactions } from '@/lib/pdf-processor'
import { extractTextFromPDF } from '@/lib/pdf-extractor'
import { parseBCRText } from '@/lib/bcr-text-parser'

// Configure body size for file uploads
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds timeout for Netlify

export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting PDF Processing ===')

    const currentUser = await getCurrentUser()

    if (!currentUser) {
      console.log('Error: User not authenticated')
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    console.log('User authenticated:', currentUser.email, 'ID:', currentUser.id)

    // Parse form data
    let formData: FormData
    try {
      formData = await request.formData()
      console.log('Form data parsed successfully')
    } catch (formError: any) {
      console.error('Error parsing form data:', formError)
      return NextResponse.json({
        error: 'Error al procesar el archivo. El archivo puede ser demasiado grande.',
        details: formError.message
      }, { status: 400 })
    }

    const file = formData.get('file') as File
    const bankId = formData.get('bankId') as string

    console.log('File info:', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      bankId: bankId
    })

    if (!file) {
      console.log('Error: No file provided')
      return NextResponse.json({ error: 'Archivo PDF requerido' }, { status: 400 })
    }

    if (!bankId) {
      console.log('Error: No bankId provided')
      return NextResponse.json({ error: 'Banco requerido' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      console.log('Error: Invalid file type:', file.type)
      return NextResponse.json({ error: 'El archivo debe ser un PDF' }, { status: 400 })
    }

    // Verify bank exists
    const bank = await db.bank.findUnique({ where: { id: bankId } })
    if (!bank) {
      console.log('Error: Bank not found:', bankId)
      return NextResponse.json({ error: 'Banco no encontrado' }, { status: 404 })
    }

    console.log('Bank found:', bank.name)

    // Process PDF
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log('Buffer created, size:', buffer.length)

    let text: string = ''

    try {
      console.log('Attempting PDF text extraction...')
      text = await extractTextFromPDF(buffer)
      console.log('PDF text extraction successful, text length:', text.length)
    } catch (parseError: any) {
      console.error('PDF extraction failed:', parseError)
      return NextResponse.json({
        error: `No se pudo extraer texto del PDF. El archivo parece estar corrupto o no es legible.`,
        details: parseError.message
      }, { status: 400 })
    }

    if (!text || text.trim().length === 0) {
      console.log('Error: No text extracted from PDF')
      return NextResponse.json({
        error: 'El PDF no contiene texto extraíble. Puede ser un documento escaneado sin OCR.'
      }, { status: 400 })
    }

    console.log('PDF text extracted, length:', text.length)
    console.log('Text preview:', text.substring(0, 500))

    // Check if this is BCR format
    const upperText = text.toUpperCase()
    const isBCRFormat = upperText.includes('MONTO DÉBITO') || 
                        upperText.includes('MONTO DEBITO') || 
                        upperText.includes('MONTO CRÉDITO') || 
                        upperText.includes('MONTO CREDITO')

    let extractedData
    
    if (isBCRFormat) {
      console.log('Detected BCR format - using text-based analysis')
      
      // Use text-based BCR parser (no worker dependencies)
      const bcrResult = parseBCRText(text)
      
      // Convert to ExtractedData format
      extractedData = {
        credits: bcrResult.credits.map(t => ({
          date: t.date,
          amount: t.amount,
          description: t.description,
          month: `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`,
          type: 'credit' as const
        })),
        debits: bcrResult.debits.map(t => ({
          date: t.date,
          amount: t.amount,
          description: t.description,
          month: `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`,
          type: 'debit' as const
        })),
        totalCredits: bcrResult.totalCredits,
        totalDebits: bcrResult.totalDebits,
        netFlow: bcrResult.totalCredits - bcrResult.totalDebits
      }
      
      console.log('BCR text-based extraction complete:', {
        credits: extractedData.credits.length,
        debits: extractedData.debits.length,
        totalCredits: extractedData.totalCredits,
        totalDebits: extractedData.totalDebits
      })
      
    } else {
      // Extract ALL transactions (credits and debits) for non-BCR formats
      extractedData = extractAllTransactions(text)
    }
    
    const { credits, debits, totalCredits, totalDebits, netFlow } = extractedData

    console.log('Transactions extracted:', {
      credits: credits.length,
      debits: debits.length,
      totalCredits,
      totalDebits,
      netFlow
    })

    if (credits.length === 0 && debits.length === 0) {
      return NextResponse.json({
        error: 'No se detectaron transacciones en el documento. Asegúrese de que el estado de cuenta contenga transacciones con palabras clave como: N/C, N/D, DEPÓSITO, TRANSFERENCIA, COMPRA.',
        debug: {
          textLength: text.length,
          textPreview: text.substring(0, 500)
        }
      }, { status: 400 })
    }

    // Create bank statement record (no organizationId needed)
    const bankStatement = await db.bankStatement.create({
      data: {
        bankId,
      },
    })

    console.log('Bank statement created:', bankStatement.id)

    // Save ALL transactions to database using batch insert (more efficient for serverless)
    const allTransactions = [...credits, ...debits]
    
    // Use createMany for batch insert - much more efficient than individual creates
    const savedCount = await db.transaction.createMany({
      data: allTransactions.map(t => ({
        bankStatementId: bankStatement.id,
        userId: currentUser.id,  // Associate transaction with the user who uploaded it
        date: t.date,
        amount: t.amount,
        month: t.month,
        description: t.description || '',
        type: t.type,
      })),
    })

    console.log('Transactions saved:', savedCount.count)

    // Fetch the saved transactions for response
    const savedTransactions = await db.transaction.findMany({
      where: { bankStatementId: bankStatement.id },
      orderBy: { date: 'asc' },
    })

    // Calculate credit statistics
    const creditAmounts = credits.map(t => t.amount)
    const totalCreditAmount = creditAmounts.reduce((sum, a) => sum + a, 0)
    const averageCredit = creditAmounts.length > 0 ? totalCreditAmount / creditAmounts.length : 0
    const maxCredit = creditAmounts.length > 0 ? Math.max(...creditAmounts) : 0
    const minCredit = creditAmounts.length > 0 ? Math.min(...creditAmounts) : 0

    // Standard deviation for credits
    let stdDevCredit = 0
    if (creditAmounts.length > 0) {
      const squaredDiffs = creditAmounts.map(a => Math.pow(a - averageCredit, 2))
      const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / creditAmounts.length
      stdDevCredit = Math.sqrt(avgSquaredDiff)
    }

    // Stability index (coefficient of variation based)
    const coefficientOfVariation = averageCredit > 0 ? stdDevCredit / averageCredit : 0
    const stabilityIndex = Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100))

    // Calculate debit statistics
    const debitAmounts = debits.map(t => t.amount)
    const totalDebitAmount = debitAmounts.reduce((sum, a) => sum + a, 0)
    const averageDebit = debitAmounts.length > 0 ? totalDebitAmount / debitAmounts.length : 0
    const maxDebit = debitAmounts.length > 0 ? Math.max(...debitAmounts) : 0
    const minDebit = debitAmounts.length > 0 ? Math.min(...debitAmounts) : 0

    // Group credits by month
    const monthlyCredits = credits.reduce((acc, t) => {
      acc[t.month] = (acc[t.month] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

    // Group debits by month
    const monthlyDebits = debits.reduce((acc, t) => {
      acc[t.month] = (acc[t.month] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

    // Get all unique months
    const allMonths = [...new Set([...Object.keys(monthlyCredits), ...Object.keys(monthlyDebits)])].sort()

    // Calculate rentability/profitability metrics
    const savingsRate = totalCreditAmount > 0 ? ((totalCreditAmount - totalDebitAmount) / totalCreditAmount) * 100 : 0
    const expenseRatio = totalCreditAmount > 0 ? (totalDebitAmount / totalCreditAmount) * 100 : 0

    // Rentability score (0-100)
    let rentabilityScore = 50
    if (netFlow > 0) {
      rentabilityScore = Math.min(100, 50 + (savingsRate / 2))
    } else if (netFlow < 0) {
      rentabilityScore = Math.max(0, 50 + (savingsRate / 2))
    }

    console.log('Processing complete:', {
      creditCount: credits.length,
      debitCount: debits.length,
      totalCredits: totalCreditAmount,
      totalDebits: totalDebitAmount,
      netFlow,
    })

    return NextResponse.json({
      success: true,
      transactions: savedTransactions.map(t => ({
        id: t.id,
        date: t.date.toISOString(),
        amount: t.amount,
        month: t.month,
        description: t.description,
        type: t.type,
      })),
      credits: credits.map(t => ({
        date: t.date.toISOString(),
        amount: t.amount,
        month: t.month,
        description: t.description,
      })),
      debits: debits.map(t => ({
        date: t.date.toISOString(),
        amount: t.amount,
        month: t.month,
        description: t.description,
      })),
      statistics: {
        total: totalCreditAmount,
        average: averageCredit,
        max: maxCredit,
        min: minCredit,
        stdDev: stdDevCredit,
        stabilityIndex,
        transactionCount: credits.length,
      },
      debitStatistics: {
        total: totalDebitAmount,
        average: averageDebit,
        max: maxDebit,
        min: minDebit,
        transactionCount: debits.length,
      },
      rentability: {
        totalCredits: totalCreditAmount,
        totalDebits: totalDebitAmount,
        netFlow,
        savingsRate,
        expenseRatio,
        score: rentabilityScore,
      },
      monthlyTotals: allMonths.map(month => ({
        month,
        credits: monthlyCredits[month] || 0,
        debits: monthlyDebits[month] || 0,
        net: (monthlyCredits[month] || 0) - (monthlyDebits[month] || 0),
      })),
    })
  } catch (error: any) {
    console.error('Process PDF error:', error)
    return NextResponse.json({
      error: `Error al procesar el archivo PDF: ${error.message || 'Error desconocido'}`
    }, { status: 500 })
  }
}
