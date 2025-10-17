'use client'

import { useState, useEffect } from 'react'
import { 
  Bot, 
  LayoutDashboard, 
  FlaskConical, 
  Activity, 
  Video, 
  Settings,
  Bell,
  User,
  AlertTriangle,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  Monitor
} from 'lucide-react'
import ToastNotifications from './ToastNotifications'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, current: true, badge: null },
  { name: 'Experimentos', href: '/experiments', icon: FlaskConical, current: false, badge: '3' },
  { name: 'Robots', href: '/robots', icon: Bot, current: false, badge: null },
  { name: 'Telemetría', href: '/telemetry', icon: Activity, current: false, badge: 'Live' },
  { name: 'Video', href: '/video', icon: Video, current: false, badge: null },
  { name: 'Configuración', href: '/settings', icon: Settings, current: false, badge: null },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications] = useState(3)
  const [systemStatus] = useState('Operacional')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)

  // Close mobile sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarOpen && window.innerWidth < 1024) {
        const sidebar = document.querySelector('.sidebar')
        if (sidebar && !sidebar.contains(event.target as Node)) {
          setSidebarOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sidebarOpen])

  // Handle theme changes
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      root.removeAttribute('data-theme')
    } else {
      // System theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.setAttribute('data-theme', 'dark')
      } else {
        root.removeAttribute('data-theme')
      }
    }
  }, [theme])

  return (
    <div className="min-h-screen dashboard-container">
      {/* Sidebar - 240px de ancho */}
      <div className={`fixed inset-y-0 left-0 z-50 w-60 sidebar transform transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center px-6 py-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Bot className="h-8 w-8 text-primary" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-card"></div>
              </div>
              <div>
                <span className="text-xl font-bold text-foreground">Atriz Lab</span>
                <p className="text-xs text-muted-foreground">Laboratorio Remoto</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    item.current
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </div>
                  {item.badge && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      item.badge === 'Live' 
                        ? 'bg-success text-success-foreground animate-pulse' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </a>
              )
            })}
          </nav>

          {/* Footer con versión del sistema */}
          <div className="px-4 py-4 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <span>v2.3.1</span>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse"></div>
                <span>WS</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Última actualización: 2 min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-60">
        {/* Header Superior - 64px de altura */}
        <header className="sticky top-0 z-40 header">
          <div className="flex items-center justify-between px-6 py-4 h-full">
            {/* Left side - Logo y estado */}
            <div className="flex items-center space-x-4">
              <button
                type="button"
                className="lg:hidden p-2 rounded-lg text-foreground hover:bg-secondary transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              
              <div className="hidden lg:flex lg:items-center">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-foreground">{systemStatus}</span>
                  </div>
                  <div className="h-4 w-px bg-border"></div>
                  <span className="text-xs text-muted-foreground">6 robots activos</span>
                </div>
              </div>
            </div>

            {/* Right side - Notificaciones, STOP ALL, Perfil */}
            <div className="flex items-center space-x-3">
              {/* Theme Toggle */}
              <div className="relative">
                <button
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                  className="p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  {theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'light' ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                </button>
                {themeMenuOpen && (
                  <div className="absolute right-0 mt-2 w-32 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                    <button
                      onClick={() => { setTheme('light'); setThemeMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center"
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Claro
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setThemeMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center"
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Oscuro
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setThemeMenuOpen(false); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center"
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      Sistema
                    </button>
                  </div>
                )}
              </div>

              {/* Notificaciones */}
              <button className="relative p-2 text-foreground hover:bg-secondary rounded-lg transition-colors">
                <Bell className="h-5 w-5" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse">
                    {notifications}
                  </span>
                )}
              </button>

              {/* Botón de emergencia STOP ALL */}
              <button className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/90 transition-all duration-200 shadow-sm hover:shadow-md">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                STOP ALL
              </button>

              {/* Perfil de usuario */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="hidden md:block text-left">
                    <span className="text-sm font-medium text-foreground">Admin</span>
                    <p className="text-xs text-muted-foreground">Administrador</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-sm font-medium text-foreground">Admin</p>
                      <p className="text-xs text-muted-foreground">admin@atrizlab.edu.co</p>
                    </div>
                    <button className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Perfil
                    </button>
                    <button className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      Configuración
                    </button>
                    <div className="border-t border-border my-1"></div>
                    <button className="w-full px-3 py-2 text-left text-sm hover:bg-secondary flex items-center text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="p-6 fade-in">
          {children}
        </main>
      </div>

      {/* Toast Notifications */}
      <ToastNotifications />
    </div>
  )
}
