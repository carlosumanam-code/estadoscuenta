import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    console.log('=== Debug Banks Endpoint ===')

    // Get all banks
    const banks = await db.bank.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' }
    })

    console.log('Banks found:', banks.length)

    return NextResponse.json({
      success: true,
      count: banks.length,
      banks,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Debug banks error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
