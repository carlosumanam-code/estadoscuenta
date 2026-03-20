import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPDF } from '@/lib/pdf-extractor'
import { parseBCRText } from '@/lib/bcr-text-parser'
import { extractAllTransactions } from '@/lib/pdf-processor'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    console.log('=== DEBUG PDF EXTRACTION ===')
    
    const formData = await request.formData()
    const file = formData.get('file')
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    const anyFile = file as any
    console.log('File size:', anyFile.size)
    console.log('File name:', anyFile.name)
    
    // Get buffer
    let buffer: Buffer
    
    if (typeof anyFile.arrayBuffer === 'function') {
      const bytes = await anyFile.arrayBuffer()
      buffer = Buffer.from(bytes)
    } else if (anyFile instanceof Blob) {
      const bytes = await (anyFile as Blob).arrayBuffer()
      buffer = Buffer.from(bytes)
    } else {
      return NextResponse.json({ error: 'Cannot process file' }, { status: 500 })
    }
    
    console.log('Buffer size:', buffer.length)
    
    // Check PDF header
    const header = buffer.slice(0, 4).toString()
    if (header !== '%PDF') {
      return NextResponse.json({ error: 'Not a PDF', header }, { status: 400 })
    }

    // Extract text using our simple parser
    const text = await extractTextFromPDF(buffer)
    
    // Check if BCR or BAC format
    const upperText = text.toUpperCase()
    const isBCRFormat = upperText.includes('MONTO DÉBITO') || 
                        upperText.includes('MONTO DEBITO') || 
                        upperText.includes('MONTO CRÉDITO') || 
                        upperText.includes('MONTO CREDITO')
    const isBACFormat = (upperText.includes('DEBITO') || upperText.includes('DÉBITO')) && 
                        (upperText.includes('CRÉDITO') || upperText.includes('CREDITO')) && 
                        upperText.includes('BALANCE')
    
    let result: any = {
      success: true,
      textLength: text.length,
      isBCRFormat,
      isBACFormat,
      // Show first 100 lines to understand the structure
      textPreview: text.split('\n').slice(0, 100).join('\n'),
      // Show lines that look like transactions (start with date)
      dateLines: text.split('\n').filter(line => /^\d{2}\/\d{2}\/\d{4}/.test(line.trim())).slice(0, 20)
    }
    
    // Try parsing based on format
    if (isBCRFormat) {
      const bcrResult = parseBCRText(text)
      result.bcr = {
        credits: bcrResult.credits.length,
        debits: bcrResult.debits.length,
        totalCredits: bcrResult.totalCredits,
        totalDebits: bcrResult.totalDebits,
        sampleCredits: bcrResult.credits.slice(0, 5).map(t => ({
          date: t.date.toISOString().split('T')[0],
          amount: t.amount,
          description: t.description.substring(0, 60)
        }))
      }
    } else {
      const parsed = extractAllTransactions(text)
      result.parsed = {
        credits: parsed.credits.length,
        debits: parsed.debits.length,
        totalCredits: parsed.totalCredits,
        totalDebits: parsed.totalDebits,
        sampleCredits: parsed.credits.slice(0, 5).map(t => ({
          date: t.date.toISOString().split('T')[0],
          amount: t.amount,
          description: t.description.substring(0, 60)
        })),
        sampleDebits: parsed.debits.slice(0, 5).map(t => ({
          date: t.date.toISOString().split('T')[0],
          amount: t.amount,
          description: t.description.substring(0, 60)
        }))
      }
    }
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Debug PDF error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
