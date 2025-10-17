'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'

interface Toast {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

const mockToasts: Toast[] = [
  {
    id: '1',
    type: 'success',
    title: 'Despliegue completado',
    message: 'Despliegue completado en cluster-a',
    duration: 5000
  },
  {
    id: '2',
    type: 'error',
    title: 'Robot desconectado',
    message: 'RVR-003 desconectado',
    duration: 8000
  }
]

const getToastIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-success" />
    case 'warning':
      return <AlertCircle className="h-5 w-5 text-warning" />
    case 'error':
      return <AlertCircle className="h-5 w-5 text-destructive" />
    default:
      return <AlertCircle className="h-5 w-5 text-primary" />
  }
}

const getToastStyles = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-success/10 border-success/20 text-success-foreground'
    case 'warning':
      return 'bg-warning/10 border-warning/20 text-warning-foreground'
    case 'error':
      return 'bg-destructive/10 border-destructive/20 text-destructive-foreground'
    default:
      return 'bg-primary/10 border-primary/20 text-primary-foreground'
  }
}

export default function ToastNotifications() {
  const [toasts, setToasts] = useState<Toast[]>(mockToasts)

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  useEffect(() => {
    toasts.forEach(toast => {
      if (toast.duration) {
        const timer = setTimeout(() => {
          removeToast(toast.id)
        }, toast.duration)
        
        return () => clearTimeout(timer)
      }
    })
  }, [toasts])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`max-w-sm w-full bg-card border rounded-lg shadow-card p-4 ${getToastStyles(toast.type)}`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {getToastIcon(toast.type)}
            </div>
            <div className="ml-3 flex-1">
              <h4 className="text-sm font-medium">{toast.title}</h4>
              <p className="text-sm opacity-90 mt-1">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 flex-shrink-0 p-1 hover:bg-black/10 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
