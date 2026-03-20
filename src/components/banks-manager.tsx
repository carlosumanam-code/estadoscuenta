'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Loader2, Search, Landmark } from 'lucide-react'

interface Bank {
  id: string
  name: string
  code: string | null
  createdAt: string
}

export function BanksManager({ userRole }: { userRole: string }) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<Bank | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({ name: '', code: '' })

  const fetchBanks = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/banks')
      const data = await response.json()
      if (response.ok) setBanks(data.banks)
    } catch (err) {
      console.error('Error fetching banks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanks()
  }, [])

  const openCreateDialog = () => {
    setEditingBank(null)
    setFormData({ name: '', code: '' })
    setError('')
    setDialogOpen(true)
  }

  const openEditDialog = (bank: Bank) => {
    setEditingBank(bank)
    setFormData({ name: bank.name, code: bank.code || '' })
    setError('')
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFormLoading(true)

    try {
      const url = '/api/banks'
      const method = editingBank ? 'PUT' : 'POST'
      const body = editingBank ? { id: editingBank.id, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error al guardar banco')
        return
      }

      setDialogOpen(false)
      fetchBanks()
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (bankId: string) => {
    if (!confirm('¿Está seguro de eliminar este banco?')) return

    try {
      const response = await fetch(`/api/banks?id=${bankId}`, { method: 'DELETE' })
      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al eliminar banco')
        return
      }

      fetchBanks()
    } catch (err) {
      alert('Error de conexión')
    }
  }

  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bank.code && bank.code.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Entidades Financieras</h2>
        {userRole === 'admin' && (
          <Button onClick={openCreateDialog} className="bg-teal-500 hover:bg-teal-600">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Banco
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Landmark className="w-5 h-5 text-teal-500" />
            Catálogo de Bancos
          </CardTitle>
          <p className="text-sm text-slate-500">
            Lista de entidades financieras disponibles para procesar estados de cuenta.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar bancos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Banco</TableHead>
                  <TableHead>Código</TableHead>
                  {userRole === 'admin' && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBanks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell className="font-medium">{bank.name}</TableCell>
                    <TableCell>
                      {bank.code ? (
                        <Badge variant="outline" className="font-mono">{bank.code}</Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(bank)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(bank.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filteredBanks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={userRole === 'admin' ? 3 : 2} className="text-center text-slate-500 py-8">
                      No se encontraron bancos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-slate-500">
            Total: {filteredBanks.length} banco(s)
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBank ? 'Editar Banco' : 'Nuevo Banco'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del Banco *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Banco Nacional de Costa Rica"
                  required
                />
              </div>
              <div>
                <Label htmlFor="code">Código (Opcional)</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ej: BNCR"
                  maxLength={10}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Código corto para identificar el banco en reportes.
                </p>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formLoading} className="bg-teal-500 hover:bg-teal-600">
                {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingBank ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
