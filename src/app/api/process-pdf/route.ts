import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { extractAllTransactions, ExtractedTransaction } from '@/lib/pdf-processor'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, writeFile as writeFileFs } from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

// Function to extract text using OCR (for scanned PDFs)
async function extractTextWithOCR(pdfPath: string): Promise<string> {
  const pythonScript = `
from pdf2image import convert_from_path
import pytesseract
import sys

try:
    images = convert_from_path("${pdfPath}", dpi=200)
    all_text = []
    for i, img in enumerate(images):
        text = pytesseract.image_to_string(img)
        if text.strip():
            all_text.append(text)
    print("\\n---PAGE_BREAK---\\n".join(all_text))
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`

  const tempScriptPath = path.join(os.tmpdir(), `ocr-${Date.now()}.py`)
  await writeFileFs(tempScriptPath, pythonScript)
  
  try {
    const { stdout, stderr } = await execAsync(`python3 "${tempScriptPath}"`, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000 // 5 minutes timeout for OCR
    })
    
    if (stderr && stderr.includes('ERROR:')) {
      throw new Error(stderr)
    }
    
    return stdout || ''
  } finally {
    try {
      await unlink(tempScriptPath)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

export async function POST(request: NextRequest) {
  const tempFilePaths: string[] = []
  
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const bankId = formData.get('bankId') as string

    if (!file) {
      return NextResponse.json({ error: 'Archivo PDF requerido' }, { status: 400 })
    }

    if (!bankId) {
      return NextResponse.json({ error: 'Banco requerido' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'El archivo debe ser un PDF' }, { status: 400 })
    }

    // Verify bank access
    const bank = await db.bank.findUnique({ where: { id: bankId } })
    if (!bank) {
      return NextResponse.json({ error: 'Banco no encontrado' }, { status: 404 })
    }

    if (currentUser.role !== 'admin' && bank.organizationId !== currentUser.organizationId) {
      return NextResponse.json({ error: 'Acceso denegado al banco seleccionado' }, { status: 403 })
    }

    // Process PDF using pdftotext command line tool
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Create temp files
    const tempDir = os.tmpdir()
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    const tempPdfPath = path.join(tempDir, `upload-${uniqueId}.pdf`)
    tempFilePaths.push(tempPdfPath)
    
    await writeFile(tempPdfPath, buffer)

    let text: string = ''
    let usedOCR = false
    
    // First try: pdftotext (fast, works for normal PDFs)
    try {
      console.log('Attempting pdftotext extraction...')
      const { stdout, stderr } = await execAsync(`pdftotext -layout "${tempPdfPath}" - 2>/dev/null`, {
        maxBuffer: 50 * 1024 * 1024
      })
      text = stdout || ''
      
      // Check if meaningful text was extracted
      if (text.trim().length > 100 && !text.includes('Syntax Error')) {
        console.log('pdftotext extraction successful')
      } else {
        text = '' // Reset if mostly errors or empty
      }
    } catch (cmdError: any) {
      console.log('pdftotext failed:', cmdError.message)
      text = ''
    }

    // Second try: OCR (slower, works for scanned PDFs)
    if (!text || text.trim().length < 100) {
      console.log('Attempting OCR extraction for scanned PDF...')
      try {
        text = await extractTextWithOCR(tempPdfPath)
        usedOCR = true
        console.log('OCR extraction successful, text length:', text.length)
      } catch (ocrError: any) {
        console.error('OCR extraction failed:', ocrError)
        return NextResponse.json({ 
          error: `No se pudo extraer texto del PDF. El archivo parece estar corrupto o no es legible. Intente con otro archivo PDF.`,
          details: ocrError.message
        }, { status: 400 })
      }
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ 
        error: 'El PDF no contiene texto extraíble. Puede ser un documento escaneado sin OCR o estar corrupto.' 
      }, { status: 400 })
    }

    console.log('PDF text extracted, length:', text.length, 'Method:', usedOCR ? 'OCR' : 'pdftotext')
    console.log('Text preview:', text.substring(0, 500))

    // Extract ALL transactions (credits and debits)
    const extractedData = extractAllTransactions(text)
    const { credits, debits, totalCredits, totalDebits, netFlow } = extractedData

    if (credits.length === 0 && debits.length === 0) {
      return NextResponse.json({ 
        error: 'No se detectaron transacciones en el documento. Asegúrese de que el estado de cuenta contenga transacciones con palabras clave como: N/C, N/D, DEPÓSITO, TRANSFERENCIA, COMPRA.',
        debug: {
          textLength: text.length,
          textPreview: text.substring(0, 500)
        }
      }, { status: 400 })
    }

    // Create bank statement record
    const bankStatement = await db.bankStatement.create({
      data: {
        bankId,
        organizationId: currentUser.organizationId,
      },
    })

    // Save ALL transactions to database (credits and debits)
    const allTransactions = [...credits, ...debits]
    const savedTransactions = await Promise.all(
      allTransactions.map(t => 
        db.transaction.create({
          data: {
            bankStatementId: bankStatement.id,
            date: t.date,
            amount: t.amount,
            month: t.month,
            description: t.description || '',
            type: t.type,
          },
        })
      )
    )

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
    // Higher score = more financially stable
    let rentabilityScore = 50 // Base score
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
  } finally {
    // Clean up temp files
    for (const tempPath of tempFilePaths) {
      try {
        await unlink(tempPath)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}
