'use client'

/**
 * POR QUÉ NO OBEDECE. La pantalla del robot que parece sano y no se mueve.
 *
 * La decisión de qué decir NO es de este componente: es de
 * `lib/robot/no_obedece.ts`, que es puro y tiene 10 pruebas detrás. Aquí solo
 * se pinta lo que aquella decide.
 *
 * ⚠️ Esta pantalla la propuso el análisis multiagente sobre el documento de
 *    plataforma, no el encargo original. Salió de dos lentes a la vez —«quien
 *    monta» y «seguridad»— y es la única de las diez que ataca directamente el
 *    modo de fallo mejor documentado del laboratorio.
 */

import { useEffect, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { Causa, EstadoCausa, diagnosticar, resumen } from '@/lib/robot/no_obedece'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const TONO: Readonly<Record<EstadoCausa, string>> = {
  CONFIRMADA: 'text-estado-ir',
  POSIBLE: 'text-estado-mirar',
  DESCARTADA: 'text-estado-vivo',
  NO_SE_SABE: 'text-estado-neutro',
}

const PALABRA: Readonly<Record<EstadoCausa, string>> = {
  CONFIRMADA: 'encaja',
  POSIBLE: 'puede ser',
  DESCARTADA: 'descartada',
  NO_SE_SABE: 'no se sabe',
}

/** Un icono por estado, dibujado. Nada de glifos Unicode ni emojis. */
function Marca({ estado }: { estado: EstadoCausa }) {
  const c = 'currentColor'
  return (
    <svg
      width="18" height="18" viewBox="0 0 20 20" fill="none"
      className={`${TONO[estado]} mt-0.5 shrink-0`} aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.2" stroke={c} strokeWidth="1.5" />
      {estado === 'CONFIRMADA' && <path d="M10 5.6v5.2M10 13.7v.6" stroke={c} strokeWidth="1.9" strokeLinecap="round" />}
      {estado === 'DESCARTADA' && <path d="M6.4 10.2l2.4 2.4 4.8-4.8" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
      {estado === 'NO_SE_SABE' && <path d="M6.8 10h6.4" stroke={c} strokeWidth="1.7" strokeLinecap="round" />}
      {estado === 'POSIBLE' && <path d="M10 6.2v4.6M10 13.4v.6" stroke={c} strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  )
}

function FilaCausa({ causa }: { causa: Causa }) {
  return (
    <li className="flex gap-3.5 px-5 py-4">
      <Marca estado={causa.estado} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <h3 className="text-[15px] font-semibold tracking-tight">{causa.titulo}</h3>
          <span className={`text-[11px] font-medium uppercase tracking-wider ${TONO[causa.estado]}`}>
            {PALABRA[causa.estado]}
          </span>
        </div>
        <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          {causa.evidencia}
        </p>
        {causa.remedio !== '' && (
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-foreground/85">
            {causa.remedio}
          </p>
        )}
      </div>
    </li>
  )
}

export function PanelNoObedece() {
  const { transporte, conectado } = useRobot()
  const estado = useTopic(transporte, '/estado_robot')
  const barrido = useTopic(transporte, '/scan')
  useLatido()

  /*
   * 🔴 La pestaña oculta es una CAUSA, así que hay que saber si lo está. El
   *    navegador limita los temporizadores a ~1 Hz en segundo plano y el
   *    vigilante del driver corta a los 0,3 s: el robot para, y desde fuera
   *    parece que no obedece.
   */
  const [oculta, setOculta] = useState(false)
  useEffect(() => {
    const mirar = () => setOculta(document.visibilityState === 'hidden')
    mirar()
    document.addEventListener('visibilitychange', mirar)
    return () => document.removeEventListener('visibilitychange', mirar)
  }, [])

  const causas = diagnosticar({
    conectado,
    paradaEmergencia: estado?.parada_emergencia ?? null,
    rvrResponde: estado?.rvr_responde ?? null,
    antiguedadOdomS: estado?.antiguedad_odom_s ?? null,
    reanudacionesFallidas: estado?.reanudaciones_fallidas ?? null,
    hayBarrido: barrido !== null,
    msDesdeBarrido: transporte.msDesdeUltimo('/scan'),
    pestanaOculta: oculta,
  })

  return (
    <div className="space-y-4">
      <Tarjeta
        titulo={resumen(causas)}
        subtitulo="En orden de probabilidad. No se elige una causa: se enseñan todas las que encajan."
      >
        <ul className="divide-y divide-[rgb(var(--filo)/0.09)]">
          {causas.map((c) => <FilaCausa key={c.id} causa={c} />)}
        </ul>
      </Tarjeta>

      {/*
        🔴 EL LÍMITE DE ESTA PANTALLA, EN LA PANTALLA.
        Que ninguna causa encaje no prueba que el robot obedezca. Callarlo
        convertiría esta pantalla en la falsa tranquilidad que existe para
        evitar.
      */}
      <Tarjeta titulo="Lo que esta pantalla no puede ver">
        <ul className="space-y-2.5 px-5 py-4 text-[13px] leading-relaxed text-muted-foreground">
          <li>
            · Que el <strong className="text-foreground/85">descriptor del LIDAR</strong> esté
            muerto tras apagar y encender el RVR con la Pi viva. El nodo sigue vivo y sus
            servicios contestan; se ve por SSH con{' '}
            <code className="font-mono">ls -l /proc/…/fd | grep tty</code>, y dice{' '}
            <code className="font-mono">(deleted)</code>.
          </li>
          <li>
            · Que el robot esté <strong className="text-foreground/85">contra una pared</strong>:
            el polígono de precaución frena al 40 % aunque se esté alejando, y un retroceso de
            30 cm puede hacer 14.
          </li>
          <li>
            · Que otra pestaña esté publicando en <code className="font-mono">cmd_vel_raw</code> a
            la vez. No hay autenticación, así que <strong className="text-foreground/85">nadie
            puede saberlo</strong>: dos bucles a 10 Hz producen un movimiento que no es el de
            ninguno de los dos.
          </li>
        </ul>
      </Tarjeta>
    </div>
  )
}
