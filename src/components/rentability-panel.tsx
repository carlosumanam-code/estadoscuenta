'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, AlertTriangle, CheckCircle } from 'lucide-react'

interface RentabilityData {
  totalCredits: number
  totalDebits: number
  netFlow: number
  savingsRate: number
  expenseRatio: number
  score: number
}

interface RentabilityPanelProps {
  data: RentabilityData | null
}

export function RentabilityPanel({ data }: RentabilityPanelProps) {
  if (!data) {
    return null
  }

  const { totalCredits, totalDebits, netFlow, savingsRate, expenseRatio, score } = data

  // Determine financial health status
  const getHealthStatus = () => {
    if (score >= 70) return { label: 'Excelente', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle }
    if (score >= 50) return { label: 'Bueno', color: 'text-blue-600', bg: 'bg-blue-100', icon: TrendingUp }
    if (score >= 30) return { label: 'Regular', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: AlertTriangle }
    return { label: 'Necesita Atención', color: 'text-red-600', bg: 'bg-red-100', icon: TrendingDown }
  }

  const status = getHealthStatus()
  const StatusIcon = status.icon

  // Format currency
  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-teal-500 text-white pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <PiggyBank className="w-5 h-5" />
            Panel de Rentabilidad
          </CardTitle>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${status.bg} ${status.color} text-sm font-medium`}>
            <StatusIcon className="w-4 h-4" />
            {status.label}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Main Score */}
        <div className="text-center mb-6">
          <div className="text-5xl font-bold text-slate-800 mb-1">
            {score.toFixed(0)}
            <span className="text-2xl text-slate-400">/100</span>
          </div>
          <p className="text-slate-500 text-sm">Índice de Rentabilidad</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <Progress 
            value={score} 
            className="h-3"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>Crítico</span>
            <span>Regular</span>
            <span>Bueno</span>
            <span>Excelente</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Ingresos */}
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Ingresos</span>
            </div>
            <div className="text-xl font-bold text-green-700">
              {formatCurrency(totalCredits)}
            </div>
          </div>

          {/* Egresos */}
          <div className="p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Egresos</span>
            </div>
            <div className="text-xl font-bold text-red-700">
              {formatCurrency(totalDebits)}
            </div>
          </div>
        </div>

        {/* Net Flow */}
        <div className={`p-4 rounded-xl mb-4 ${
          netFlow >= 0 
            ? 'bg-gradient-to-r from-green-50 to-teal-50 border border-green-200' 
            : 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Flujo Neto</p>
              <div className={`text-2xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </div>
            </div>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              netFlow >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <DollarSign className={`w-7 h-7 ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Tasa de Ahorro</p>
            <p className={`text-lg font-bold ${savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {savingsRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">de los ingresos</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Ratio de Gastos</p>
            <p className="text-lg font-bold text-slate-700">
              {expenseRatio.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">vs ingresos</p>
          </div>
        </div>

        {/* Interpretation */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-800">
            {netFlow >= 0 ? (
              <>
                <strong>✓ Situación positiva:</strong> Los ingresos superan a los egresos. 
                La persona tiene capacidad de ahorro de {formatCurrency(Math.abs(netFlow))}.
              </>
            ) : (
              <>
                <strong>⚠ Situación negativa:</strong> Los egresos superan a los ingresos por {formatCurrency(Math.abs(netFlow))}. 
                Se recomienda revisar los gastos.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
