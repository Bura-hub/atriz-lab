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

      <div className="p-4">
        <div className="space-y-3">
          {mockExperiments.map((experiment) => (
            <div 
              key={experiment.id} 
              className={`experiment-card-compact flex items-center space-x-4 p-3 cursor-pointer ${
                selectedExperiment === experiment.id ? 'ring-2 ring-primary bg-primary/5 border-primary/50' : ''
              }`}
              onClick={() => setSelectedExperiment(selectedExperiment === experiment.id ? null : experiment.id)}
            >
              {/* Avatar del usuario */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>

              {/* Progreso circular compacto */}
              <div className="flex items-center space-x-3">
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                    <path
                      className="text-secondary"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      d="M16 2 a 14 14 0 0 1 0 28 a 14 14 0 0 1 0 -28"
                    />
                    <path
                      className="text-success"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray={`${experiment.progress}, 100`}
                      strokeLinecap="round"
                      d="M16 2 a 14 14 0 0 1 0 28 a 14 14 0 0 1 0 -28"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-success">
                      {experiment.progress}%
                    </span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {experiment.elapsedTime}
                </div>
              </div>

              {/* Información del experimento */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-card-foreground truncate">
                  {experiment.name}
                </h4>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{experiment.robot}</span>
                  {experiment.errors > 0 && (
                    <div className="flex items-center text-destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {experiment.errors}
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de acción compactos */}
              <div className="flex items-center space-x-2">
                <button 
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                    experiment.status === 'running' 
                      ? 'bg-warning text-warning-foreground hover:bg-warning/90' 
                      : 'bg-success text-success-foreground hover:bg-success/90'
                  }`}
                  title={experiment.status === 'running' ? 'Pausar' : 'Reanudar'}
                >
                  {experiment.status === 'running' ? (
                    <>
                      <Pause className="h-3 w-3 inline mr-1" />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 inline mr-1" />
                      Reanudar
                    </>
                  )}
                </button>
                <button 
                  className="px-3 py-1 bg-destructive text-destructive-foreground rounded-lg text-xs font-medium hover:bg-destructive/90 transition-all duration-200"
                  title="Detener experimento"
                >
                  <Square className="h-3 w-3 inline mr-1" />
                  Detener
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
