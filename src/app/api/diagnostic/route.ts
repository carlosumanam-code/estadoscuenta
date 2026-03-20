import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bankId = searchParams.get('bankId')

  const result: any = {
    timestamp: new Date().toISOString(),
    checks: {}
  }

  // Check 1: Database connection
  try {
    const userCount = await db.user.count()
    const bankCount = await db.bank.count()
    result.checks.database = {
      success: true,
      users: userCount,
      banks: bankCount
    }
  } catch (e: any) {
    result.checks.database = {
      success: false,
      error: e.message
    }
    return NextResponse.json(result, { status: 500 })
  }

  // Check 2: List all banks
  try {
    const banks = await db.bank.findMany({
      select: { id: true, name: true }
    })
    result.checks.banks = {
      success: true,
      list: banks
    }
  } catch (e: any) {
    result.checks.banks = {
      success: false,
      error: e.message
    }
  }

  // Check 3: Find specific bank
  if (bankId) {
    try {
      const bank = await db.bank.findUnique({
        where: { id: bankId }
      })
      result.checks.specificBank = {
        success: true,
        found: !!bank,
        bank: bank || null
      }
    } catch (e: any) {
      result.checks.specificBank = {
        success: false,
        error: e.message
      }
    }
  }

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const result: any = {
    timestamp: new Date().toISOString(),
    steps: []
  }

  try {
    // Step 1: Parse form data
    result.steps.push({ step: 'Parse form data', status: 'starting' })
    const formData = await request.formData()
    result.steps[0].status = 'success'

    // Step 2: Get values
    result.steps.push({ step: 'Get values', status: 'starting' })
    const file = formData.get('file') as File
    const bankId = formData.get('bankId') as string
    result.steps[1].status = 'success'
    result.steps[1].file = file ? { name: file.name, size: file.size } : null
    result.steps[1].bankId = bankId

    // Step 3: Check if bankId is valid
    result.steps.push({ step: 'Check bankId format', status: 'starting' })
    if (!bankId || typeof bankId !== 'string') {
      result.steps[2].status = 'failed'
      result.steps[2].error = 'bankId is missing or invalid'
      return NextResponse.json(result, { status: 400 })
    }
    result.steps[2].status = 'success'
    result.steps[2].bankIdType = typeof bankId
    result.steps[2].bankIdLength = bankId.length

    // Step 4: Query database for bank
    result.steps.push({ step: 'Query bank from database', status: 'starting' })
    try {
      const bank = await db.bank.findUnique({
        where: { id: bankId }
      })
      result.steps[3].status = 'success'
      result.steps[3].bankFound = !!bank
      result.steps[3].bank = bank
    } catch (e: any) {
      result.steps[3].status = 'failed'
      result.steps[3].error = e.message
      result.steps[3].errorCode = e.code
    }

    return NextResponse.json(result)

  } catch (e: any) {
    result.error = e.message
    return NextResponse.json(result, { status: 500 })
  }
}
