'use client'

/**
 * LO QUE EL ROBOT VE. El barrido del YDLIDAR X2, dibujado en el marco del robot.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ESTA PANTALLA CUESTA DINERO, Y ES LA UNICA QUE LO HACE
 * ═══════════════════════════════════════════════════════════════════════════
 * `/scan` es el **83 % del trafico de un robot**: ~67 kB/s de los 80,7 medidos
 * navegando. Todas las demas pantallas juntas cuestan menos que esta sola.
 *
 * → Por eso la suscripcion vive AQUI y no en el marco del robot: al salir de la
 *   ruta, `useTopic` da de baja y el `unsubscribe` llega al robot de verdad.
 *   Dejarlo puesto por descuido en 16 pestañas serian ~8,6 Mbit/s sobre la unica
 *   AP del aula.
 * → Y por eso el coste se **enseña en pantalla**. Un tope silencioso se escribe:
 *   quien lo mira tiene que saber que esto no es gratis.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LO QUE NO SE DIBUJA, Y POR QUE
 * ═══════════════════════════════════════════════════════════════════════════
 * De 255 puntos por barrido, **226 son validos (89 %)**; el resto llegan como
 * `Infinity` o `NaN`. `puntosDelBarrido()` los descarta, y el recuento se enseña
 * para que ese 89 % se lea como NORMAL y no como averia. Pintar un hueco como 0
 * dibujaria un obstaculo pegado al robot que no existe — sobre una pantalla que
 * se usa para decidir si conducir, eso es peor que no dibujar nada.
 */

import { useEffect, useRef, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useTeleoperacion } from '@/hooks/useTeleoperacion'
import {
  Punto, contarValidos, distanciaMinima, escala, puntosDelBarrido,
} from '@/lib/interfaz/barrido'
import { interpretarSeguridad } from '@/lib/interfaz/seguridad'
import { numero } from '@/lib/interfaz/formato'
import { Aviso } from '@/componentes/ui/Aviso'
import { Insignia } from '@/componentes/ui/Insignia'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const LADO = 420          // px del lienzo, cuadrado
const RADIO_M = 2.5       // metros que caben del centro al borde

/** Dibuja el barrido. Toda la geometria viene ya resuelta de `barrido.ts`. */
function pintar(cv: HTMLCanvasElement, puntos: Punto[], oscuro: boolean): void {
  const ctx = cv.getContext('2d')
  if (ctx === null) return
  const k = escala(LADO, RADIO_M)
  const c = LADO / 2

  ctx.clearRect(0, 0, LADO, LADO)

  // Anillos de referencia cada medio metro, con su etiqueta.
  ctx.strokeStyle = oscuro ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)'
  ctx.fillStyle = oscuro ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)'
  ctx.font = '10px system-ui, sans-serif'
  ctx.lineWidth = 1
  for (let m = 0.5; m <= RADIO_M; m += 0.5) {
    ctx.beginPath()
    ctx.arc(c, c, m * k, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillText(`${m.toFixed(1)} m`, c + 3, c - m * k + 11)
  }

  // Los puntos. 🔴 x del robot va hacia ARRIBA en pantalla, e y hacia la
  // IZQUIERDA: es REP-103 (x adelante, y a la izquierda) girado para que
  // «adelante» se vea arriba, que es como lo mira una persona.
  ctx.fillStyle = oscuro ? 'rgb(125,211,252)' : 'rgb(2,132,199)'
  for (const p of puntos) {
    ctx.fillRect(c - p.y * k - 1.5, c - p.x * k - 1.5, 3, 3)
  }

  // El robot: 21,7 cm de ancho x 19,0 de largo, MEDIDO con cinta (con orugas).
  // La ficha de Sphero decia 0.218 x 0.185 y las dos estaban mal, ademas de
  // cruzadas. Se dibuja a escala para que el barrido tenga referencia real.
  ctx.strokeStyle = oscuro ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(c - (0.217 / 2) * k, c - (0.190 / 2) * k, 0.217 * k, 0.190 * k)
  // La proa, para que se vea hacia donde mira.
  ctx.beginPath()
  ctx.moveTo(c, c - (0.190 / 2) * k)
  ctx.lineTo(c, c - (0.190 / 2) * k - 10)
  ctx.stroke()
}

export function PanelLidar() {
  const { transporte } = useRobot()
  const scan = useTopic(transporte, '/scan')
  const monitor = useTopic(transporte, '/collision_monitor_state')
  const { arrancarBarrido } = useTeleoperacion(transporte)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [encendiendo, setEncendiendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const oscuro = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches

  useEffect(() => {
    if (lienzo.current === null || scan === null) return
    pintar(lienzo.current, puntosDelBarrido(scan), oscuro === true)
  }, [scan, oscuro])

  const seguridad = interpretarSeguridad(monitor)
  const cuenta = scan === null ? null : contarValidos(scan)
  const minima = scan === null ? null : distanciaMinima(scan)

  const encender = async () => {
    setEncendiendo(true)
    setFallo(null)
    try {
      await arrancarBarrido()
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e))
    } finally {
      setEncendiendo(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 🔴 El coste, en pantalla. Un tope silencioso se escribe. */}
      {/* 🔴 Este aviso INFRADECLARABA: solo mencionaba `/scan`, y esta pantalla
          abre DOS suscripciones. Un aviso de coste que se deja una fuera es
          justo el tipo de tope silencioso que la regla del proyecto obliga a
          escribir — y peor aún, porque suena a que ya lo ha contado todo. */}
      <Aviso nivel="NOTA" titulo="Esta pantalla consume ancho de banda">
        <code>/scan</code> es el <strong>83 % del tráfico</strong> de un robot (~67 kB/s):
        todas las demás pantallas juntas cuestan menos que esta. Y hay una segunda
        suscripción, <code>/collision_monitor_state</code>, <strong>cuyo caudal no está
        medido</strong> — publica al cambiar y no de forma periódica, así que en reposo
        no cuesta nada, pero nadie ha medido cuánto cuesta conduciendo.
        <br />
        Las dos se cierran solas al salir de esta pantalla.
      </Aviso>

      {seguridad.efecto !== 'DESCONOCIDO' && (
        <Aviso
          nivel={seguridad.efecto === 'BLOQUEA' ? 'ATENCION' : 'NOTA'}
          titulo="La capa de seguridad"
        >
          {seguridad.explicacion}
          {seguridad.queHacer !== '' && <> — <strong>{seguridad.queHacer}</strong>.</>}
        </Aviso>
      )}

      <Tarjeta
        titulo="Lo que el robot ve"
        subtitulo="barrido del LIDAR, en el marco del robot · arriba es «adelante»"
        extremo={
          cuenta === null
            ? <Insignia tono="NEUTRO">sin barrido</Insignia>
            : <Insignia tono="BIEN">{cuenta.validos} de {cuenta.total} puntos</Insignia>
        }
      >
        {scan === null ? (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No está llegando <code>/scan</code>. <strong>No es una avería</strong>: el barrido
              arranca apagado a propósito en los 16 robots, porque si no el LIDAR giraría a
              11,8&nbsp;Hz las 24&nbsp;horas.
            </p>
            <button
              type="button"
              onClick={encender}
              disabled={encendiendo}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {encendiendo ? 'esperando un barrido real…' : 'Encender el barrido'}
            </button>
            <p className="text-xs text-muted-foreground">
              Espera a que llegue un <code>/scan</code> de verdad, no a que el servicio responda:
              <code>/start_scan</code> ha devuelto éxito con el puerto del LIDAR muerto.
            </p>
            {fallo !== null && <Aviso nivel="ERROR" titulo="No se encendió">{fallo}</Aviso>}
          </div>
        ) : (
          <div className="space-y-3">
            <canvas
              ref={lienzo}
              width={LADO}
              height={LADO}
              className="mx-auto block max-w-full rounded-md border border-border"
            />
            <p className="text-center text-xs text-muted-foreground">
              lo más cercano: <strong>{minima === null ? 'no se sabe' : `${numero(minima, 2)} m`}</strong>
              {' · '}anillos cada 0,5 m
            </p>
            {/* 🔴 Este aviso es tan importante como el dibujo. */}
            <p className="mx-auto max-w-prose text-xs text-muted-foreground">
              Los puntos que faltan <strong>no son obstáculos ausentes</strong>: el X2 devuelve
              ~89&nbsp;% de lecturas válidas y el resto se descartan. Y un objeto fino de 5&nbsp;cm
              da 2-3 puntos a 0,68&nbsp;m, así que <strong>en un barrido suelto puede
              desaparecer</strong>. Sirve para orientarse, no para decidir que el paso está libre.
            </p>
          </div>
        )}
      </Tarjeta>
    </div>
  )
}
