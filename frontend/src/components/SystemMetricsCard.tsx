'use client'

import { Activity, Users, Cpu, HardDrive, ExternalLink, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface MetricData {
  label: string
  value: string
  status: 'good' | 'warning' | 'critical'
  progress?: number
  max?: string
  icon: React.ComponentType<{ className?: string }>
  trend: 'up' | 'down' | 'stable'
  change: string
}

const mockMetrics: MetricData[] = [
  {
    label: 'Latencia Promedio',
    value: '45ms',
    status: 'good',
    icon: Activity,
    trend: 'down',
    change: '-12%'
  },
  {
    label: 'Conexiones Activas',
    value: '12/50',
    status: 'good',
    progress: 24,
    icon: Users,
    trend: 'up',
    change: '+3'
  },
  {
    label: 'CPU Servidor',
    value: '34%',
    status: 'good',
    progress: 34,
    icon: Cpu,
    trend: 'stable',
    change: '0%'
  },
  {
    label: 'Memoria',
    value: '2.1GB/8GB',
    status: 'good',
    progress: 26,
    icon: HardDrive,
    trend: 'up',
    change: '+0.2GB'
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'good':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'critical':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

const getProgressColor = (status: string) => {
  switch (status) {
    case 'good':
      return 'bg-success'
    case 'warning':
      return 'bg-warning'
    case 'critical':
      return 'bg-destructive'
    default:
      return 'bg-secondary'
  }
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'up':
      return TrendingUp
    case 'down':
      return TrendingDown
    default:
      return Activity
  }
}

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'up':
      return 'text-success'
    case 'down':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

export default function SystemMetricsCard() {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setLastUpdate(new Date())
  }, [])

  // Evitar hidratación inconsistente
  if (!isClient) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-muted rounded w-1/2"></div>
            <div className="h-3 bg-muted rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      setLastUpdate(new Date())
    }, 1000)
  }

  const overallHealth = mockMetrics.every(metric => metric.status === 'good') ? 'good' : 
                       mockMetrics.some(metric => metric.status === 'critical') ? 'critical' : 'warning'

  return (
    <div className="card p-6 hover:shadow-lg transition-all duration-300">
      {/* Header con estado general */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">Rendimiento del Sistema</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                overallHealth === 'good' ? 'bg-success' : 
                overallHealth === 'warning' ? 'bg-warning' : 'bg-destructive'
              }`}></div>
              <span className="text-sm text-muted-foreground">
                {overallHealth === 'good' ? 'Todo operacional' : 
                 overallHealth === 'warning' ? 'Atención requerida' : 'Problemas detectados'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <div className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}>
              <Activity className="w-4 h-4" />
            </div>
          </button>
          <button className="flex items-center text-sm text-primary hover:text-primary/80 transition-colors">
            Ver Detalles
            <ExternalLink className="h-4 w-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Grid de métricas 2x2 mejorado */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {mockMetrics.map((metric, index) => {
          const Icon = metric.icon
          const TrendIcon = getTrendIcon(metric.trend)
          return (
            <div key={index} className="space-y-3 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-card-foreground">{metric.label}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-bold ${getStatusColor(metric.status)}`}>
                    {metric.value}
                  </span>
                  <div className={`flex items-center text-xs ${getTrendColor(metric.trend)}`}>
                    <TrendIcon className="h-3 w-3 mr-1" />
                    <span>{metric.change}</span>
                  </div>
                </div>
              </div>
              
              {metric.progress !== undefined && (
                <div className="space-y-2">
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(metric.status)}`}
                      style={{ width: `${metric.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span>{metric.progress}%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Gráfica mini de tendencia mejorada */}
      <div className="bg-muted rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-card-foreground">Tendencia 5 min</span>
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3 text-success" />
              <span className="text-xs text-muted-foreground">Estable</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <span>
              Última actualización: {isClient && lastUpdate ? lastUpdate.toLocaleTimeString() : 'Cargando...'}
            </span>
          </div>
        </div>
        <div className="h-20 bg-secondary rounded-lg p-2 flex items-end space-x-1">
          {[45, 52, 38, 65, 42, 58, 71, 49, 63, 55, 47, 69, 34, 56, 48, 72, 41, 59, 67, 53].map((height, i) => (
            <div
              key={i}
              className="bg-primary rounded-t transition-all duration-300 hover:bg-primary/80"
              style={{
                height: `${height}%`,
                width: '4px'
              }}
              title={`${height}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Hace 5 min</span>
          <span>Ahora</span>
        </div>
      </div>

      {/* Footer con resumen */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>Latencia promedio: 45ms</span>
            <span>•</span>
            <span>Uptime: 99.9%</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span>Sistema saludable</span>
          </div>
        </div>
      </div>
    </div>
  )
}
