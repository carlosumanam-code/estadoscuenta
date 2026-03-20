'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'

interface MonthlyData {
  month: string
  amount: number
}

interface MonthlyChartProps {
  data: MonthlyData[]
  title?: string
  color?: 'green' | 'red' | 'blue'
}

const GREEN_COLORS = [
  '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'
]

const RED_COLORS = [
  '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA'
]

const BLUE_COLORS = [
  '#0D9488', '#14B8A6', '#2DD4BF', '#0EA5E9', '#38BDF8'
]

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `₡${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `₡${(value / 1000).toFixed(0)}K`
  }
  return `₡${value.toFixed(0)}`
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-')
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ]
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`
}

export function MonthlyChart({ data, title, color = 'green' }: MonthlyChartProps) {
  const chartData = data
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(item => ({
      ...item,
      label: formatMonth(item.month),
    }))

  const getColors = () => {
    switch (color) {
      case 'red': return RED_COLORS
      case 'blue': return BLUE_COLORS
      default: return GREEN_COLORS
    }
  }

  const colors = getColors()
  
  const defaultTitle = color === 'red' ? 'Egresos Mensuales' : 'Ingresos Mensuales'
  const Icon = color === 'red' ? TrendingDown : TrendingUp

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className={`w-5 h-5 ${color === 'red' ? 'text-red-500' : 'text-teal-500'}`} />
          {title || defaultTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="label" 
                tick={{ fill: '#64748B', fontSize: 12 }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fill: '#64748B', fontSize: 12 }}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Total']}
                contentStyle={{
                  backgroundColor: '#1E293B',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={colors[index % colors.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-500">
            No hay datos para mostrar
          </div>
        )}
      </CardContent>
    </Card>
  )
}
