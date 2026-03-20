import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPDF } from '@/lib/pdf-extractor'

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
    
    const lines = text.split('\n').filter(l => l.trim())
    
    return NextResponse.json({
      success: true,
      textLength: text.length,
      lineCount: lines.length,
      textPreview: text.substring(0, 3000),
      firstLines: lines.slice(0, 30)
    })
    
  } catch (error: any) {
    console.error('Debug PDF error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
