'use client'

import { useState, useEffect } from 'react'
import RobotStatusCard from './RobotStatusCard'
import ActiveExperimentsCard from './ActiveExperimentsCard'
import SystemMetricsCard from './SystemMetricsCard'
import LaboratoryVideoCard from './LaboratoryVideoCard'

export default function Dashboard() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Simular carga inicial
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header del Dashboard */}
      <div className="fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard del Laboratorio</h1>
            <p className="text-muted-foreground mt-1">Monitoreo en tiempo real del sistema Atriz</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span>Sistema operacional</span>
          </div>
        </div>
      </div>

      {/* Grid 2x2 con animaciones escalonadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cuadrante Superior Izquierdo - Estado de Robots */}
        <div className={`lg:col-span-1 ${isLoaded ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
          <RobotStatusCard />
        </div>

        {/* Cuadrante Superior Derecho - Experimentos Activos */}
        <div className={`lg:col-span-1 ${isLoaded ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
          <ActiveExperimentsCard />
        </div>

        {/* Cuadrante Inferior Izquierdo - Métricas del Sistema */}
        <div className={`lg:col-span-1 ${isLoaded ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
          <SystemMetricsCard />
        </div>

        {/* Cuadrante Inferior Derecho - Video del Laboratorio */}
        <div className={`lg:col-span-1 ${isLoaded ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
          <LaboratoryVideoCard />
        </div>
      </div>
    </div>
  )
}
