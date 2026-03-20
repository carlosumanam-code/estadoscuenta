import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPDF } from '@/lib/pdf-extractor'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Extract text from PDF using our configured extractor (worker disabled)
    const text = await extractTextFromPDF(buffer)
    
    // Show first 5000 characters of text
    const textPreview = text?.substring(0, 5000) || ''
    
    // Find transaction lines (lines with dates DD/MM/YY or DD/MM/YYYY)
    const lines = text?.split('\n') || []
    const transactionLines = lines.filter(line => 
      /^\s*\d{2}\/\d{2}\/\d{2}/.test(line) ||  // BCR format DD/MM/YY
      /^\s*\d{2}\/\d{2}\/\d{4}/.test(line) ||  // Other format DD/MM/YYYY
      /DEBITO|DÉBITO|CRÉDITO|CREDITO|BALANCE/i.test(line)
    ).slice(0, 50)
    
    // Also find lines with column headers
    const headerLines = lines.filter(line =>
      /MONTO\s*D[ÉE]BITO/i.test(line) ||
      /MONTO\s*CR[ÉE]DITO/i.test(line) ||
      /FECHA.*MOVIMIENTO/i.test(line)
    ).slice(0, 10)
    
    return NextResponse.json({
      success: true,
      textLength: text?.length || 0,
      textPreview,
      headerLines,
      transactionLines
    })
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 })
  }
}
