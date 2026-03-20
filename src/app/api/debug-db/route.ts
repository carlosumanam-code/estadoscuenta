import { NextResponse } from 'next/server'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {}
  }

  // Check 1: DATABASE_URL exists
  results.checks.databaseUrl = {
    exists: !!process.env.DATABASE_URL,
    pattern: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.substring(0, 50) + '...'
      : 'NOT SET'
  }

  // Check 2: Can import Prisma client
  try {
    const { db } = await import('@/lib/db')
    results.checks.prismaImport = { success: true }
  } catch (error: any) {
    results.checks.prismaImport = {
      success: false,
      error: error.message
    }
    return NextResponse.json(results, { status: 500 })
  }

  // Check 3: Database connection and table structure
  try {
    const { db } = await import('@/lib/db')

    // Test simple query
    const orgCount = await db.organization.count()
    const userCount = await db.user.count()
    const bankCount = await db.bank.count()
    const bankStatementCount = await db.bankStatement.count()
    const transactionCount = await db.transaction.count()

    results.checks.databaseConnection = {
      success: true,
      counts: {
        organizations: orgCount,
        users: userCount,
        banks: bankCount,
        bankStatements: bankStatementCount,
        transactions: transactionCount
      }
    }
  } catch (error: any) {
    results.checks.databaseConnection = {
      success: false,
      error: error.message,
      code: error.code
    }
    return NextResponse.json(results, { status: 500 })
  }

  // Check 4: Sample data
  try {
    const { db } = await import('@/lib/db')

    const orgs = await db.organization.findMany({
      take: 5,
      include: { _count: { select: { users: true } } }
    })

    results.checks.sampleData = {
      success: true,
      organizations: orgs.map(o => ({
        id: o.id,
        name: o.name,
        userCount: o._count.users
      }))
    }
  } catch (error: any) {
    results.checks.sampleData = {
      success: false,
      error: error.message
    }
  }

  // Check 5: Transaction has userId column
  try {
    const { db } = await import('@/lib/db')

    const transaction = await db.transaction.findFirst({
      include: { user: { select: { id: true, email: true } } }
    })

    results.checks.transactionUserRelation = {
      success: true,
      sample: transaction ? {
        id: transaction.id,
        userId: transaction.userId,
        userEmail: transaction.user?.email
      } : null
    }
  } catch (error: any) {
    results.checks.transactionUserRelation = {
      success: false,
      error: error.message,
      code: error.code
    }
  }

  return NextResponse.json(results)
}
