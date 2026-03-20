import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    console.log('=== DEBUG PDF EXTRACTION ===')
    
    const contentType = request.headers.get('content-type') || ''
    console.log('Content-Type:', contentType)
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }
    
    const formData = await request.formData()
    const file = formData.get('file')
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    const anyFile = file as any
    console.log('File constructor:', anyFile?.constructor?.name)
    console.log('File size:', anyFile.size)
    console.log('File name:', anyFile.name)
    
    // Get buffer
    let buffer: Buffer
    
    if (typeof anyFile.arrayBuffer === 'function') {
      console.log('Using arrayBuffer()')
      const bytes = await anyFile.arrayBuffer()
      buffer = Buffer.from(bytes)
    } else if (anyFile instanceof Blob) {
      console.log('File is Blob')
      const bytes = await (anyFile as Blob).arrayBuffer()
      buffer = Buffer.from(bytes)
    } else {
      return NextResponse.json({ 
        error: 'Cannot process file',
        fileType: anyFile?.constructor?.name
      }, { status: 500 })
    }
    
    console.log('Buffer size:', buffer.length)
    
    // Check PDF header
    const header = buffer.slice(0, 4).toString()
    console.log('File header:', header)
    
    if (header !== '%PDF') {
      return NextResponse.json({ 
        error: 'File is not a valid PDF',
        header: header,
        bufferSize: buffer.length
      }, { status: 400 })
    }

    // Try pdf-parse
    console.log('Importing pdf-parse...')
    
    let pdfParse: any
    try {
      // Dynamic import to avoid issues
      const module = await import('pdf-parse')
      pdfParse = module.default || module
      console.log('pdf-parse imported successfully')
    } catch (importError: any) {
      console.error('Failed to import pdf-parse:', importError.message)
      return NextResponse.json({ 
        error: 'Failed to import pdf-parse: ' + importError.message,
        stack: importError.stack
      }, { status: 500 })
    }

    console.log('Calling pdf-parse...')
    
    let data
    try {
      data = await pdfParse(buffer)
      console.log('pdf-parse success')
    } catch (parseError: any) {
      console.error('pdf-parse error:', parseError.message)
      return NextResponse.json({ 
        error: 'pdf-parse failed: ' + parseError.message,
        stack: parseError.stack,
        bufferSize: buffer.length
      }, { status: 500 })
    }
    
    console.log('Pages:', data.numpages)
    console.log('Text length:', data.text?.length || 0)
    
    const textPreview = data.text?.substring(0, 2000) || ''
    const lines = data.text?.split('\n') || []
    
    return NextResponse.json({
      success: true,
      pages: data.numpages,
      textLength: data.text?.length || 0,
      textPreview,
      totalLines: lines.length,
      firstLines: lines.slice(0, 20)
    })
    
  } catch (error: any) {
    console.error('Debug PDF error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack,
      name: error.name
    }, { status: 500 })
  }
}
