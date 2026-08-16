'use client'

/**
 * EL SELECTOR DE COLOR: una tira de tono y un plano de intensidad y brillo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 AQUÍ HABÍA UNA RUEDA, Y MENTÍA EN LAS DOS DIRECCIONES
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 Lo vio el usuario: *«la rueda de color no permite desplazarse hacia
 *    adentro»*. Al mirarlo era peor que eso:
 *
 *   · la CSS dibujaba un disco HSV —blanco en el centro, tono puro al 72 %—, que
 *     es la forma universal de decir «el radio es la saturación», y el manejador
 *     **descartaba el radio**: `Math.hypot` no aparecía en el fichero. El
 *     **51,8 %** del área era rampa no seleccionable;
 *   · y el marcador iba clavado en el 84 % del radio, así que bajar la saturación
 *     con el plano dejaba el punto de la rueda **en el borde saturado**.
 *
 * O sea: no aceptaba el gesto que dibujaba **y** no dibujaba el estado que tenía.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ UNA TIRA Y NO «ARREGLAR EL RADIO»
 * ═══════════════════════════════════════════════════════════════════════════
 * Arreglar la rueda era posible y peor, por geometría: a radio `r` píxeles, un
 * píxel tangencial son `57,3/r` grados. En el borde son **1,1°/px** y a cinco
 * píxeles del centro **11,5°/px** — la zona que se acababa de abrir es justo
 * donde el tono se vuelve inmanejable. La tira da **2,9°/px en todo el
 * recorrido**.
 *
 * ✅ Y lo que de verdad decide: **una tira es un control de UN eje**, así que es
 *    un `<input type="range">` nativo. Teclado, Inicio/Fin, RePág/AvPág, lector
 *    de pantalla y `forced-colors` **sin escribir una línea de ARIA**. La rueda
 *    era un `div` con un `role="slider"` hecho a mano.
 *
 * ⚠️ El plano sigue siendo un control de DOS ejes y no existe un rol ARIA para
 *    eso. Lleva `aria-valuetext` con los dos números, que es lo mejor disponible,
 *    y **el camino garantizado son los campos numéricos de `PanelLeds`**: son
 *    `<input>` nativos y llegan al mismo sitio.
 *
 * 📌 Y la geometría que queda —la del plano— **ya no vive aquí**: está en
 *    `lib/interfaz/selector_color.ts`, con pruebas. Es la lección de los dos
 *    fallos anteriores de este mismo fichero: `src/componentes/` no se prueba
 *    nunca, así que lo que se quede dentro es invisible por construcción.
 */

import { useRef, type CSSProperties, type PointerEvent as PE } from 'react'
import { aHSV, aRGB, type RGB } from '@/lib/robot/color_led'
import {
  PALETA_IDENTIFICACION, PASO, PASO_GRANDE, conMemoria, svDesdePlano,
} from '@/lib/interfaz/selector_color'
import { MuestraDeColor } from '@/componentes/robot/MuestraDeColor'

const pinza = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export interface RuedaColorProps {
  color: RGB
  alCambiar: (c: RGB) => void
  desactivada?: boolean
}

export function RuedaColor({ color, alCambiar, desactivada = false }: RuedaColorProps) {
  const plano = useRef<HTMLDivElement>(null)
  /*
   * 🔴 LA MEMORIA DEL SELECTOR, en una `ref` y no en estado: cambiarla no tiene
   *    que repintar nada —lo que repinta es el `color` que llega de fuera— y un
   *    `setState` durante el render sería un bucle. La regla de qué se recuerda
   *    y por qué está en `conMemoria`, con su prueba.
   */
  const recordado = useRef({ tono: 0, saturacion: 1, valor: 1 })
  const hsv = conMemoria(recordado.current, aHSV(color))
  recordado.current = hsv

  const mover = (parcial: Partial<typeof hsv>) => {
    if (desactivada) return
    const nuevo = { ...hsv, ...parcial }
    recordado.current = nuevo
    alCambiar(aRGB(nuevo))
  }

  const svDesdePuntero = (e: PE<HTMLDivElement>) => {
    const caja = plano.current?.getBoundingClientRect()
    if (caja === undefined) return
    mover(svDesdePlano(e.clientX, e.clientY, caja))
  }

  /**
   * Arrastrar con captura del puntero.
   *
   * 🔴 `setPointerCapture` no es adorno: sin él, sacar el dedo del cuadro corta
   *    el arrastre justo cuando se busca un valor en el borde, que es lo normal.
   *    Emil, literal: «once dragging starts, set the element to capture all
   *    pointer events». Por eso `svDesdePlano` recorta: llegan coordenadas de
   *    fuera de la caja constantemente, y es lo que se quiere.
   */
  const arrastrar = {
    onPointerDown: (e: PE<HTMLDivElement>) => {
      if (desactivada) return
      e.currentTarget.setPointerCapture(e.pointerId)
      svDesdePuntero(e)
    },
    onPointerMove: (e: PE<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) svDesdePuntero(e)
    },
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-[15rem] flex-1">
        {/* ── El tono ────────────────────────────────────────────────────── */}
        <label htmlFor="tono-led" className="microetiqueta mb-1.5 block">tono</label>
        <input
          id="tono-led"
          type="range"
          min={0}
          max={359}
          step={PASO}
          value={Math.round(hsv.tono)}
          disabled={desactivada}
          onChange={(e) => {
            const tono = Number(e.target.value)
            /*
             * 🔴 Si el color es negro o gris, mover el tono no cambiaría NADA —el
             *    RGB sale igual— y el control parecería roto. Se le da intensidad
             *    y brillo mínimos para que el gesto tenga efecto visible.
             */
            mover({
              tono,
              saturacion: hsv.saturacion === 0 ? 1 : hsv.saturacion,
              valor: hsv.valor === 0 ? 1 : hsv.valor,
            })
          }}
          aria-valuetext={`tono ${Math.round(hsv.tono)} grados`}
          className="deslizador tira-tono focus-ring h-6 w-full rounded-md disabled:opacity-40"
        />

        {/* ── La intensidad y el brillo ──────────────────────────────────── */}
        <div className="mt-3 flex items-start gap-3">
          <div
            ref={plano}
            role="slider"
            tabIndex={desactivada ? -1 : 0}
            aria-label="Intensidad y brillo del color"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.saturacion * 100)}
            aria-valuetext={
              `intensidad ${Math.round(hsv.saturacion * 100)} %, `
              + `brillo ${Math.round(hsv.valor * 100)} %`
            }
            aria-disabled={desactivada}
            onKeyDown={(e) => {
              const paso = (e.shiftKey ? PASO_GRANDE : PASO) / 100
              const mapa: Record<string, Partial<typeof hsv>> = {
                ArrowRight: { saturacion: pinza(hsv.saturacion + paso, 0, 1) },
                ArrowLeft: { saturacion: pinza(hsv.saturacion - paso, 0, 1) },
                ArrowUp: { valor: pinza(hsv.valor + paso, 0, 1) },
                ArrowDown: { valor: pinza(hsv.valor - paso, 0, 1) },
              }
              const cambio = mapa[e.key]
              if (cambio !== undefined) { e.preventDefault(); mover(cambio) }
            }}
            /*
              🔴 UNA PROPIEDAD PERSONALIZADA, NO UN COLOR. El modo oscuro forzado
                 reescribe `background-color`, `color`, `border-color` y
                 `background-image` del atributo `style` antes de hidratar —es lo
                 que `PanelLeds` midió en Edge—, y `--tono-grados` no es ninguna
                 de las cuatro.
            */
            {...arrastrar}
            style={{ '--tono-grados': `${hsv.tono}deg` } as CSSProperties}
            className={`plano-sv relative h-[124px] w-[124px] shrink-0 touch-none rounded-md border border-border focus-ring ${
              desactivada ? 'opacity-40' : 'cursor-crosshair'
            }`}
          >
            <span
              className="marca-color"
              style={{ left: `${hsv.saturacion * 100}%`, top: `${(1 - hsv.valor) * 100}%` }}
            />
          </div>

          <p className="max-w-[13rem] text-[11px] leading-snug text-muted-foreground">
            El cuadro va de gris (izquierda) a color puro (derecha), y de negro (abajo) a brillo
            máximo (arriba). Con el teclado, las flechas mueven de uno en uno y con Mayúsculas de
            diez en diez.
          </p>
        </div>
      </div>

      {/* ── La paleta de identificación ──────────────────────────────────── */}
      <div className="min-w-[8.5rem]">
        <p className="microetiqueta mb-1.5">Para distinguir un robot</p>
        <div className="grid w-fit grid-cols-3 gap-1.5">
          {PALETA_IDENTIFICACION.map((p) => (
            <button
              key={p.nombre}
              type="button"
              disabled={desactivada}
              onClick={() => alCambiar(p.rgb)}
              title={p.nombre}
              className="rounded-md border border-border focus-ring transition-transform duration-150 active:scale-[0.94] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MuestraDeColor
                color={p.rgb}
                etiqueta={`Poner el color ${p.nombre}`}
                className="block h-7 w-7 rounded-[5px]"
              />
            </button>
          ))}
        </div>
        {/*
          🔴 ERA LA PALETA DEL MURO, Y ESA ES UNA PALETA DE PANTALLA. Sus ocho
             tonos están validados como TINTA SOBRE PAPEL: cinco por debajo del
             67 % de brillo, dos a 16° de tono —el mismo naranja como luz— y un
             agujero de 118° sin verde. Como fuente de luz fallaban. Es la misma
             familia que el sensor de color de este proyecto: **reflejar y emitir
             no son lo mismo.**
        */}
        <p className="mt-1.5 max-w-[10rem] text-[11px] leading-snug text-muted-foreground">
          Ocho tonos repartidos y a tope de brillo, más el blanco. Elegidos para verse desde el
          otro lado del aula, no para leerse en papel.
        </p>
      </div>
    </div>
  )
}
