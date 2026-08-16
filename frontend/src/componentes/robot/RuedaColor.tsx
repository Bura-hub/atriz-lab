'use client'

/**
 * LA RUEDA DE TONO Y EL PLANO DE INTENSIDAD.
 *
 * Los dos controles de apuntar y arrastrar. Los numeros —hexadecimal y los tres
 * canales— los pone `PanelLeds`, que es quien envia: aqui solo se elige.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL TONO SE RECUERDA, PORQUE `RGB -> HSV` PIERDE INFORMACION
 * ═══════════════════════════════════════════════════════════════════════════
 * `aHSV` de un gris devuelve tono 0, y no por descuido: **un gris no tiene
 * tono**, no hay ningun angulo que lo describa. Si el marcador se calculara
 * siempre desde el color entrante, bajar el brillo hasta el negro lo mandaria de
 * golpe al rojo delante del usuario, sin que nadie tocara la rueda.
 *
 * Por eso el tono vive en una `ref` y solo se actualiza cuando el color TIENE
 * tono. Es memoria de la interfaz, no estado del color: no cambia lo que se
 * envia al robot, solo donde se dibuja el punto.
 *
 * 📝 Se usa `ref` y no `useState` a proposito: cambiarlo no tiene que repintar
 *    nada —lo que repinta es el `color` que llega de fuera— y un `setState`
 *    durante el render seria un bucle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ ACCESIBILIDAD, Y SU LIMITE DICHO
 * ═══════════════════════════════════════════════════════════════════════════
 * La rueda es un `slider` de un eje y se maneja bien con el teclado. El plano
 * son DOS ejes y no existe un rol ARIA para eso; lleva `aria-valuetext` con los
 * dos numeros, que es lo mejor disponible, y **el camino garantizado son los
 * campos numericos de `PanelLeds`**: son `<input>` nativos y llegan al mismo
 * sitio. Un selector de color sin teclado seria un control solo para quien ve.
 */

import { useRef, type CSSProperties, type PointerEvent as PE } from 'react'
import { aHSV, aRGB, type RGB } from '@/lib/robot/color_led'
import { MuestraDeColor } from '@/componentes/robot/MuestraDeColor'

/**
 * La paleta del laboratorio: los tres bloques del muro y cinco tonos de sección.
 *
 * 🔴 NO son «colores bonitos»: son los que esta aplicacion ya usa para
 *    significar algo, asi que identificar un robot con el coral del muro se
 *    apoya en una asociacion que el profesor ya tiene hecha. Los valores estan
 *    COPIADOS de `globals.css` —un `.css` no exporta— y si alli cambian, aqui
 *    hay que cambiarlos a mano.
 *
 * ⚠️ Y lo que NO son: elegir uno aqui no cambia lo que ese color significa en el
 *    muro. Es un color para un LED, no un estado.
 */
const PALETA: readonly { nombre: string; rgb: RGB }[] = [
  { nombre: 'Cobalto', rgb: { rojo: 30, verde: 58, azul: 210 } },
  { nombre: 'Lima', rgb: { rojo: 132, verde: 163, azul: 12 } },
  { nombre: 'Coral', rgb: { rojo: 214, verde: 62, azul: 30 } },
  { nombre: 'Violeta', rgb: { rojo: 91, verde: 46, azul: 168 } },
  { nombre: 'Teal', rgb: { rojo: 6, verde: 118, azul: 140 } },
  { nombre: 'Ámbar', rgb: { rojo: 166, verde: 78, azul: 8 } },
  { nombre: 'Ciruela', rgb: { rojo: 130, verde: 44, azul: 96 } },
  { nombre: 'Blanco', rgb: { rojo: 255, verde: 255, azul: 255 } },
]

/** Donde cae el marcador de la rueda, en fraccion del radio. */
const RADIO_MARCA = 0.84

const PASO = 1
const PASO_GRANDE = 10

const pinza = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/**
 * El angulo de PANTALLA de un tono: grados desde las 12, en sentido horario.
 *
 * 🔴 El `+ 90` es literalmente el `from 90deg` de `.rueda-tono` en `globals.css`,
 *    que pone el rojo a las 3. Si uno cambia, el otro tambien — o el marcador se
 *    separa del color que dice señalar, que es el peor fallo posible aqui porque
 *    parece que el selector miente.
 */
const anguloDeTono = (tono: number) => tono + 90

export interface RuedaColorProps {
  color: RGB
  alCambiar: (c: RGB) => void
  desactivada?: boolean
}

export function RuedaColor({ color, alCambiar, desactivada = false }: RuedaColorProps) {
  const rueda = useRef<HTMLDivElement>(null)
  const plano = useRef<HTMLDivElement>(null)
  const tonoRecordado = useRef(0)

  const leido = aHSV(color)
  // Solo se cree el tono entrante si el color de verdad tiene uno.
  if (leido.saturacion > 0 && leido.valor > 0) tonoRecordado.current = leido.tono
  const hsv = { ...leido, tono: tonoRecordado.current }

  const mover = (parcial: Partial<typeof hsv>) => {
    if (desactivada) return
    alCambiar(aRGB({ ...hsv, ...parcial }))
  }

  const tonoDesdePuntero = (e: PE<HTMLDivElement>) => {
    const caja = rueda.current?.getBoundingClientRect()
    if (caja === undefined) return
    const dx = e.clientX - (caja.left + caja.width / 2)
    const dy = e.clientY - (caja.top + caja.height / 2)
    // `atan2(dx, -dy)` mide desde las 12 en sentido horario, el mismo sistema
    // que usa `conic-gradient`. Con `atan2(dy, dx)` el marcador giraria al reves.
    const grados = (Math.atan2(dx, -dy) * 180) / Math.PI
    const tono = ((grados - 90) % 360 + 360) % 360
    tonoRecordado.current = tono
    // 🔴 Si el color es negro o gris, mover la rueda no cambiaria NADA —el RGB
    //    sale igual— y el marcador se quedaria pegado. Se le da intensidad y
    //    brillo minimos para que el gesto tenga efecto visible.
    mover({
      tono,
      saturacion: hsv.saturacion === 0 ? 1 : hsv.saturacion,
      valor: hsv.valor === 0 ? 1 : hsv.valor,
    })
  }

  const svDesdePuntero = (e: PE<HTMLDivElement>) => {
    const caja = plano.current?.getBoundingClientRect()
    if (caja === undefined) return
    mover({
      saturacion: pinza((e.clientX - caja.left) / caja.width, 0, 1),
      valor: pinza(1 - (e.clientY - caja.top) / caja.height, 0, 1),
    })
  }

  /**
   * Arrastrar con captura del puntero.
   *
   * 🔴 `setPointerCapture` no es adorno: sin el, sacar el dedo del circulo corta
   *    el arrastre justo cuando se busca un tono en el borde, que es lo normal.
   *    Emil, literal: «once dragging starts, set the element to capture all
   *    pointer events».
   */
  const arrastrar = (aplicar: (e: PE<HTMLDivElement>) => void) => ({
    onPointerDown: (e: PE<HTMLDivElement>) => {
      if (desactivada) return
      e.currentTarget.setPointerCapture(e.pointerId)
      aplicar(e)
    },
    onPointerMove: (e: PE<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) aplicar(e)
    },
  })

  const anguloMarca = (anguloDeTono(hsv.tono) * Math.PI) / 180

  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* ── El tono ──────────────────────────────────────────────────────── */}
      <div
        ref={rueda}
        role="slider"
        tabIndex={desactivada ? -1 : 0}
        aria-label="Tono del color"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsv.tono)}
        aria-valuetext={`tono ${Math.round(hsv.tono)} grados`}
        aria-disabled={desactivada}
        onKeyDown={(e) => {
          const paso = e.shiftKey ? PASO_GRANDE : PASO
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault()
            tonoRecordado.current = (hsv.tono + paso) % 360
            mover({ tono: tonoRecordado.current })
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault()
            tonoRecordado.current = (hsv.tono - paso + 360) % 360
            mover({ tono: tonoRecordado.current })
          }
        }}
        {...arrastrar(tonoDesdePuntero)}
        className={`rueda-tono relative h-[124px] w-[124px] shrink-0 touch-none focus-ring ${
          desactivada ? 'opacity-40' : 'cursor-crosshair'
        }`}
      >
        <span
          className="marca-color"
          style={{
            left: `${50 + 50 * RADIO_MARCA * Math.sin(anguloMarca)}%`,
            top: `${50 - 50 * RADIO_MARCA * Math.cos(anguloMarca)}%`,
          }}
        />
      </div>

      {/* ── La intensidad y el brillo ────────────────────────────────────── */}
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
             `background-image` del atributo `style` antes de hidratar —es lo que
             `PanelLeds` midio en Edge—, y `--tono-grados` no es ninguna de las
             cuatro. Precedente vivo: `MarcoRobot.tsx:257` inyecta
             `--tono-seccion` en SSR y nunca ha dado ese aviso.
             📌 Y aunque lo diera: el primer pintado es constante, asi que no hay
                nada que discrepar. Esto es la segunda capa, no la unica.
        */
        /*
          🔴 ESTO FALTABA, y no era un aviso de lint: sin el, el plano solo
             respondia al TECLADO. Con el raton no se podia elegir ni intensidad
             ni brillo — o sea que la mitad del selector estaba muerta, con la
             rueda al lado funcionando y sin ningun error por ninguna parte.
             Lo delato `eslint` («'svDesdePuntero' is assigned a value but never
             used»), no `tsc` ni el navegador: una funcion sin usar compila.
        */
        {...arrastrar(svDesdePuntero)}
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

      {/* ── La paleta del laboratorio ────────────────────────────────────── */}
      <div className="min-w-[8.5rem]">
        <p className="microetiqueta mb-1.5">Paleta del laboratorio</p>
        <div className="grid w-fit grid-cols-4 gap-1.5">
          {PALETA.map((p) => (
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
        <p className="mt-1.5 max-w-[10rem] text-[11px] leading-snug text-muted-foreground">
          Son los colores del muro. Elegir uno aquí no cambia lo que significan allí.
        </p>
      </div>
    </div>
  )
}
