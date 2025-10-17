'use client'

import { Bot, Battery, Clock, ArrowRight, Wifi, WifiOff, Activity } from 'lucide-react'
import { useState } from 'react'

interface RobotData {
  id: string
  name: string
  status: 'connected' | 'disconnected' | 'busy'
  battery: number
  lastActivity: string
  signal: number
  temperature: number
}

const mockRobots: RobotData[] = [
  { id: '1', name: 'RVR-001', status: 'connected', battery: 82, lastActivity: '2m', signal: 85, temperature: 42 },
  { id: '2', name: 'RVR-002', status: 'busy', battery: 55, lastActivity: '5m', signal: 72, temperature: 38 },
  { id: '3', name: 'RVR-003', status: 'disconnected', battery: 12, lastActivity: '9m', signal: 0, temperature: 0 },
  { id: '4', name: 'RVR-004', status: 'connected', battery: 68, lastActivity: '1m', signal: 91, temperature: 45 },
  { id: '5', name: 'RVR-005', status: 'busy', battery: 44, lastActivity: '3m', signal: 68, temperature: 41 },
  { id: '6', name: 'RVR-006', status: 'connected', battery: 91, lastActivity: '0m', signal: 95, temperature: 39 },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected':
      return 'bg-success'
    case 'busy':
      return 'bg-warning'
    case 'disconnected':
      return 'bg-destructive'
    default:
      return 'bg-muted'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'connected':
      return 'Conectado'
    case 'busy':
      return 'Ocupado'
    case 'disconnected':
      return 'Desconectado'
    default:
      return 'Desconocido'
  }
}

const getBatteryColor = (battery: number) => {
  if (battery > 60) return 'bg-success'
  if (battery > 30) return 'bg-warning'
  return 'bg-destructive'
}

const getSignalColor = (signal: number) => {
  if (signal > 80) return 'text-success'
  if (signal > 50) return 'text-warning'
  return 'text-destructive'
}

const getTemperatureColor = (temp: number) => {
  if (temp > 50) return 'text-destructive'
  if (temp > 40) return 'text-warning'
  return 'text-success'
}

export default function RobotStatusCard() {
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null)
  const connectedRobots = mockRobots.filter(robot => robot.status === 'connected').length
  const totalRobots = mockRobots.length

  return (
    <div className="card p-6 hover:shadow-lg transition-all duration-300">
      {/* Header con estadísticas mejorado */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-card-foreground">Robots Activos</h3>
            <p className="text-sm text-muted-foreground">{connectedRobots}/{totalRobots} conectados</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground">En línea</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>6/18</span>
          </div>
        </div>
      </div>

      {/* Grid 2x3 de robots minimalista */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {mockRobots.map((robot) => (
          <div 
            key={robot.id} 
            className={`robot-card-minimal p-4 cursor-pointer ${
              selectedRobot === robot.id ? 'ring-2 ring-primary bg-primary/5 border-primary/50' : ''
            }`}
            onClick={() => setSelectedRobot(selectedRobot === robot.id ? null : robot.id)}
          >
            {/* Header minimalista: Estado + ID + Tiempo */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(robot.status)} animate-pulse`}></div>
                <span className="text-lg font-bold text-card-foreground">{robot.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">{robot.lastActivity}</span>
            </div>
            
            {/* Badge de estado */}
            <div className="mb-3">
              <span className={`status-badge-minimal ${
                robot.status === 'connected' ? 'connected' :
                robot.status === 'busy' ? 'busy' :
                'disconnected'
              }`}>
                {getStatusText(robot.status)}
              </span>
            </div>
            
            {/* Barra de progreso */}
            <div className="mb-3">
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${getBatteryColor(robot.battery)}`}
                  style={{ width: `${robot.battery}%` }}
                ></div>
              </div>
            </div>

            {/* Información de batería y última actividad */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-card-foreground">{robot.battery}%</span>
              <span className="text-sm text-muted-foreground">Última act. {robot.lastActivity}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer con acciones mejorado */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <span>Promedio batería: {Math.round(mockRobots.reduce((acc, robot) => acc + robot.battery, 0) / mockRobots.length)}%</span>
          <span>•</span>
          <span>Temperatura: {Math.round(mockRobots.reduce((acc, robot) => acc + robot.temperature, 0) / mockRobots.length)}°C</span>
        </div>
        <button className="flex items-center px-4 py-2 bg-card border border-border rounded-lg text-sm text-card-foreground hover:bg-muted hover:border-primary/30 hover:shadow-sm transition-all duration-200 group">
          Ver Todos
          <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  )
}
