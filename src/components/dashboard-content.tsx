'use client'

import { useState } from 'react'
import { StatsCards } from './stats-cards'
import { TransactionsTable } from './transactions-table'
import { MonthlyChart } from './monthly-chart'
import { RentabilityPanel } from './rentability-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, Download, Loader2, TrendingUp, TrendingDown } from 'lucide-react'

interface ProcessedData {
  transactions: Array<{
    id: string
    date: string
    amount: number
    month: string
    description: string
    type: string
  }>
  credits: Array<{
    date: string
    amount: number
    month: string
    description: string
  }>
  debits: Array<{
    date: string
    amount: number
    month: string
    description: string
  }>
  statistics: {
    total: number
    average: number
    max: number
    min: number
    stdDev: number
    stabilityIndex: number
    transactionCount: number
  }
  debitStatistics: {
    total: number
    average: number
    max: number
    min: number
    transactionCount: number
  }
  rentability: {
    totalCredits: number
    totalDebits: number
    netFlow: number
    savingsRate: number
    expenseRatio: number
    score: number
  }
  monthlyTotals: Array<{
    month: string
    credits: number
    debits: number
    net: number
  }>
}

interface DashboardContentProps {
  data: ProcessedData | null
}

export function DashboardContent({ data }: DashboardContentProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!data) return
    
    setExporting(true)
    try {
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: data.transactions.map(t => t.id) }),
      })

      if (!response.ok) {
        throw new Error('Error al exportar')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analisis_financiero_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch (error) {
      console.error('Export error:', error)
      alert('Error al exportar Excel')
    } finally {
      setExporting(false)
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] text-slate-500">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <DollarSign className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700 mb-2">Sin datos para mostrar</h3>
        <p className="text-sm text-slate-500 text-center max-w-md">
          Procese un estado de cuenta bancario en formato PDF para ver los ingresos, egresos y análisis de rentabilidad.
        </p>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-6">
      {/* Header with totals */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard de Análisis</h2>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-green-600 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {data.statistics.transactionCount} ingresos
            </span>
            <span className="text-sm text-red-600 flex items-center gap-1">
              <TrendingDown className="w-4 h-4" />
              {data.debitStatistics.transactionCount} egresos
            </span>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {exporting ? 'Exportando...' : 'Descargar Excel'}
        </button>
      </div>

      {/* Rentability Panel - Main Feature */}
      <RentabilityPanel data={data.rentability} />

      {/* Monthly Summary with Credits and Debits */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Resumen Mensual Comparativo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-slate-600">Mes</th>
                  <th className="text-right py-2 font-medium text-green-600">Ingresos</th>
                  <th className="text-right py-2 font-medium text-red-600">Egresos</th>
                  <th className="text-right py-2 font-medium text-slate-600">Neto</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyTotals
                  .sort((a, b) => a.month.localeCompare(b.month))
                  .map((item) => (
                    <tr key={item.month} className="border-b border-slate-100">
                      <td className="py-2">
                        <Badge variant="outline" className="font-mono">
                          {item.month}
                        </Badge>
                      </td>
                      <td className="text-right py-2 text-green-700 font-medium">
                        {formatCurrency(item.credits)}
                      </td>
                      <td className="text-right py-2 text-red-700 font-medium">
                        {formatCurrency(item.debits)}
                      </td>
                      <td className={`text-right py-2 font-bold ${item.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.net >= 0 ? '+' : ''}{formatCurrency(item.net)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-2 px-2">TOTAL</td>
                  <td className="text-right py-2 px-2 text-green-700">
                    {formatCurrency(data.rentability.totalCredits)}
                  </td>
                  <td className="text-right py-2 px-2 text-red-700">
                    {formatCurrency(data.rentability.totalDebits)}
                  </td>
                  <td className={`text-right py-2 px-2 ${data.rentability.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.rentability.netFlow >= 0 ? '+' : ''}{formatCurrency(data.rentability.netFlow)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards for Credits */}
      <StatsCards statistics={data.statistics} title="Estadísticas de Ingresos" />

      {/* Statistics Cards for Debits */}
      {data.debitStatistics.transactionCount > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              Estadísticas de Egresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Total Egresos</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.debitStatistics.total)}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Promedio</p>
                <p className="text-2xl font-bold text-slate-700">
                  {formatCurrency(data.debitStatistics.average)}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Mayor Egreso</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.debitStatistics.max)}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500 mb-1">Menor Egreso</p>
                <p className="text-2xl font-bold text-slate-700">
                  {formatCurrency(data.debitStatistics.min)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyChart 
          data={data.monthlyTotals.map(m => ({ month: m.month, amount: m.credits }))} 
          title="Ingresos por Mes"
        />
        {data.debitStatistics.transactionCount > 0 && (
          <MonthlyChart 
            data={data.monthlyTotals.map(m => ({ month: m.month, amount: m.debits }))} 
            title="Egresos por Mes"
            color="red"
          />
        )}
      </div>

      {/* Transactions Tables */}
      <Tabs defaultValue="credits" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ingresos ({data.credits.length})
          </TabsTrigger>
          <TabsTrigger value="debits" className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Egresos ({data.debits.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="credits">
          <Card className="mt-4 border-0 shadow-sm">
            <CardContent className="pt-6">
              <TransactionsTable 
                transactions={data.credits.map((t, i) => ({ 
                  ...t, 
                  id: `credit-${i}`,
                  type: 'credit'
                }))} 
                onExport={handleExport}
                exporting={exporting}
                type="credit"
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="debits">
          <Card className="mt-4 border-0 shadow-sm">
            <CardContent className="pt-6">
              <TransactionsTable 
                transactions={data.debits.map((t, i) => ({ 
                  ...t, 
                  id: `debit-${i}`,
                  type: 'debit'
                }))} 
                onExport={handleExport}
                exporting={exporting}
                type="debit"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
