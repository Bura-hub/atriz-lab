'use client'

import { User, Play, Pause, Square, Clock, FlaskConical, AlertCircle, CheckCircle, Timer } from 'lucide-react'
import { useState } from 'react'

interface ExperimentData {
  id: string
  user: string
  name: string
  robot: string
  progress: number
  elapsedTime: string
  status: 'running' | 'paused'
  priority: 'high' | 'medium' | 'low'
  estimatedTime: string
  errors: number
}

const mockExperiments: ExperimentData[] = [
  {
    id: '1',
    user: 'Dr. García',
    name: 'Navegación autónoma en enjambre',
    robot: 'RVR-002',
    progress: 65,
    elapsedTime: '12:34',
    status: 'running',
    priority: 'high',
    estimatedTime: '18:00',
    errors: 0
  },
  {
    id: '2',
    user: 'Ing. López',
    name: 'Algoritmo de formación',
    robot: 'RVR-005',
    progress: 28,
    elapsedTime: '04:10',
    status: 'running',
    priority: 'medium',
    estimatedTime: '15:30',
    errors: 2
  },
  {
    id: '3',
    user: 'Dra. Martínez',
    name: 'Detección de obstáculos',
    robot: 'RVR-001',
    progress: 90,
    elapsedTime: '19:02',
    status: 'paused',
    priority: 'low',
    estimatedTime: '21:00',
    errors: 1
  }
]

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-destructive text-destructive-foreground'
    case 'medium':
      return 'bg-warning text-warning-foreground'
    case 'low':
      return 'bg-success text-success-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

const getPriorityText = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'Alta'
    case 'medium':
      return 'Media'
    case 'low':
      return 'Baja'
    default:
      return 'Normal'
  }
}

export default function ActiveExperimentsCard() {
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null)
  const runningExperiments = mockExperiments.filter(exp => exp.status === 'running').length
  const totalErrors = mockExperiments.reduce((acc, exp) => acc + exp.errors, 0)

  return (
    <div className="card overflow-hidden hover:shadow-lg transition-all duration-300">
      {/* Header con gradiente */}
      <div className="gradient-primary text-primary-foreground px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-foreground/20 rounded-lg">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Experimentos en Ejecución</h3>
              <p className="text-sm text-primary-foreground/80">{runningExperiments} activos</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-primary-foreground/20 text-primary-foreground px-3 py-1 rounded-full text-sm">
              En cola: 2
            </div>
            {totalErrors > 0 && (
              <div className="bg-destructive/20 text-primary-foreground px-3 py-1 rounded-full text-sm flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                {totalErrors} errores
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {mockExperiments.map((experiment) => (
            <div 
              key={experiment.id} 
              className={`flex items-center space-x-4 p-4 bg-muted rounded-lg transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] ${
                selectedExperiment === experiment.id ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => setSelectedExperiment(selectedExperiment === experiment.id ? null : experiment.id)}
            >
              {/* Avatar del usuario con indicador de estado */}
              <div className="flex-shrink-0 relative">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center ${
                  experiment.status === 'running' ? 'bg-success' : 'bg-warning'
                }`}>
                  {experiment.status === 'running' ? (
                    <div className="w-2 h-2 bg-success-foreground rounded-full animate-pulse"></div>
                  ) : (
                    <Pause className="h-2 w-2 text-warning-foreground" />
                  )}
                </div>
              </div>

              {/* Información del experimento */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-medium text-card-foreground truncate">
                      {experiment.name}
                    </h4>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(experiment.priority)}`}>
                      {getPriorityText(experiment.priority)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">{experiment.robot}</span>
                    {experiment.errors > 0 && (
                      <div className="flex items-center text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {experiment.errors}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Barra de progreso circular mejorada */}
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-secondary"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={experiment.progress > 50 ? 'text-success' : experiment.progress > 25 ? 'text-warning' : 'text-destructive'}
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        strokeDasharray={`${experiment.progress}, 100`}
                        strokeLinecap="round"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-card-foreground">
                        {experiment.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Métricas de tiempo */}
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{experiment.elapsedTime}</span>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Timer className="h-3 w-3 mr-1" />
                      <span>ETA: {experiment.estimatedTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción mejorados */}
              <div className="flex items-center space-x-1">
                <button 
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    experiment.status === 'running' 
                      ? 'text-warning hover:bg-warning/10' 
                      : 'text-success hover:bg-success/10'
                  }`}
                  title={experiment.status === 'running' ? 'Pausar' : 'Reanudar'}
                >
                  {experiment.status === 'running' ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>
                <button 
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200"
                  title="Detener experimento"
                >
                  <Square className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer con estadísticas */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>Total errores: {totalErrors}</span>
              <span>•</span>
              <span>Tiempo promedio: 12:15</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3 text-success" />
              <span>Sistema estable</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
