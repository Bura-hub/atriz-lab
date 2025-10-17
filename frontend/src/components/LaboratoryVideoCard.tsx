'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, Square, Maximize, Wifi, WifiOff, Volume2, VolumeX, Settings, Download, Camera, Activity } from 'lucide-react'

export default function LaboratoryVideoCard() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const [quality, setQuality] = useState('1080p')
  const [fps, setFps] = useState(30)
  const [latency, setLatency] = useState(86)

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleRecord = () => {
    setIsRecording(!isRecording)
  }

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleMute = () => {
    setIsMuted(!isMuted)
  }

  // Simular cambios en la latencia
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 20) + 70)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="card overflow-hidden hover:shadow-lg transition-all duration-300">
      {/* Video Header mejorado */}
      <div className="gradient-primary text-primary-foreground px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-foreground/20 rounded-lg">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Video del Laboratorio</h3>
              <p className="text-sm text-primary-foreground/80">Stream en tiempo real</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-primary-foreground/20 text-primary-foreground px-3 py-1 rounded-full text-sm">
              {quality} @ {fps}fps
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span className="text-xs">En vivo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Video Player mejorado */}
      <div className="relative bg-muted aspect-video group">
        {/* Video Placeholder con animación */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
              <Play className="h-10 w-10 text-primary" />
            </div>
            <p className="text-muted-foreground font-medium">Stream del Laboratorio</p>
            <p className="text-xs text-muted-foreground mt-1">Cámara cenital - Laboratorio Atriz</p>
          </div>
        </div>

        {/* Controles de video */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center space-x-4">
            <button
              onClick={handlePlayPause}
              className="p-3 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 rounded-full transition-all duration-200"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            <button
              onClick={handleMute}
              className="p-3 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 rounded-full transition-all duration-200"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <button
              onClick={handleFullscreen}
              className="p-3 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 rounded-full transition-all duration-200"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Video Overlay mejorado */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span>Robots: 5</span>
              </div>
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Latencia: {latency}ms</span>
              </div>
              <div className="flex items-center space-x-2">
                <Camera className="h-4 w-4" />
                <span>{quality}</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4 text-success" />
                <div className="flex space-x-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 h-4 rounded transition-all duration-300 ${
                        i < 3 ? 'bg-success' : 'bg-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRecord}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    isRecording 
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Square className="h-4 w-4" />
                </button>
                <button className="p-2 bg-white/20 text-white hover:bg-white/30 rounded-lg transition-all duration-200">
                  <Settings className="h-4 w-4" />
                </button>
                <button className="p-2 bg-white/20 text-white hover:bg-white/30 rounded-lg transition-all duration-200">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recording Indicator mejorado */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg">
            <div className="w-2 h-2 bg-destructive-foreground rounded-full animate-pulse" />
            <span>GRABANDO</span>
            <div className="w-2 h-2 bg-destructive-foreground rounded-full animate-pulse" />
          </div>
        )}

        {/* Quality indicator */}
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs">
          {quality} • {fps}fps
        </div>
      </div>

      {/* Footer con estadísticas */}
      <div className="p-4 bg-muted/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>Resolución: {quality}</span>
            <span>•</span>
            <span>FPS: {fps}</span>
            <span>•</span>
            <span>Latencia: {latency}ms</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span>Stream activo</span>
          </div>
        </div>
      </div>
    </div>
  )
}
