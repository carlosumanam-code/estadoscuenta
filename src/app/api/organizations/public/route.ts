import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Public endpoint - no authentication required
export async function GET() {
  try {
    console.log('=== Fetching public organizations ===')
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
    console.log('NODE_ENV:', process.env.NODE_ENV)
    
    // Test database connection first
    await db.$queryRaw`SELECT 1`
    console.log('Database connection: OK')
    
    const organizations = await db.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    console.log('Organizations found:', organizations.length)
    return NextResponse.json({ organizations })
  } catch (error: any) {
    console.error('=== Get public organizations error ===')
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    return NextResponse.json({ 
      error: 'Error al obtener organizaciones',
      details: error.message,
      code: error.code,
      hasDbUrl: !!process.env.DATABASE_URL,
    }, { status: 500 })
  }
}
