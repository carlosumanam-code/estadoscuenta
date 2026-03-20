'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface Bank {
  id: string
  name: string
  code: string | null
}

interface ProcessedData {
  transactions: Array<{
    id: string
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
  monthlyTotals: Array<{
    month: string
    amount: number
  }>
}

interface PDFUploadProps {
  onDataProcessed: (data: ProcessedData) => void
}

export function PDFUpload({ onDataProcessed }: PDFUploadProps) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [selectedBank, setSelectedBank] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('/api/banks')
        const data = await response.json()
        if (response.ok) {
          setBanks(data.banks)
          if (data.banks.length > 0) {
            setSelectedBank(data.banks[0].id)
          }
        }
      } catch (err) {
        console.error('Error fetching banks:', err)
      }
    }
    fetchBanks()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Solo se permiten archivos PDF')
        return
      }
      // Check file size (5MB limit for Netlify serverless)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (selectedFile.size > maxSize) {
        setError(`El archivo es demasiado grande (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB). El límite es 5MB.`)
        return
      }
      setFile(selectedFile)
      setError('')
      setSuccess(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!file) {
      setError('Debe seleccionar un archivo PDF')
      return
    }

    if (!selectedBank) {
      setError('Debe seleccionar un banco')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bankId', selectedBank)

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      })

      // Try to parse as JSON, but handle text responses too
      let data
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const textResponse = await response.text()
        console.error('Non-JSON response:', textResponse)
        setError(`Error del servidor: ${textResponse || 'Error desconocido'}. Intente con un archivo más pequeño.`)
        return
      }

      if (!response.ok) {
        setError(data.error || 'Error al procesar el archivo')
        return
      }

      setSuccess(true)
      onDataProcessed(data)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(`Error de conexión: ${err.message || 'Intente nuevamente'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-teal-500" />
          Procesar Estado de Cuenta
        </CardTitle>
        <CardDescription>
          Suba un archivo PDF de estado de cuenta bancario para extraer los ingresos detectados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Archivo procesado exitosamente. Vea los resultados en el dashboard.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Banco</label>
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar banco" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name} {bank.code ? `(${bank.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Archivo PDF</label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-teal-400 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-teal-500" />
                    <div className="text-left">
                      <p className="font-medium text-slate-700">{file.name}</p>
                      <p className="text-sm text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-600 font-medium">
                      Arrastre un archivo PDF o haga clic para seleccionar
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      Solo archivos PDF (máx. 5MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando archivo...
              </div>
              <Progress value={66} className="h-2" />
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600"
            disabled={loading || !file || !selectedBank}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Procesar PDF
              </>
            )}
          </Button>

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
            <p className="font-medium mb-1">Nota de Seguridad:</p>
            Los archivos PDF se procesan en memoria y no se almacenan en el servidor.
            Los datos extraídos se guardan únicamente para análisis.
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
