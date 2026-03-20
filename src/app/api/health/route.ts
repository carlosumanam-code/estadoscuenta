import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Intentar conectar a la base de datos
    await db.$queryRaw`SELECT 1`
    
    // Contar usuarios
    const userCount = await db.user.count()
    
    // Contar bancos
    const bankCount = await db.bank.count()
    
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      userCount,
      bankCount,
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    })
  } catch (error: any) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    }, { status: 500 })
  }
}
