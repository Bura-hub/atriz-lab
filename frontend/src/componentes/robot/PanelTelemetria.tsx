'use client'

/**
 * Lo que el robot esta midiendo AHORA: bateria en voltios, motores con su
 * antiguedad, odometria, encoders y LEDs.
 *
 * ⚠️ `/odom` y `/encoders` van a 16,5 Hz, y aqui se leen MUESTREADOS cada 500 ms
 * (`useMuestreo`). No es solo por ahorrar re-renders: **un numero que parpadea
 * 16 veces por segundo no se puede leer**, y esta pantalla existe para mirarla.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { SIN_DATO, aGrados, grados, metros, metrosPorSegundo, numero, radianesPorSegundo, yawDeCuaternion } from '@/lib/interfaz/formato'
import { numeroValido } from '@/lib/interfaz/lecturas'
import { Dato } from '@/componentes/ui/Dato'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Bateria } from './Bateria'
import { EstadoMotores } from './EstadoMotores'
import { PanelLeds } from './PanelLeds'
import { useMuestreo } from './useMuestreo'

/** 7792 ticks por metro, contrastados contra cinta metrica. */
const TICKS_POR_METRO = 7792

function Odometria() {
  const { transporte } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/odom')

  const pos = ultimo?.pose?.pose?.position
  const yawRad = yawDeCuaternion(ultimo?.pose?.pose?.orientation)
  const lineal = ultimo?.twist?.twist?.linear
  const angular = ultimo?.twist?.twist?.angular

  return (
    <Tarjeta
      titulo="Odometría"
      subtitulo="Del locator del RVR, ya llevada al marco de ROS por el driver: rotación de −90° en posición y velocidad, y el yaw del arranque restado."
    >
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Dato etiqueta="Posición X" valor={metros(numeroValido(pos?.x))} />
        <Dato etiqueta="Posición Y" valor={metros(numeroValido(pos?.y))} />
        <Dato
          etiqueta="Rumbo (yaw)"
          valor={yawRad === null ? SIN_DATO : grados(aGrados(yawRad))}
          nota="Positivo = antihorario (REP-103), verificado contra el LIDAR."
        />
        <Dato
          etiqueta="Velocidad lineal"
          valor={metrosPorSegundo(numeroValido(lineal?.x))}
          referencia="meseta real 0,199 m/s pidiendo 0,20"
        />
        <Dato etiqueta="Velocidad angular" valor={radianesPorSegundo(numeroValido(angular?.z))} />
      </div>

      <p className="text-xs text-muted-foreground mt-3 max-w-prose">
        La deriva del rumbo es ~1000 veces mayor los primeros minutos tras encender el RVR: se
        midieron 0,97 °/30 s con el robot recién encendido y 0,001 °/30 s siete minutos después.
        Sobre una práctica de 15 min eso son decenas de grados, y poner la odometría a cero no lo
        corrige: pone el origen a cero, no la deriva. Desaparece sola dejando el robot un rato en
        marcha.
      </p>
      {ultimo === null && (
        <p className="text-xs text-muted-foreground mt-2">
          Todavía no ha llegado ningún <code>/odom</code>.
        </p>
      )}
    </Tarjeta>
  )
}

function Encoders() {
  const { transporte } = useRobot()
  const { ultimo } = useMuestreo(transporte, '/encoders')
  const izq = numeroValido(ultimo?.left_wheel_count)
  const der = numeroValido(ultimo?.right_wheel_count)

  return (
    <Tarjeta
      titulo="Encoders"
      subtitulo="La única fuente que no depende del marco de referencia. Calibrados contra cinta métrica: 7792 ticks/m."
    >
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Dato
          etiqueta="Rueda izquierda"
          valor={izq === null ? SIN_DATO : `${numero(izq, 0)} ticks`}
          nota={izq === null ? undefined : `${metros(izq / TICKS_POR_METRO)} recorridos`}
        />
        <Dato
          etiqueta="Rueda derecha"
          valor={der === null ? SIN_DATO : `${numero(der, 0)} ticks`}
          nota={der === null ? undefined : `${metros(der / TICKS_POR_METRO)} recorridos`}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-3 max-w-prose">
        Los ticks llegan CON signo: el driver ya convierte los 32 bits sin signo del RVR, donde un
        retroceso se veía como 4294965940 en vez de −1356.
      </p>
    </Tarjeta>
  )
}

export function PanelTelemetria() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Bateria />
        <EstadoMotores />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Odometria />
        <Encoders />
      </div>
      <PanelLeds />
    </div>
  )
}
