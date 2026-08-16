'use client'

/**
 * EL MAPA DIBUJADO, Y LA CONVERSIÓN DE PÍXEL A MUNDO.
 *
 * Salió de `PanelNavegar` —715 líneas— porque es lo único de esa pantalla que
 * es puramente gráfico: la rejilla de ocupación, el robot encima, y traducir un
 * gesto del ratón a coordenadas del mapa. Quien venga a tocar el dibujo no
 * necesita leer nada de Nav2, y quien venga a tocar Nav2 no necesita leer esto.
 *
 * 🔴 EL COMPONENTE ENTREGA **PUNTOS, NO EVENTOS**. Es lo que permite que la
 *    lógica de arriba —mandar un objetivo, fijar la pose— no sepa nada de
 *    `getBoundingClientRect` ni de la escala CSS del lienzo. Y de paso deja la
 *    conversión en un solo sitio: antes estaba escrita **dos veces**, una en el
 *    manejador del clic y otra en `puntoDelEvento`, con el mismo cálculo copiado.
 */

import { useCallback, useEffect, useRef } from 'react'
import { MensajeMapa, MensajePoseConCovarianza } from '@/hooks/useTopic'
import { numeroValido } from '@/lib/interfaz/lecturas'
import { yawDeCuaternion } from '@/lib/interfaz/formato'
import { mundoAPixel, pixelAMundo, pixelesDeMapa } from '@/lib/robot/mapa'

/** Los tres colores del mapa. Salen del vocabulario, no de literales sueltos. */
const COLORES = {
  LIBRE: [246, 245, 243] as [number, number, number],
  OCUPADA: [30, 30, 36] as [number, number, number],
  // 🔴 Un gris CLARAMENTE distinto del libre: si se parecen, lo no explorado se
  //    lee como explorado y sobre eso se planifican rutas.
  DESCONOCIDA: [176, 178, 186] as [number, number, number],
}

/** Un punto del gesto, en píxeles del lienzo Y en metros del mapa. */
export interface PuntoDelMapa { px: number; py: number; x: number; y: number }

export interface PropsLienzo {
  mapa: MensajeMapa
  pose: MensajePoseConCovarianza | null
  /** Si `false`, el cursor lo dice: aquí no hay nada que pulsar. */
  interactivo: boolean
  alPulsar?: (p: PuntoDelMapa) => void
  alBajar?: (p: PuntoDelMapa) => void
  alSoltar?: (p: PuntoDelMapa) => void
}

export function LienzoMapa({ mapa, pose, interactivo, alPulsar, alBajar, alSoltar }: PropsLienzo) {
  const lienzo = useRef<HTMLCanvasElement | null>(null)

  /* ── Dibujar ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    const c = lienzo.current
    if (c === null) return
    const px = pixelesDeMapa(mapa.info, mapa.data, COLORES)
    // `null` = el mensaje no cuadra consigo mismo. No se dibuja nada: un mapa
    // plausible y equivocado es peor que un hueco.
    if (px === null) return
    c.width = mapa.info.width
    c.height = mapa.info.height
    const ctx = c.getContext('2d')
    if (ctx === null) return
    ctx.putImageData(new ImageData(px, mapa.info.width, mapa.info.height), 0, 0)

    // El robot, encima. Solo si AMCL ha dicho dónde está.
    const p = pose?.pose?.pose
    const x = numeroValido(p?.position?.x)
    const y = numeroValido(p?.position?.y)
    const yaw = yawDeCuaternion(p?.orientation)
    if (x === null || y === null) return
    const { px: cx, py: cy } = mundoAPixel(mapa.info, x, y)
    const radio = Math.max(2, 0.145 / mapa.info.resolution)   // el radio real del robot
    ctx.beginPath()
    ctx.arc(cx, cy, radio, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(190,42,22,0.85)'
    ctx.fill()
    if (yaw !== null) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      // −sin porque el eje Y del canvas apunta al revés que el del mundo.
      ctx.lineTo(cx + Math.cos(yaw) * radio * 2.4, cy - Math.sin(yaw) * radio * 2.4)
      ctx.strokeStyle = 'rgba(190,42,22,0.85)'
      ctx.lineWidth = Math.max(1, radio / 3)
      ctx.stroke()
    }
  }, [mapa, pose])

  /* ── Del gesto al mundo ──────────────────────────────────────────────── */
  /*
   * 🔴 `e.currentTarget` Y NO LA `ref`, y la diferencia importa: la `ref` es
   *    `HTMLCanvasElement | null`, así que convertir el gesto podía «fallar» y
   *    había que decidir qué hacer con ese fallo. La primera versión de este
   *    fichero se tragaba el evento cuando salía `null` — y eso habría dejado el
   *    estado de arrastre de «fijar pose» colgado para siempre, porque el
   *    `mouseup` que lo cierra nunca habría llegado.
   *
   *    `currentTarget` es el elemento al que está enganchado el manejador: dentro
   *    de un manejador del lienzo **es el lienzo, siempre**. Así el caso
   *    imposible deja de existir en vez de necesitar una rama que lo trate mal.
   */
  const punto = useCallback((e: React.MouseEvent<HTMLCanvasElement>): PuntoDelMapa => {
    const c = e.currentTarget
    const caja = c.getBoundingClientRect()
    // Del píxel de PANTALLA al píxel del lienzo: el lienzo se escala con CSS.
    const px = ((e.clientX - caja.left) / caja.width) * c.width
    const py = ((e.clientY - caja.top) / caja.height) * c.height
    return { px, py, ...pixelAMundo(mapa.info, px, py) }
  }, [mapa])

  const reenviar = (f?: (p: PuntoDelMapa) => void) => (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (f !== undefined) f(punto(e))
  }

  return (
    <canvas
      ref={lienzo}
      onClick={reenviar(alPulsar)}
      onMouseDown={reenviar(alBajar)}
      onMouseUp={reenviar(alSoltar)}
      /*
        🔴🔴 EL TAMAÑO DEL MAPA, EN DOS INTENTOS FALLIDOS Y UNO BUENO.
             Las tres versiones se vieron en captura; ninguna la vio tsc.

        1. `w-full` a secas: un mapa de 69×82 celdas se estiraba a ~1050 px de
           ancho y **1250 de alto**. Ocupaba la pantalla entera y había que hacer
           scroll para ver un cuarto de 3,45 × 4,10 m.
        2. `max-h-[62vh] w-auto`: el tope de altura **nunca entraba**, porque
           `w-auto` toma el ancho INTRÍNSECO del lienzo —69 px—. El mapa salió
           como una miniatura de 70×85. Cambiar un defecto por su opuesto.
        3. Esta: el tope de ALTURA se traduce a un tope de ANCHO con la
           proporción real del mapa, así que crece todo lo que puede sin pasarse
           de alto y **sin deformarse**. Un mapa cuadrado y uno apaisado se
           comportan los dos bien.

        `image-rendering: pixelated`: una celda son 5 cm, y suavizarlas
        inventaría paredes intermedias que el robot no ve.
      */
      style={mapa.info.height > 0
        ? { width: `min(100%, calc(62vh * ${mapa.info.width / mapa.info.height}))` }
        : undefined}
      className={`mx-auto block h-auto rounded-md border border-[rgb(var(--filo)/0.16)] [image-rendering:pixelated] ${
        interactivo ? 'cursor-crosshair' : 'cursor-not-allowed'
      }`}
    />
  )
}
