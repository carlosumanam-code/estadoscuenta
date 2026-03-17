'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, Mail, LogOut, Users, Building2, Landmark, FileUp, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { BanksManager } from '@/components/banks-manager'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [currentView, setCurrentView] = useState('upload')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      
      if (!res.ok) {
        setLoginError(data.error || 'Error al iniciar sesión')
        setLoginLoading(false)
        return
      }
      
      setUser(data.user)
    } catch (e) {
      console.error('Login error:', e)
      setLoginError('Error de conexión')
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      console.error('Logout error:', e)
    }
    setUser(null)
  }

  // Login form (show immediately if no user)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-800">
                Análisis de Estados de Cuenta
              </CardTitle>
              <CardDescription className="text-slate-500 mt-2">
                Ingrese sus credenciales para acceder al sistema
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="pl-10"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 h-11"
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main app with sidebar
  const menuItems = [
    { id: 'upload', label: 'Procesar PDF', icon: FileUp },
    { id: 'banks', label: 'Bancos', icon: Landmark },
    ...(user.role === 'admin' ? [
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'organizations', label: 'Organizaciones', icon: Building2 },
    ] : []),
  ]

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gradient-to-b from-slate-800 to-slate-900 text-white flex flex-col transition-all duration-300 flex-shrink-0`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between min-h-[65px]">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-blue-500 rounded-lg flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg">FCRCAN</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-slate-400 hover:text-white hover:bg-slate-700 p-1.5 rounded transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        
        <nav className="flex-1 p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  isActive 
                    ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg' 
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-slate-700">
          {!sidebarCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.organization?.name}</p>
              <p className="text-xs text-teal-400 capitalize">{user.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full text-slate-300 hover:text-white hover:bg-slate-700 p-2 rounded flex items-center transition-colors ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && <span className="ml-2 text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {currentView === 'upload' && <PDFUploadSection />}
          {currentView === 'users' && <UsersSection />}
          {currentView === 'organizations' && <OrganizationsSection />}
          {currentView === 'banks' && <BanksManager userRole={user.role} />}
        </div>
      </main>
    </div>
  )
}

// PDF Upload Section
function PDFUploadSection() {
  const [selectedBank, setSelectedBank] = useState('')
  const [banks, setBanks] = useState<{id: string, name: string}[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch('/api/banks')
      .then(res => res.json())
      .then(data => {
        setBanks(data.banks || [])
        if (data.banks?.length > 0) setSelectedBank(data.banks[0].id)
      })
      .catch(console.error)
  }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !selectedBank) return
    
    setLoading(true)
    setError('')
    setResult(null)
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bankId', selectedBank)
    
    try {
      const res = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Error al procesar')
      } else {
        setResult(data)
      }
    } catch (e) {
      console.error('Upload error:', e)
      setError('Error de conexión. Por favor intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportExcel = async () => {
    if (!result?.transactions) return
    
    setExporting(true)
    try {
      const selectedBankName = banks.find(b => b.id === selectedBank)?.name || ''
      
      const response = await fetch('/api/export-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: result.transactions,
          credits: result.credits,
          debits: result.debits,
          clientInfo: {
            clientName: 'Cliente',
            activity: ''
          },
          bankName: selectedBankName
        }),
      })

      if (!response.ok) {
        throw new Error('Error al exportar')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analisis_estados_cuenta_${new Date().toISOString().split('T')[0]}.xlsx`
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Procesar Estado de Cuenta</h2>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="w-5 h-5 text-teal-500" />
            Subir Archivo PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Banco</Label>
              <select 
                value={selectedBank} 
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full border border-slate-200 rounded-lg p-2.5 mt-1.5 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Archivo PDF</Label>
              <div className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-teal-400 transition-colors">
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pdf-file"
                />
                <label htmlFor="pdf-file" className="cursor-pointer">
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileUp className="w-8 h-8 text-teal-500" />
                      <div className="text-left">
                        <p className="font-medium text-slate-700">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <FileUp className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-600 font-medium">Arrastre un archivo PDF o haga clic para seleccionar</p>
                      <p className="text-sm text-slate-400 mt-1">Solo archivos PDF</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            
            {result && (
              <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">
                    <strong>¡Procesado exitosamente!</strong><br/>
                    Transacciones detectadas: {result.statistics?.transactionCount || 0}<br/>
                    Total de ingresos: ₡{result.statistics?.total?.toLocaleString('es-CR', {minimumFractionDigits: 2}) || '0.00'}
                  </AlertDescription>
                </Alert>
                
                {/* Botón de Exportar según plantilla */}
                <Button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 h-11"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Excel (Formato Plantilla)
                    </>
                  )}
                </Button>
                
                {/* Show transactions */}
                {result.transactions && result.transactions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Transacciones Detectadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Fecha</th>
                              <th className="text-left p-2">Mes</th>
                              <th className="text-right p-2">Monto</th>
                              <th className="text-left p-2">Tipo</th>
                              <th className="text-left p-2">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.transactions.slice(0, 10).map((t: any, i: number) => (
                              <tr key={i} className="border-b">
                                <td className="p-2">{new Date(t.date).toLocaleDateString('es-CR')}</td>
                                <td className="p-2">{t.month}</td>
                                <td className={`p-2 text-right font-medium ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                  {t.type === 'credit' ? '+' : '-'}₡{t.amount?.toLocaleString('es-CR', {minimumFractionDigits: 2})}
                                </td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs ${t.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {t.type === 'credit' ? 'Ingreso' : 'Egreso'}
                                  </span>
                                </td>
                                <td className="p-2 text-slate-600 truncate max-w-xs">{t.description || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.transactions.length > 10 && (
                          <p className="text-center text-slate-500 text-sm mt-2">
                            Mostrando 10 de {result.transactions.length} transacciones
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            
            <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500">
              <strong>Nota de seguridad:</strong> Los archivos PDF se procesan en memoria y no se almacenan en el servidor.
            </div>
            
            <Button 
              type="submit" 
              disabled={loading || !file} 
              className="w-full bg-teal-500 hover:bg-teal-600 h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4 mr-2" />
                  Procesar PDF
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Users Section
function UsersSection() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Usuarios</h2>
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="p-4 bg-slate-50 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-800">{u.name}</p>
                    <p className="text-sm text-slate-500">{u.email}</p>
                  </div>
                  <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded capitalize">{u.role}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Organizations Section
function OrganizationsSection() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/organizations')
      .then(res => res.json())
      .then(data => setOrgs(data.organizations || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Organizaciones</h2>
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
          ) : (
            <div className="space-y-2">
              {orgs.map(o => (
                <div key={o.id} className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-800">{o.name}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


