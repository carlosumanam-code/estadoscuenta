import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('=== DEBUG PDF EXTRACTION ===')
    console.log('File name:', file.name)
    console.log('File type:', file.type)
    console.log('File size:', file.size)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    console.log('Buffer size:', buffer.length)
    console.log('First 20 bytes (hex):', buffer.slice(0, 20).toString('hex'))
    
    // Check if it's actually a PDF (should start with %PDF)
    const header = buffer.slice(0, 4).toString()
    console.log('File header:', header)
    
    if (header !== '%PDF') {
      return NextResponse.json({ 
        error: 'File is not a valid PDF',
        header: header,
        bufferSize: buffer.length
      }, { status: 400 })
    }

    // Try extraction with minimal options
    console.log('Attempting pdf-parse...')
    
    let data
    try {
      data = await pdfParse(buffer, { max: 0 })
      console.log('pdf-parse success')
    } catch (parseError: any) {
      console.error('pdf-parse error:', parseError.message)
      console.error('pdf-parse stack:', parseError.stack)
      return NextResponse.json({ 
        error: 'pdf-parse failed: ' + parseError.message,
        stack: parseError.stack,
        bufferSize: buffer.length,
        header: header
      }, { status: 500 })
    }
    
    console.log('Pages:', data.numpages)
    console.log('Info:', data.info)
    console.log('Text length:', data.text?.length || 0)
    
    // Show first 3000 characters of text
    const textPreview = data.text?.substring(0, 3000) || ''
    
    // Find transaction lines
    const lines = data.text?.split('\n') || []
    const transactionLines = lines.filter(line => 
      /^\s*\d{2}\/\d{2}\/\d{2}/.test(line) ||
      /^\s*\d{2}\/\d{2}\/\d{4}/.test(line) ||
      /DEBITO|DÉBITO|CRÉDITO|CREDITO|BALANCE|MONTO/i.test(line)
    ).slice(0, 50)
    
    return NextResponse.json({
      success: true,
      pages: data.numpages,
      textLength: data.text?.length || 0,
      info: data.info,
      textPreview,
      transactionLines,
      totalLines: lines.length
    })
    
  } catch (error: any) {
    console.error('Debug PDF error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
