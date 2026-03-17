'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Landmark, 
  FileUp, 
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react'

export type ViewType = 'dashboard' | 'users' | 'organizations' | 'banks' | 'upload'

interface SidebarProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  userRole: string
  userName: string
  organizationName: string
  onLogout: () => void
}

export function Sidebar({ 
  currentView, 
  onViewChange, 
  userRole, 
  userName, 
  organizationName,
  onLogout 
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload' as ViewType, label: 'Procesar PDF', icon: FileUp },
    { id: 'banks' as ViewType, label: 'Bancos', icon: Landmark },
    ...(userRole === 'admin' ? [
      { id: 'users' as ViewType, label: 'Usuarios', icon: Users },
      { id: 'organizations' as ViewType, label: 'Organizaciones', icon: Building2 },
    ] : []),
  ]

  return (
    <aside 
      className={cn(
        "bg-gradient-to-b from-slate-800 to-slate-900 text-white flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-blue-500 rounded-lg flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg">FCRCAN</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white hover:bg-slate-700"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                isActive 
                  ? "bg-gradient-to-r from-teal-500 to-blue-500 text-white shadow-lg" 
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-slate-700">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{organizationName}</p>
            <p className="text-xs text-teal-400 capitalize">{userRole}</p>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={onLogout}
          className={cn(
            "w-full text-slate-300 hover:text-white hover:bg-slate-700",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>
      </div>
    </aside>
  )
}
