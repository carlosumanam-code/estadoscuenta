'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity,
  Calculator,
  Target
} from 'lucide-react'

interface Statistics {
  total: number
  average: number
  max: number
  min: number
  stdDev: number
  stabilityIndex: number
  transactionCount: number
}

interface StatsCardsProps {
  statistics: Statistics
  currency?: string
  title?: string
}

function formatCurrency(amount: number, currency: string = '₡'): string {
  return `${currency}${amount.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function StatsCards({ statistics, currency = '₡', title }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total',
      value: formatCurrency(statistics.total, currency),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      iconBg: 'bg-green-100',
    },
    {
      title: 'Promedio',
      value: formatCurrency(statistics.average, currency),
      icon: Calculator,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-100',
    },
    {
      title: 'Máximo',
      value: formatCurrency(statistics.max, currency),
      icon: TrendingUp,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      iconBg: 'bg-teal-100',
    },
    {
      title: 'Mínimo',
      value: formatCurrency(statistics.min, currency),
      icon: TrendingDown,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      iconBg: 'bg-orange-100',
    },
    {
      title: 'Desv. Estándar',
      value: formatCurrency(statistics.stdDev, currency),
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      iconBg: 'bg-purple-100',
    },
    {
      title: 'Transacciones',
      value: statistics.transactionCount.toString(),
      icon: BarChart3,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      iconBg: 'bg-slate-100',
    },
  ]

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={`${card.bgColor} border-0 shadow-sm`}>
              <CardContent className="p-3">
                <div className="flex flex-col items-center text-center">
                  <div className={`${card.iconBg} p-2 rounded-lg mb-2`}>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <p className="text-xs font-medium text-slate-600">{card.title}</p>
                  <p className={`text-lg font-bold ${card.color} mt-1`}>
                    {card.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Stability Index Card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Target className="w-8 h-8 text-teal-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-300">Índice de Estabilidad</p>
                <p className="text-2xl font-bold text-white">
                  {statistics.stabilityIndex.toFixed(1)}%
                </p>
              </div>
              <Progress 
                value={statistics.stabilityIndex} 
                className="h-3 bg-slate-700"
              />
              <p className="text-xs text-slate-400 mt-2">
                {statistics.stabilityIndex >= 80 
                  ? 'Muy estable - Ingresos consistentes' 
                  : statistics.stabilityIndex >= 60
                  ? 'Estable - Variación moderada'
                  : statistics.stabilityIndex >= 40
                  ? 'Variable - Ingresos fluctuantes'
                  : 'Inestable - Alta variación en ingresos'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
