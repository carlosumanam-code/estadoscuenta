import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { transactions, clientInfo, bankName } = await request.json()

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ error: 'No hay transacciones para exportar' }, { status: 400 })
    }

    // Separate credits and debits
    const credits = transactions.filter((t: any) => t.type === 'credit')
    const debits = transactions.filter((t: any) => t.type === 'debit')

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // === HOJA RESUMEN (siguiendo la plantilla) ===
    const resumenData: any[][] = []
    
    // Encabezado
    resumenData.push(['Fundación Costa Rica Canadá', '', '', '', '', ''])
    resumenData.push(['Análisis estados financieros bancarios', '', '', '', '', ''])
    resumenData.push(['', '', '', '', '', ''])
    
    // Datos del cliente
    resumenData.push(['Cliente:', clientInfo?.clientName || '', '', '', '', ''])
    resumenData.push(['Entidad Bancaria:', bankName || '', '', '', '', ''])
    resumenData.push(['Fecha estados de cuenta:', new Date().toLocaleDateString('es-CR'), '', '', '', ''])
    resumenData.push(['Actividad económica:', clientInfo?.activity || '', '', '', '', ''])
    resumenData.push(['', '', '', '', '', ''])
    
    // Sección Revisión Análisis vs Constancia de ingresos
    resumenData.push(['Revisión Análisis', '', '', 'Constancia de ingresos', '', 'Diferencia'])
    resumenData.push(['Mes', 'Ingresos', '', 'Mes', 'Ingresos', ''])
    
    // Group credits by month
    const monthlyCredits: Record<string, number> = {}
    credits.forEach((t: any) => {
      if (!monthlyCredits[t.month]) monthlyCredits[t.month] = 0
      monthlyCredits[t.month] += t.amount
    })
    
    // Sort months by year-month
    const sortedMonths = Object.keys(monthlyCredits).sort((a, b) => a.localeCompare(b))
    
    // Add monthly data
    sortedMonths.forEach((month) => {
      resumenData.push([month, monthlyCredits[month], '', month, monthlyCredits[month], 0])
    })
    
    // Add empty rows
    resumenData.push(['', '', '', '', '', ''])
    
    // Totals
    const totalCredits = credits.reduce((sum: number, t: any) => sum + t.amount, 0)
    const totalDebits = debits.reduce((sum: number, t: any) => sum + t.amount, 0)
    const avgMonthly = sortedMonths.length > 0 ? totalCredits / sortedMonths.length : 0
    
    resumenData.push(['Total', totalCredits, '', 'Total', totalCredits, 0])
    resumenData.push(['Promedio Mensual', avgMonthly, '', 'Promedio Mensual', totalCredits, 0])
    resumenData.push(['', '', '', '', '', ''])
    resumenData.push(['', '', '', '', '', ''])
    
    // Financial summary
    resumenData.push(['Ingresos brutos', totalCredits, '', '', '', ''])
    resumenData.push(['Gastos', totalDebits, '', '', '', ''])
    resumenData.push(['Ingresos netos', totalCredits - totalDebits, '', '', '', ''])
    resumenData.push(['', '', '', '', '', ''])
    
    // Statistics
    resumenData.push(['ESTADÍSTICAS', '', '', '', '', ''])
    resumenData.push(['Total Ingresos', `₡${totalCredits.toLocaleString('es-CR', {minimumFractionDigits: 2})}`, '', '', '', ''])
    resumenData.push(['Total Egresos', `₡${totalDebits.toLocaleString('es-CR', {minimumFractionDigits: 2})}`, '', '', '', ''])
    resumenData.push(['Flujo Neto', `₡${(totalCredits - totalDebits).toLocaleString('es-CR', {minimumFractionDigits: 2})}`, '', '', '', ''])
    
    if (credits.length > 0) {
      const amounts = credits.map((t: any) => t.amount)
      resumenData.push(['Ingreso Promedio', `₡${(totalCredits / credits.length).toLocaleString('es-CR', {minimumFractionDigits: 2})}`, '', '', '', ''])
      resumenData.push(['Ingreso Mayor', `₡${Math.max(...amounts).toLocaleString('es-CR', {minimumFractionDigits: 2})}`, '', '', '', ''])
      resumenData.push(['Ingreso Menor', `₡${Math.min(...amounts).toLocaleString('es-CR', {minimumFractionDigits: 2})}`, '', '', '', ''])
    }
    
    resumenData.push(['Número de Ingresos', credits.length, '', '', '', ''])
    resumenData.push(['Número de Egresos', debits.length, '', '', '', ''])
    
    // Create resumen sheet
    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData)
    resumenSheet['!cols'] = [
      { wch: 20 },  // A
      { wch: 18 },  // B
      { wch: 5 },   // C
      { wch: 20 },  // D
      { wch: 18 },  // E
      { wch: 15 },  // F
    ]
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen')

    // === HOJA DETALLE INGRESOS ===
    if (credits.length > 0) {
      // Group by month
      const creditsByMonth: Record<string, any[]> = {}
      credits.forEach((t: any) => {
        if (!creditsByMonth[t.month]) creditsByMonth[t.month] = []
        creditsByMonth[t.month].push(t)
      })
      
      const detailData: any[][] = []
      detailData.push(['DETALLE DE INGRESOS POR MES', '', '', ''])
      detailData.push(['', '', '', ''])
      
      Object.keys(creditsByMonth).sort().forEach(month => {
        detailData.push([`Mes: ${month}`, '', '', ''])
        detailData.push(['Fecha', 'Monto (₡)', 'Descripción', 'Banco'])
        
        creditsByMonth[month].forEach((t: any) => {
          detailData.push([
            new Date(t.date).toLocaleDateString('es-CR'),
            t.amount,
            t.description || '',
            bankName || ''
          ])
        })
        
        const monthTotal = creditsByMonth[month].reduce((sum: number, t: any) => sum + t.amount, 0)
        detailData.push(['Subtotal', monthTotal, '', ''])
        detailData.push(['', '', '', ''])
      })
      
      detailData.push(['TOTAL GENERAL', totalCredits, '', ''])
      
      const detailSheet = XLSX.utils.aoa_to_sheet(detailData)
      detailSheet['!cols'] = [
        { wch: 15 },  // Fecha
        { wch: 18 },  // Monto
        { wch: 50 },  // Descripción
        { wch: 25 },  // Banco
      ]
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle Ingresos')
    }

    // === HOJA DETALLE EGRESOS ===
    if (debits.length > 0) {
      const debitsByMonth: Record<string, any[]> = {}
      debits.forEach((t: any) => {
        if (!debitsByMonth[t.month]) debitsByMonth[t.month] = []
        debitsByMonth[t.month].push(t)
      })
      
      const debitsData: any[][] = []
      debitsData.push(['DETALLE DE EGRESOS POR MES', '', '', ''])
      debitsData.push(['', '', '', ''])
      
      Object.keys(debitsByMonth).sort().forEach(month => {
        debitsData.push([`Mes: ${month}`, '', '', ''])
        debitsData.push(['Fecha', 'Monto (₡)', 'Descripción', 'Banco'])
        
        debitsByMonth[month].forEach((t: any) => {
          debitsData.push([
            new Date(t.date).toLocaleDateString('es-CR'),
            t.amount,
            t.description || '',
            bankName || ''
          ])
        })
        
        const monthTotal = debitsByMonth[month].reduce((sum: number, t: any) => sum + t.amount, 0)
        debitsData.push(['Subtotal', monthTotal, '', ''])
        debitsData.push(['', '', '', ''])
      })
      
      debitsData.push(['TOTAL GENERAL', totalDebits, '', ''])
      
      const debitsSheet = XLSX.utils.aoa_to_sheet(debitsData)
      debitsSheet['!cols'] = [
        { wch: 15 },  // Fecha
        { wch: 18 },  // Monto
        { wch: 50 },  // Descripción
        { wch: 25 },  // Banco
      ]
      XLSX.utils.book_append_sheet(workbook, debitsSheet, 'Detalle Egresos')
    }

    // === HOJA MENSUAL ===
    const monthlyData: Record<string, { credits: number; debits: number; net: number }> = {}
    
    credits.forEach((t: any) => {
      if (!monthlyData[t.month]) monthlyData[t.month] = { credits: 0, debits: 0, net: 0 }
      monthlyData[t.month].credits += t.amount
      monthlyData[t.month].net += t.amount
    })
    
    debits.forEach((t: any) => {
      if (!monthlyData[t.month]) monthlyData[t.month] = { credits: 0, debits: 0, net: 0 }
      monthlyData[t.month].debits += t.amount
      monthlyData[t.month].net -= t.amount
    })

    const monthlySheetData: any[][] = []
    monthlySheetData.push(['RESUMEN MENSUAL', '', '', ''])
    monthlySheetData.push(['Mes', 'Ingresos (₡)', 'Egresos (₡)', 'Neto (₡)'])
    
    Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, data]) => {
        monthlySheetData.push([month, data.credits, data.debits, data.net])
      })
    
    monthlySheetData.push(['', '', '', ''])
    monthlySheetData.push(['TOTAL', totalCredits, totalDebits, totalCredits - totalDebits])

    const monthlySheet = XLSX.utils.aoa_to_sheet(monthlySheetData)
    monthlySheet['!cols'] = [
      { wch: 12 },  // Mes
      { wch: 18 },  // Ingresos
      { wch: 18 },  // Egresos
      { wch: 18 },  // Neto
    ]
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Mensual')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="analisis_estados_cuenta_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export Excel error:', error)
    return NextResponse.json({ error: 'Error al exportar Excel' }, { status: 500 })
  }
}
