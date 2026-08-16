'use client'

/**
 * LA PALANCA Y SU DESLIZADOR — el mando de la pantalla de conducir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 SUSTITUYE A LA CRUZ DE CUATRO BOTONES (2026-08-16, pedido del usuario)
 * ═══════════════════════════════════════════════════════════════════════════
 * *«los mandos no me acaban de gustar, debería haber algo como un joystick… la
 * velocidad debería poder regularse con un deslizador»*.
 *
 * Y la cruz tenía un límite real, no solo estético: **cuatro botones son cuatro
 * órdenes excluyentes**. Para trazar un arco había que pulsar «adelante»,
 * soltar, pulsar «izquierda» — conducir a saltos. Una palanca da las dos
 * componentes en un gesto.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA ARITMÉTICA NO ESTÁ AQUÍ, Y ES DONDE VIVE LA HONESTIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * `lib/interfaz/palanca.ts` remapea el gesto a la **franja medida** de este
 * robot: lineal desde 0,10 m/s, angular desde 0,5 rad/s. Una palanca continua
 * puede pedir 0,02 m/s, que con orugas probablemente ni arranque — y el alumno
 * concluye «no obedece» sobre un robot sano. 12 pruebas, incluido un barrido del
 * recorrido entero.
 *
 * ⚠️ **EL TECLADO SIGUE, y no es un duplicado**: la palanca es analógica y el
 *    teclado discreto. Quien quiere «exactamente 0,15 m/s en línea recta» lo
 *    tiene con una tecla; quien quiere describir una curva, con el dedo. Los dos
 *    usan el mismo techo del deslizador.
 */

import { CSSProperties, PointerEvent as EventoPuntero, useEffect, useRef, useState } from 'react'
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import { useRobot } from '@/hooks/ContextoRobot'
import { OrdenMando, W_MAX, W_MIN, ZONA_MUERTA, ordenDePalanca } from '@/lib/interfaz/palanca'
import { metrosPorSegundo, numero } from '@/lib/interfaz/formato'
import { conTecla, direccionDeTecla, escribiendo, mandoVigente, sinTecla } from '@/lib/interfaz/teclado'

/** El radio útil, en píxeles CSS. La caja mide el doble. */
const RADIO = 84

export interface PropsPalanca {
  teleoperacion: ControlTeleoperacion
  /** El techo lineal que haya puesto el deslizador, en m/s. */
  vMax: number
  alFallar: (mensaje: string) => void
  /** Para que la tarjeta pueda pintar lo que se está pidiendo AHORA. */
  alCambiar: (o: OrdenMando) => void
}

export function Palanca({ teleoperacion, vMax, alFallar, alCambiar }: PropsPalanca) {
  const { conectado } = useRobot()
  const caja = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const mandar = (o: OrdenMando) => {
    try {
      if (o.v === 0 && o.w === 0) teleoperacion.parar()
      else teleoperacion.mover(o.v, o.w)
    } catch (error) {
      alFallar(error instanceof Error ? error.message : String(error))
    }
    alCambiar(o)
  }

  const desde = (e: EventoPuntero<HTMLDivElement>) => {
    const c = caja.current
    if (c === null) return { dx: 0, dy: 0 }
    const r = c.getBoundingClientRect()
    return { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) }
  }

  const mover = (e: EventoPuntero<HTMLDivElement>) => {
    const { dx, dy } = desde(e)
    /*
     * El puño se dibuja recortado al círculo, igual que se recorta la orden: si
     * el dibujo se saliera mientras la orden ya está topada, la palanca estaría
     * enseñando un margen de control que no existe.
     */
    const m = Math.hypot(dx, dy)
    const k = m > RADIO ? RADIO / m : 1
    setPos({ x: dx * k, y: dy * k })
    mandar(ordenDePalanca(dx, dy, RADIO, vMax))
  }

  const soltar = () => {
    /*
     * 🔴 VUELVE AL CENTRO Y MANDA PARAR, EN ESE ORDEN DE IMPORTANCIA: lo que no
     *    puede fallar es el `parar()`. Una palanca que se queda donde la
     *    soltaste es un mando con la orden puesta y nadie sujetándola.
     */
    setPos(null)
    mandar({ v: 0, w: 0 })
  }

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * EL TECLADO, QUE VIVÍA EN LA CRUZ Y SE MUDA AQUÍ CON ELLA
   * ═══════════════════════════════════════════════════════════════════════════
   * ⚠️ Y **casi se pierde en la mudanza**: el efecto estaba dentro de
   *    `CruzDeMando`, así que al borrar la cruz se fue con ella. Lo cazó
   *    `eslint` avisando de cinco importaciones sin usar — ni `tsc` ni las
   *    pruebas lo habrían visto, porque un `useEffect` que ya no se monta no
   *    rompe nada: solo deja de funcionar.
   *
   * 🔴 NO ES UN DUPLICADO DE LA PALANCA. La palanca es **analógica** —una curva
   *    con el dedo— y el teclado **discreto**: quien quiere «recto y exactamente
   *    al techo» lo tiene con una tecla, sin pulso de por medio. Los dos usan el
   *    mismo `vMax` del deslizador, así que no hay dos verdades sobre la
   *    velocidad.
   *
   * 📌 Con el teclado se pide la deflexión COMPLETA, igual que la palanca en el
   *    borde: mantener una tecla es el gesto equivalente a llevar el puño al
   *    tope. El giro es `W_MAX`, que sustituye al 0,8 fijo de la cruz y está
   *    dentro de la banda medida.
   */
  const pulsadas = useRef<string[]>([])

  useEffect(() => {
    if (!conectado) return

    const aplicar = () => {
      const d = mandoVigente(pulsadas.current)
      const o: OrdenMando = d === null
        ? { v: 0, w: 0 }
        : { v: d.v * vMax, w: d.w * W_MAX }
      try {
        if (o.v === 0 && o.w === 0) teleoperacion.parar()
        else teleoperacion.mover(o.v, o.w)
      } catch (error) {
        alFallar(error instanceof Error ? error.message : String(error))
      }
      alCambiar(o)
    }

    const abajo = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement | null
      if (escribiendo(objetivo?.tagName ?? '', objetivo?.isContentEditable ?? false)) return
      if (direccionDeTecla(e.key) === null) return
      /*
       * ⚠️ Con un modificador NO se conduce. `Ctrl+ArrowLeft` es un atajo del
       *    sistema en varios navegadores, y `Alt+←` es «atrás» en el historial:
       *    quedarse con ellas robaría gestos que la persona espera que hagan
       *    otra cosa.
       */
      if (e.ctrlKey || e.altKey || e.metaKey) return
      /*
       * 🔴 Sin esto, «atrás» hace SCROLL DE LA PÁGINA mientras el robot anda —
       *    el mando se iría de la pantalla justo conduciendo, que es el defecto
       *    que este rediseño acaba de cerrar con la parada.
       */
      e.preventDefault()
      pulsadas.current = conTecla(pulsadas.current, e.key)
      aplicar()
    }

    const arriba = (e: KeyboardEvent) => {
      if (direccionDeTecla(e.key) === null) return
      pulsadas.current = sinTecla(pulsadas.current, e.key)
      aplicar()
    }

    /*
     * 🔴 AL PERDER EL FOCO SE PARA, Y NO ES CORTESÍA. Si alguien cambia de
     *    ventana con una tecla pulsada, el `keyup` **llega a la otra ventana**:
     *    aquí no se entera nadie y el robot se queda con la orden puesta hasta
     *    que el vigilante del driver corte a los 0,3 s. Que el watchdog lo salve
     *    no es excusa para mandarlo mal.
     */
    const soltarTodo = () => {
      if (pulsadas.current.length === 0) return
      pulsadas.current = []
      aplicar()
    }

    window.addEventListener('keydown', abajo)
    window.addEventListener('keyup', arriba)
    window.addEventListener('blur', soltarTodo)
    return () => {
      window.removeEventListener('keydown', abajo)
      window.removeEventListener('keyup', arriba)
      window.removeEventListener('blur', soltarTodo)
      soltarTodo()
    }
  }, [conectado, teleoperacion, vMax, alFallar, alCambiar])

  return (
    <div
      ref={caja}
      /*
       * 🔴 `touch-none`: sin esto, arrastrar sobre la palanca en una tableta
       *    **desplaza la página** y el navegador se queda el gesto a mitad —
       *    o sea, el robot con la última orden puesta y sin `pointerup`.
       */
      className={`palanca relative select-none touch-none ${conectado ? '' : 'opacity-60'}`}
      style={{ width: RADIO * 2, height: RADIO * 2 } as CSSProperties}
      onPointerDown={(e) => {
        if (!conectado) return
        e.currentTarget.setPointerCapture(e.pointerId)
        mover(e)
      }}
      onPointerMove={(e) => {
        if (!conectado || pos === null) return
        mover(e)
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onLostPointerCapture={soltar}
      role="application"
      aria-label="Palanca de conducción. También se conduce con las flechas o WASD."
    >
      {/* La zona muerta, dibujada: es lo que explica por qué un gesto pequeño no
          mueve nada, sin gastar una frase. */}
      <span
        aria-hidden="true"
        className="palanca-muerta"
        style={{ width: `${ZONA_MUERTA * 200}%`, height: `${ZONA_MUERTA * 200}%` }}
      />
      {/* Las dos guías. No son adorno: dicen que los ejes son independientes. */}
      <span aria-hidden="true" className="palanca-eje palanca-eje-h" />
      <span aria-hidden="true" className="palanca-eje palanca-eje-v" />
      <span
        aria-hidden="true"
        className={`palanca-puno ${pos === null ? 'palanca-puno-suelto' : ''}`}
        style={{ transform: `translate(${pos?.x ?? 0}px, ${pos?.y ?? 0}px)` }}
      />
    </div>
  )
}

export interface PropsDeslizador {
  valor: number
  alCambiar: (v: number) => void
  desactivado: boolean
}

/**
 * EL DESLIZADOR DE VELOCIDAD MÁXIMA.
 *
 * 👤 Pedido por el usuario. Antes eran **dos píldoras** —0,10 y 0,20— y el
 *    comentario que las defendía decía que las dos están medidas. Sigue siendo
 *    cierto y por eso las dos siguen **marcadas en la regla**: lo que cambia es
 *    que ahora se puede pedir cualquier valor entre ellas.
 *
 * 🔴 EL TECHO ES 0,20 Y NO 0,40, y esa decisión NO se toca aquí: está escrita
 *    —*«el tope del robot son 0,40 m/s y esta pantalla no lo ofrece; teleoperar
 *    a ciegas desde un navegador no es el sitio para la velocidad máxima»*— y
 *    revertirla sería una decisión de seguridad, no de interfaz.
 *
 * ⚠️ Y el suelo es 0,10, que es el mínimo MEDIDO. Por debajo no hay dato.
 */
export function DeslizadorVelocidad({ valor, alCambiar, desactivado }: PropsDeslizador) {
  return (
    <div>
      <label htmlFor="vmax" className="microetiqueta mb-1.5 block">
        velocidad máxima
      </label>
      <div className="flex items-center gap-4">
        <input
          id="vmax"
          type="range"
          min={0.1}
          max={0.2}
          step={0.01}
          value={valor}
          disabled={desactivado}
          onChange={(e) => alCambiar(Number(e.target.value))}
          className="deslizador focus-ring w-full max-w-[18rem]"
        />
        <output htmlFor="vmax" className="cifra-menor shrink-0 tabular-nums">
          {metrosPorSegundo(valor)}
        </output>
      </div>
      <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
        Es el <strong>techo</strong>: la palanca pide una fracción de esto. Los dos extremos son
        los valores <strong>medidos</strong> —pidiendo 0,20 la meseta real es 0,199 m/s, el
        100 %—. El tope del robot son 0,40 y esta pantalla no lo ofrece.
      </p>
    </div>
  )
}

/**
 * Lo que se está pidiendo AHORA MISMO, con la palanca o con el teclado.
 *
 * 🔴 EL GIRO SE PINTA CON SU FRANJA MEDIDA AL LADO. Antes decía «giro fijo a
 *    0,8 rad/s», que era verdad y ya no lo es: ahora es continuo entre 0,5 y
 *    1,2. Un número sin su rango no dice si es mucho o poco — que es la tesis de
 *    la escala impresa de la batería, aplicada aquí.
 */
export function LoQuePido({ orden }: { orden: OrdenMando }) {
  return (
    <div className="rejilla grid gap-px sm:grid-cols-2">
      <div className="px-4 py-3">
        <p className="microetiqueta">pido · lineal</p>
        <p className="cifra-menor mt-1">
          {numero(orden.v, 3)}
          <span className="unidad">m/s</span>
        </p>
      </div>
      <div className="px-4 py-3">
        <p className="microetiqueta">pido · giro</p>
        <p className="cifra-menor mt-1">
          {numero(orden.w, 2)}
          <span className="unidad">rad/s</span>
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          0 o entre {numero(W_MIN, 1)} y {numero(W_MAX, 1)}: es la franja donde está medido que
          el robot cumple el 99-102 %.
        </p>
      </div>
    </div>
  )
}
