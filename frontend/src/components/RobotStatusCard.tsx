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
      {/* Header con estadísticas */}
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
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span className="text-xs text-muted-foreground">En línea</span>
          </div>
        </div>
      </div>

      {/* Grid 3x2 de robots */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {mockRobots.map((robot) => (
          <div 
            key={robot.id} 
            className={`bg-muted rounded-lg p-4 transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-105 ${
              selectedRobot === robot.id ? 'ring-2 ring-primary bg-primary/5' : ''
            }`}
            onClick={() => setSelectedRobot(selectedRobot === robot.id ? null : robot.id)}
          >
            {/* Header del robot */}
            <div className="flex items-center justify-between mb-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(robot.status)} animate-pulse`}></div>
              <span className="text-xs font-medium text-muted-foreground">{robot.name}</span>
            </div>
            
            {/* Estado y métricas principales */}
            <div className="mb-3">
              <div className="text-sm font-medium text-card-foreground mb-2">
                {getStatusText(robot.status)}
              </div>
              
              {/* Batería */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Battery className="h-3 w-3 mr-1" />
                  <span>{robot.battery}%</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Activity className="h-3 w-3 mr-1" />
                  <span className={getTemperatureColor(robot.temperature)}>{robot.temperature}°C</span>
                </div>
              </div>

              {/* Barra de batería */}
              <div className="w-full bg-secondary rounded-full h-2 mb-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getBatteryColor(robot.battery)}`}
                  style={{ width: `${robot.battery}%` }}
                ></div>
              </div>

              {/* Señal WiFi */}
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-muted-foreground">
                  {robot.signal > 0 ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                  <span className={getSignalColor(robot.signal)}>{robot.signal}%</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>{robot.lastActivity}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer con acciones */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <span>Promedio batería: {Math.round(mockRobots.reduce((acc, robot) => acc + robot.battery, 0) / mockRobots.length)}%</span>
          <span>•</span>
          <span>Temperatura: {Math.round(mockRobots.reduce((acc, robot) => acc + robot.temperature, 0) / mockRobots.length)}°C</span>
        </div>
        <button className="flex items-center text-sm text-primary hover:text-primary/80 transition-colors group">
          Ver Todos
          <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  )
}
