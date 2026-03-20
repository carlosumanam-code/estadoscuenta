'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  amount: number
  month: string
  description: string
  type?: string
}

interface TransactionsTableProps {
  transactions: Transaction[]
  type?: 'credit' | 'debit'
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-CR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string = '₡'): string {
  return `${currency}${amount.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function TransactionsTable({ 
  transactions, 
  type = 'credit'
}: TransactionsTableProps) {
  const isCredit = type === 'credit'
  
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {isCredit ? (
          <TrendingUp className="w-5 h-5 text-green-500" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-500" />
        )}
        <h3 className="font-semibold text-slate-700">
          {isCredit ? 'Detalle de Ingresos' : 'Detalle de Egresos'} ({transactions.length})
        </h3>
      </div>
      <ScrollArea className="h-[350px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Mes</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  {formatDate(transaction.date)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono">
                    {transaction.month}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                  {isCredit ? '+' : '-'}{formatCurrency(transaction.amount)}
                </TableCell>
                <TableCell className="max-w-xs truncate text-slate-600">
                  {transaction.description || '-'}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                  No hay {isCredit ? 'ingresos' : 'egresos'} para mostrar
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
