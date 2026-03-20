import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    console.log('=== DEBUG PDF EXTRACTION ===')
    
    const contentType = request.headers.get('content-type') || ''
    console.log('Content-Type:', contentType)
    
    let buffer: Buffer
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      
      const anyFile = file as any
      console.log('File type:', typeof file)
      console.log('File constructor:', anyFile?.constructor?.name)
      console.log('File methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(anyFile)))
      console.log('File size:', anyFile.size)
      console.log('File name:', anyFile.name)
      
      // Try different methods to get buffer
      if (typeof anyFile.arrayBuffer === 'function') {
        console.log('Using arrayBuffer()')
        const bytes = await anyFile.arrayBuffer()
        buffer = Buffer.from(bytes)
      } else if (typeof anyFile.stream === 'function') {
        console.log('Using stream()')
        const stream = anyFile.stream()
        const chunks: Uint8Array[] = []
        const reader = stream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }
        buffer = Buffer.concat(chunks)
      } else if (anyFile instanceof Blob) {
        console.log('File is Blob')
        const bytes = await (anyFile as Blob).arrayBuffer()
        buffer = Buffer.from(bytes)
      } else if (Buffer.isBuffer(file)) {
        console.log('File is already a Buffer')
        buffer = file
      } else {
        // Try to get buffer from internal _buffer or data property
        if (anyFile._buffer) {
          console.log('Using _buffer')
          buffer = Buffer.from(anyFile._buffer)
        } else if (anyFile.data) {
          console.log('Using data')
          buffer = Buffer.from(anyFile.data)
        } else {
          return NextResponse.json({ 
            error: 'Cannot process file - no compatible method found',
            fileType: typeof file,
            fileConstructor: anyFile?.constructor?.name,
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(anyFile))
          }, { status: 500 })
        }
      }
    } else {
      // Raw binary
      const bytes = await request.arrayBuffer()
      buffer = Buffer.from(bytes)
    }
    
    console.log('Buffer size:', buffer.length)
    console.log('First 20 bytes (hex):', buffer.slice(0, 20).toString('hex'))
    
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

    // Extract text
    console.log('Attempting pdf-parse...')
    
    let data
    try {
      data = await pdfParse(buffer, { max: 0 })
      console.log('pdf-parse success')
    } catch (parseError: any) {
      console.error('pdf-parse error:', parseError.message)
      return NextResponse.json({ 
        error: 'pdf-parse failed: ' + parseError.message,
        bufferSize: buffer.length
      }, { status: 500 })
    }
    
    console.log('Pages:', data.numpages)
    console.log('Text length:', data.text?.length || 0)
    
    const textPreview = data.text?.substring(0, 3000) || ''
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
