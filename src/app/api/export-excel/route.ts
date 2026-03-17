import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { transactionIds, bankStatementId } = await request.json()

    if (!transactionIds && !bankStatementId) {
      return NextResponse.json({ error: 'Se requieren IDs de transacciones o estado de cuenta' }, { status: 400 })
    }

    let transactions

    if (bankStatementId) {
      transactions = await db.transaction.findMany({
        where: { bankStatementId },
        orderBy: { date: 'asc' },
      })
    } else {
      transactions = await db.transaction.findMany({
        where: { id: { in: transactionIds } },
        orderBy: { date: 'asc' },
      })
    }

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No hay transacciones para exportar' }, { status: 400 })
    }

    // Separate credits and debits
    const credits = transactions.filter(t => t.type === 'credit')
    const debits = transactions.filter(t => t.type === 'debit')

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // === SHEET 1: INGRESOS (CRÉDITOS) ===
    if (credits.length > 0) {
      const creditsData = credits.map(t => ({
        'Fecha': t.date.toLocaleDateString('es-CR'),
        'Monto (₡)': t.amount,
        'Mes': t.month,
        'Descripción': t.description || '',
      }))

      const creditsSheet = XLSX.utils.json_to_sheet(creditsData)
      creditsSheet['!cols'] = [
        { wch: 12 },  // Fecha
        { wch: 18 },  // Monto
        { wch: 10 },  // Mes
        { wch: 50 },  // Descripción
      ]

      // Add totals row
      const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
      XLSX.utils.sheet_add_json(creditsSheet, [
        { 'Fecha': '', 'Monto (₡)': '', 'Mes': '', 'Descripción': '' },
        { 'Fecha': 'TOTAL', 'Monto (₡)': totalCredits, 'Mes': '', 'Descripción': `${credits.length} transacciones` }
      ], { origin: -1, skipHeader: true })

      XLSX.utils.book_append_sheet(workbook, creditsSheet, 'Ingresos')
    }

    // === SHEET 2: EGRESOS (DÉBITOS) ===
    if (debits.length > 0) {
      const debitsData = debits.map(t => ({
        'Fecha': t.date.toLocaleDateString('es-CR'),
        'Monto (₡)': t.amount,
        'Mes': t.month,
        'Descripción': t.description || '',
      }))

      const debitsSheet = XLSX.utils.json_to_sheet(debitsData)
      debitsSheet['!cols'] = [
        { wch: 12 },  // Fecha
        { wch: 18 },  // Monto
        { wch: 10 },  // Mes
        { wch: 50 },  // Descripción
      ]

      // Add totals row
      const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
      XLSX.utils.sheet_add_json(debitsSheet, [
        { 'Fecha': '', 'Monto (₡)': '', 'Mes': '', 'Descripción': '' },
        { 'Fecha': 'TOTAL', 'Monto (₡)': totalDebits, 'Mes': '', 'Descripción': `${debits.length} transacciones` }
      ], { origin: -1, skipHeader: true })

      XLSX.utils.book_append_sheet(workbook, debitsSheet, 'Egresos')
    }

    // === SHEET 3: RESUMEN ===
    const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0)
    const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0)
    const netFlow = totalCredits - totalDebits
    const savingsRate = totalCredits > 0 ? ((totalCredits - totalDebits) / totalCredits) * 100 : 0
    
    // Calculate credit statistics
    const creditAmounts = credits.map(t => t.amount)
    const avgCredit = creditAmounts.length > 0 ? totalCredits / creditAmounts.length : 0
    const maxCredit = creditAmounts.length > 0 ? Math.max(...creditAmounts) : 0
    const minCredit = creditAmounts.length > 0 ? Math.min(...creditAmounts) : 0

    // Calculate debit statistics
    const debitAmounts = debits.map(t => t.amount)
    const avgDebit = debitAmounts.length > 0 ? totalDebits / debitAmounts.length : 0
    const maxDebit = debitAmounts.length > 0 ? Math.max(...debitAmounts) : 0
    const minDebit = debitAmounts.length > 0 ? Math.min(...debitAmounts) : 0

    const summaryData = [
      { 'Concepto': '══════ INGRESOS ══════', 'Valor': '' },
      { 'Concepto': 'Total de Ingresos', 'Valor': `₡${totalCredits.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Promedio por Transacción', 'Valor': `₡${avgCredit.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Ingreso Mayor', 'Valor': `₡${maxCredit.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Ingreso Menor', 'Valor': `₡${minCredit.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Número de Ingresos', 'Valor': credits.length },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': '══════ EGRESOS ══════', 'Valor': '' },
      { 'Concepto': 'Total de Egresos', 'Valor': `₡${totalDebits.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Promedio por Transacción', 'Valor': `₡${avgDebit.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Egreso Mayor', 'Valor': `₡${maxDebit.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Egreso Menor', 'Valor': `₡${minDebit.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Número de Egresos', 'Valor': debits.length },
      { 'Concepto': '', 'Valor': '' },
      { 'Concepto': '══════ ANÁLISIS DE RENTABILIDAD ══════', 'Valor': '' },
      { 'Concepto': 'Flujo Neto', 'Valor': `₡${netFlow.toLocaleString('es-CR', { minimumFractionDigits: 2 })}` },
      { 'Concepto': 'Tasa de Ahorro', 'Valor': `${savingsRate.toFixed(2)}%` },
      { 'Concepto': 'Ratio de Gastos', 'Valor': totalCredits > 0 ? `${((totalDebits / totalCredits) * 100).toFixed(2)}%` : 'N/A' },
      { 'Concepto': 'Índice de Rentabilidad', 'Valor': netFlow >= 0 ? 'POSITIVO ✓' : 'NEGATIVO ⚠' },
    ]

    const summarySheet = XLSX.utils.json_to_sheet(summaryData)
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 25 }]
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen')

    // === SHEET 4: MENSUAL ===
    const monthlyData: Record<string, { credits: number; debits: number; net: number }> = {}
    
    credits.forEach(t => {
      if (!monthlyData[t.month]) monthlyData[t.month] = { credits: 0, debits: 0, net: 0 }
      monthlyData[t.month].credits += t.amount
      monthlyData[t.month].net += t.amount
    })
    
    debits.forEach(t => {
      if (!monthlyData[t.month]) monthlyData[t.month] = { credits: 0, debits: 0, net: 0 }
      monthlyData[t.month].debits += t.amount
      monthlyData[t.month].net -= t.amount
    })

    const monthlySheetData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        'Mes': month,
        'Ingresos (₡)': data.credits,
        'Egresos (₡)': data.debits,
        'Neto (₡)': data.net,
      }))

    if (monthlySheetData.length > 0) {
      const monthlySheet = XLSX.utils.json_to_sheet(monthlySheetData)
      monthlySheet['!cols'] = [
        { wch: 10 },  // Mes
        { wch: 18 },  // Ingresos
        { wch: 18 },  // Egresos
        { wch: 18 },  // Neto
      ]
      XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Mensual')
    }

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="analisis_financiero_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export Excel error:', error)
    return NextResponse.json({ error: 'Error al exportar Excel' }, { status: 500 })
  }
}
