'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, Mail, LogOut, Users, Building2, Landmark, FileUp, ChevronLeft, ChevronRight, Download, Plus, Pencil, Trash2, X } from 'lucide-react'
import { BanksManager } from '@/components/banks-manager'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loginForm, setLoginForm] = useState({ organizationId: '', email: '', password: '' })
  const [organizations, setOrganizations] = useState<{id: string, name: string}[]>([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [orgsError, setOrgsError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [currentView, setCurrentView] = useState('upload')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Load organizations on mount
  useEffect(() => {
    setOrgsLoading(true)
    setOrgsError('')
    
    fetch('/api/organizations/public')
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar organizaciones')
        return res.json()
      })
      .then(data => {
        console.log('Organizaciones cargadas:', data)
        if (data.error) {
          const errorMsg = data.error + (data.details ? `: ${data.details}` : '') + (data.hasDbUrl === false ? ' (Sin DATABASE_URL)' : '')
          setOrgsError(errorMsg)
        } else {
          setOrganizations(data.organizations || [])
          if (data.organizations?.length > 0) {
            setLoginForm(prev => ({ ...prev, organizationId: data.organizations[0].id }))
          }
        }
      })
      .catch(err => {
        console.error('Error loading organizations:', err)
        setOrgsError('Error de conexión al cargar organizaciones')
      })
      .finally(() => setOrgsLoading(false))
  }, [])

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

  // Login form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center space-y-4 pb-4">
            <div className="mx-auto w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
              <Lock className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                Análisis de Estados de Cuenta
              </CardTitle>
              <CardDescription className="text-foreground/70 mt-1.5">
                Ingrese sus credenciales para acceder
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <Alert className="bg-primary/10 border-primary/20">
                  <AlertDescription className="text-primary">{loginError}</AlertDescription>
                </Alert>
              )}
              {orgsError && (
                <Alert className="bg-primary/10 border-primary/20">
                  <AlertDescription className="text-primary">{orgsError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="organization" className="text-foreground">Organización</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                  <select
                    id="organization"
                    value={loginForm.organizationId}
                    onChange={(e) => setLoginForm({ ...loginForm, organizationId: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary appearance-none"
                    required
                    disabled={orgsLoading || orgsError !== ''}
                  >
                    {orgsLoading ? (
                      <option value="">Cargando...</option>
                    ) : orgsError ? (
                      <option value="">Error al cargar</option>
                    ) : organizations.length === 0 ? (
                      <option value="">Sin organizaciones</option>
                    ) : (
                      organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-foreground">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="pl-10 border-border bg-card"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-foreground">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="pl-10 border-border bg-card"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-hover text-primary-foreground h-10"
                disabled={loginLoading || organizations.length === 0}
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
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - Fondo blanco puro */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Header */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between min-h-[60px]">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Landmark className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-sidebar-foreground">FCRCAN</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent p-1.5 rounded-lg transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left relative ${
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-foreground font-semibold border-l-4 border-primary -ml-0.5 pl-3.5' 
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
              </button>
            )
          })}
        </nav>
        
        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border">
          {!sidebarCollapsed && (
            <div className="mb-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user.organization?.name}</p>
              <p className="text-xs text-secondary capitalize mt-0.5">{user.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full text-sidebar-foreground/70 hover:text-primary hover:bg-sidebar-accent/50 p-2 rounded-lg flex items-center transition-colors ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
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
      <h2 className="text-2xl font-bold text-foreground">Procesar Estado de Cuenta</h2>
      
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileUp className="w-5 h-5 text-primary" />
            Subir Archivo PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Banco</Label>
              <select 
                value={selectedBank} 
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full border border-border rounded-lg p-2.5 mt-1.5 bg-card text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-foreground">Archivo PDF</Label>
              <div className="mt-1.5 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
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
                      <FileUp className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-foreground/60">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <FileUp className="w-10 h-10 text-foreground/40 mx-auto mb-2" />
                      <p className="text-foreground font-medium">Arrastre un archivo PDF o haga clic para seleccionar</p>
                      <p className="text-sm text-foreground/50 mt-1">Solo archivos PDF</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            
            {error && (
              <Alert className="bg-primary/10 border-primary/20">
                <AlertDescription className="text-primary">{error}</AlertDescription>
              </Alert>
            )}
            
            {result && (
              <div className="space-y-4">
                <Alert className="bg-muted border-border">
                  <AlertDescription className="text-foreground">
                    <strong className="text-primary">¡Procesado exitosamente!</strong><br/>
                    ✅ CRÉDITOS (Ingresos): {result.credits?.length || 0} transacciones<br/>
                    ✅ Total Créditos: ₡{result.statistics?.total?.toLocaleString('es-CR', {minimumFractionDigits: 2}) || '0.00'}<br/>
                    ✅ DÉBITOS (Gastos): {result.debits?.length || 0} transacciones<br/>
                    ✅ Total Débitos: ₡{result.debitStatistics?.total?.toLocaleString('es-CR', {minimumFractionDigits: 2}) || '0.00'}
                  </AlertDescription>
                </Alert>
                
                <Button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground h-10"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exportando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Excel
                    </>
                  )}
                </Button>
                
                {result.credits && result.credits.length > 0 && (
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-lg text-foreground">Ingresos Detectados (Créditos)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left p-2 text-foreground">Fecha</th>
                              <th className="text-left p-2 text-foreground">Mes</th>
                              <th className="text-right p-2 text-foreground">Monto</th>
                              <th className="text-left p-2 text-foreground">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.credits.slice(0, 10).map((t: any, i: number) => (
                              <tr key={i} className="border-b border-border">
                                <td className="p-2 text-foreground">{new Date(t.date).toLocaleDateString('es-CR')}</td>
                                <td className="p-2 text-foreground">{t.month}</td>
                                <td className="p-2 text-right font-bold text-foreground">
                                  +₡{t.amount?.toLocaleString('es-CR', {minimumFractionDigits: 2})}
                                </td>
                                <td className="p-2 text-foreground/70 truncate max-w-xs">{t.description || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.credits.length > 10 && (
                          <p className="text-center text-foreground/50 text-sm mt-2">
                            Mostrando 10 de {result.credits.length} ingresos
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            
            <div className="bg-muted p-3 rounded-lg text-xs text-foreground/60">
              <strong>Nota:</strong> Los archivos PDF se procesan en memoria y no se almacenan en el servidor.
            </div>
            
            <Button 
              type="submit" 
              disabled={loading || !file} 
              className="w-full bg-primary hover:bg-primary-hover text-primary-foreground h-10"
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

// Users Section con CRUD completo
function UsersSection() {
  const [users, setUsers] = useState<any[]>([])
  const [organizations, setOrganizations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    organizationId: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadUsers = () => {
    setLoading(true)
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadUsers()
    fetch('/api/organizations')
      .then(res => res.json())
      .then(data => setOrganizations(data.organizations || []))
      .catch(console.error)
  }, [])

  const openAddModal = () => {
    setEditingUser(null)
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      organizationId: organizations[0]?.id || ''
    })
    setError('')
    setShowModal(true)
  }

  const openEditModal = (u: any) => {
    setEditingUser(u)
    setFormData({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      organizationId: u.organizationId
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.email || (!editingUser && !formData.password)) {
      setError('Todos los campos son requeridos')
      return
    }

    setSaving(true)
    setError('')

    try {
      const url = editingUser ? `/api/users?id=${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      
      const body: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        organizationId: formData.organizationId
      }
      
      if (formData.password) {
        body.password = formData.password
      }
      
      if (editingUser) {
        body.id = editingUser.id
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al guardar')
      } else {
        setShowModal(false)
        loadUsers()
      }
    } catch (e) {
      console.error('Save error:', e)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return

    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Error al eliminar')
      } else {
        loadUsers()
      }
    } catch (e) {
      console.error('Delete error:', e)
      alert('Error de conexión')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Usuarios</h2>
        <Button onClick={openAddModal} className="bg-primary hover:bg-primary-hover text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Usuario
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-foreground/60">
              No hay usuarios registrados
            </div>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="p-4 bg-muted rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-medium text-foreground">{u.name}</p>
                    <p className="text-sm text-foreground/60">{u.email}</p>
                    <p className="text-xs text-foreground/50">{u.organization?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded capitalize ${
                      u.role === 'admin' 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-secondary/20 text-secondary'
                    }`}>
                      {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                    </span>
                    <button
                      onClick={() => openEditModal(u)}
                      className="p-1.5 hover:bg-background rounded transition-colors text-foreground/60 hover:text-primary"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-1.5 hover:bg-background rounded transition-colors text-foreground/60 hover:text-accent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </CardTitle>
                <button onClick={() => setShowModal(false)} className="text-foreground/60 hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert className="bg-primary/10 border-primary/20">
                  <AlertDescription className="text-primary">{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-1.5">
                <Label className="text-foreground">Nombre</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border-border bg-card"
                  placeholder="Nombre completo"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-foreground">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="border-border bg-card"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-foreground">
                  Contraseña {editingUser && '(dejar vacío para mantener)'}
                </Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="border-border bg-card"
                  placeholder="••••••••"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-foreground">Rol</Label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-border rounded-lg p-2.5 bg-card text-foreground"
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-foreground">Organización</Label>
                <select
                  value={formData.organizationId}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                  className="w-full border border-border rounded-lg p-2.5 bg-card text-foreground"
                >
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Organizations Section con CRUD completo
function OrganizationsSection() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingOrg, setEditingOrg] = useState<any>(null)
  const [formData, setFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadOrgs = () => {
    setLoading(true)
    fetch('/api/organizations')
      .then(res => res.json())
      .then(data => {
        console.log('Respuesta organizaciones:', data)
        if (data.error) {
          console.error('Error al cargar organizaciones:', data.error)
          setError(data.error)
          setOrgs([])
        } else {
          setOrgs(data.organizations || [])
        }
      })
      .catch(err => {
        console.error('Error de conexión:', err)
        setError('Error de conexión')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadOrgs()
  }, [])

  const openAddModal = () => {
    setEditingOrg(null)
    setFormData({ name: '' })
    setError('')
    setShowModal(true)
  }

  const openEditModal = (org: any) => {
    setEditingOrg(org)
    setFormData({ name: org.name })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('El nombre es requerido')
      return
    }

    setSaving(true)
    setError('')

    try {
      const url = editingOrg ? `/api/organizations?id=${editingOrg.id}` : '/api/organizations'
      const method = editingOrg ? 'PUT' : 'POST'

      console.log('Guardando organización:', { url, method, name: formData.name })

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOrg?.id,
          name: formData.name.trim()
        })
      })

      const data = await res.json()
      console.log('Respuesta:', data)

      if (!res.ok) {
        setError(data.error || 'Error al guardar')
        alert('Error: ' + (data.error || 'Error al guardar'))
      } else {
        setShowModal(false)
        loadOrgs()
      }
    } catch (e) {
      console.error('Save error:', e)
      setError('Error de conexión')
      alert('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (orgId: string, orgName: string) => {
    if (!confirm(`¿Está seguro de eliminar la organización "${orgName}"?`)) return

    try {
      const res = await fetch(`/api/organizations?id=${orgId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Error al eliminar')
      } else {
        loadOrgs()
      }
    } catch (e) {
      console.error('Delete error:', e)
      alert('Error de conexión')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Organizaciones</h2>
        <Button onClick={openAddModal} className="bg-primary hover:bg-primary-hover text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Organización
        </Button>
      </div>

      {error && (
        <Alert className="bg-primary/10 border-primary/20">
          <AlertDescription className="text-primary">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border">
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : orgs.length === 0 ? (
            <div className="text-center py-8 text-foreground/60">
              No hay organizaciones registradas
            </div>
          ) : (
            <div className="space-y-2">
              {orgs.map(o => (
                <div key={o.id} className="p-4 bg-muted rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-medium text-foreground">{o.name}</p>
                    <p className="text-sm text-foreground/50">
                      {o._count?.users || 0} usuario(s) · {o._count?.bankStatements || 0} estado(s) de cuenta
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(o)}
                      className="p-1.5 hover:bg-background rounded transition-colors text-foreground/60 hover:text-primary"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(o.id, o.name)}
                      className="p-1.5 hover:bg-background rounded transition-colors text-foreground/60 hover:text-accent"
                      disabled={(o._count?.users || 0) > 0}
                      title={(o._count?.users || 0) > 0 ? 'No se puede eliminar, tiene usuarios asociados' : 'Eliminar'}
                    >
                      <Trash2 className={`w-4 h-4 ${(o._count?.users || 0) > 0 ? 'opacity-50 cursor-not-allowed' : ''}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">
                  {editingOrg ? 'Editar Organización' : 'Nueva Organización'}
                </CardTitle>
                <button onClick={() => setShowModal(false)} className="text-foreground/60 hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert className="bg-primary/10 border-primary/20">
                  <AlertDescription className="text-primary">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label className="text-foreground">Nombre de la Organización</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border-border bg-card"
                  placeholder="Ej: FCRCAN, Empresa ABC, etc."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
