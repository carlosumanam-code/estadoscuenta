import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Test database connection
    const userCount = await db.user.count()
    const bankCount = await db.bank.count()

    return NextResponse.json({
      success: true,
      message: 'Database connection OK',
      stats: {
        users: userCount,
        banks: bankCount,
      }
    })
  } catch (error: any) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
