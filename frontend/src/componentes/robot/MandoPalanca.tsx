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

import {
  CSSProperties, PointerEvent as EventoPuntero, ReactNode, useEffect, useRef, useState,
} from 'react'
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import { useRobot } from '@/hooks/ContextoRobot'
import {
  Ajustes, Curva, OrdenMando, V_MAX_DURO, V_MAX_SEGURO, V_MIN, W_MAX, W_MIN,
  ZONA_MUERTA, dentroDeLoMedido, ordenDePalanca, ordenDeTeclado,
} from '@/lib/interfaz/palanca'
import { metrosPorSegundo, numero } from '@/lib/interfaz/formato'
import { conTecla, direccionDeTecla, escribiendo, mandoVigente, sinTecla } from '@/lib/interfaz/teclado'

/** El radio útil, en píxeles CSS. La caja mide el doble. */
const RADIO = 84

export interface PropsPalanca {
  teleoperacion: ControlTeleoperacion
  /** Los dos techos y la curva. Los ponen los deslizadores. */
  ajustes: Ajustes
  alFallar: (mensaje: string) => void
  /** Para que la tarjeta pueda pintar lo que se está pidiendo AHORA. */
  alCambiar: (o: OrdenMando) => void
}

export function Palanca({ teleoperacion, ajustes, alFallar, alCambiar }: PropsPalanca) {
  const { conectado } = useRobot()
  const caja = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 AQUÍ SE CABLEA `dentroDeLoMedido`, QUE HASTA HOY NO CORRÍA EN NINGÚN SITIO
   * ═══════════════════════════════════════════════════════════════════════════
   * Su docstring decía que existía «para poder decirlo en pantalla», y ninguna
   * pantalla lo decía: solo lo llamaba su propia prueba. **Un control que
   * únicamente corre en su test no es un control** — es la familia de las doce
   * comprobaciones muertas del verificador del robot, y de `comprobar_contrato`
   * mirando que el `.msg` exista.
   *
   * Hoy siempre da `true` por construcción, y ese es justo el motivo de
   * cablearlo: es la comprobación que se pondrá en rojo el día que alguien toque
   * el remapeo, la curva o los techos y empiece a pedir valores que nadie ha
   * medido. Si no corre, ese día no dirá nada.
   *
   * ⚠️ NO bloquea la orden. Bloquearla convertiría un fallo de programación en un
   *    robot que no obedece, que es peor y además se diagnostica al revés.
   */
  const mandar = (o: OrdenMando) => {
    if (!dentroDeLoMedido(o, ajustes)) {
      alFallar(
        `La orden pedida (${numero(o.v, 3)} m/s · ${numero(o.w, 2)} rad/s) cae fuera de lo `
        + 'medido de este robot. Se ha enviado igual, pero el resultado no está caracterizado.',
      )
    }
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
    mandar(ordenDePalanca(dx, dy, RADIO, ajustes))
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
      /*
       * 🔴 `ordenDeTeclado`, NO la cuenta a mano que había aquí.
       *
       * Esto era `{ v: d.v * vMax, w: d.w * W_MAX }`: un SEGUNDO mapeo del mismo
       * invariante, escrito en el componente y sin ninguna prueba. Daba los
       * mismos números por casualidad —las teclas solo valen −1, 0 o 1— y al
       * abrir el techo del giro se habría quedado con el viejo, dejando teclado y
       * palanca girando a velocidades distintas sin que lo viera nada.
       */
      const o: OrdenMando = d === null ? { v: 0, w: 0 } : ordenDeTeclado(d, ajustes)
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
  }, [conectado, teleoperacion, ajustes, alFallar, alCambiar])

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

export interface PropsAjustes {
  ajustes: Ajustes
  alCambiar: (a: Ajustes) => void
  /** El pestillo del tramo rápido. Lo guarda quien monta la pantalla. */
  pestilloSuelto: boolean
  alSoltarPestillo: (suelto: boolean) => void
  desactivado: boolean
}

/**
 * Una regla con marcas y su valor al lado. Los dos deslizadores comparten
 * anatomía a propósito: son el mismo tipo de decisión sobre dos ejes.
 */
function Regla({ id, etiqueta, valor, min, max, paso, texto, desactivado, alCambiar, aviso }: {
  id: string
  etiqueta: string
  valor: number
  min: number
  max: number
  paso: number
  /** El valor ya formateado, con su unidad. */
  texto: string
  desactivado: boolean
  alCambiar: (v: number) => void
  aviso?: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="microetiqueta mb-1.5 block">{etiqueta}</label>
      <div className="flex items-center gap-4">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={paso}
          value={valor}
          disabled={desactivado}
          onChange={(e) => alCambiar(Number(e.target.value))}
          className="deslizador focus-ring w-full max-w-[18rem]"
        />
        <output htmlFor={id} className="cifra-menor shrink-0 tabular-nums">{texto}</output>
      </div>
      {aviso !== undefined && (
        <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          {aviso}
        </p>
      )}
    </div>
  )
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOS AJUSTES DEL MANDO — dos techos, un pestillo y una curva
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 Del encargo de «un control bastante más personalizado». Lo que entra y lo
 *    que no está razonado en `palanca.ts`; aquí solo se pinta.
 *
 * 🔴 ANTES SOLO HABÍA UN DESLIZADOR, Y TOPABA EL EJE PELIGROSO. El giro iba fijo
 *    entre 0,5 y 1,2 rad/s sin aparecer en pantalla, así que el alumno
 *    controlaba lo lineal —lo único que convierte velocidad en distancia— y no
 *    controlaba lo angular, que gira sobre el sitio y no puede alcanzar a nadie.
 *    Era al revés de lo razonable, y lo notó el usuario conduciendo.
 */
export function AjustesDelMando({
  ajustes, alCambiar, pestilloSuelto, alSoltarPestillo, desactivado,
}: PropsAjustes) {
  const techo = pestilloSuelto ? V_MAX_DURO : V_MAX_SEGURO
  return (
    <div className="space-y-5">
      <Regla
        id="vmax"
        etiqueta="velocidad máxima"
        valor={ajustes.vMax}
        min={V_MIN}
        max={techo}
        paso={0.01}
        texto={metrosPorSegundo(ajustes.vMax)}
        desactivado={desactivado}
        alCambiar={(v) => alCambiar({ ...ajustes, vMax: v })}
        aviso={<>
          Es el <strong>techo</strong>: la palanca pide una fracción de esto. Los extremos son
          valores <strong>medidos</strong> —pidiendo 0,20 la meseta real es 0,199 m/s, el 100 %—.
        </>}
      />

      {/*
        ═══════════════════════════════════════════════════════════════════════
        🔴 EL PESTILLO DEL TRAMO RÁPIDO
        ═══════════════════════════════════════════════════════════════════════
        👤 Decisión del usuario: el robot da 0,40 y esta pantalla llega, pero no
           de un roce del pulgar. Lo que sobrevive del argumento viejo no es
           «teleoperar a ciegas» —el alumno está en la sala mirando el robot— sino
           esto: **un mando continuo se recorre sin querer; una línea de Python se
           escribe a propósito.** El pestillo devuelve ese «a propósito».

        ⚠️ Y NO ES UN ROL DE PROFESOR. El Taller ya le da 0,40 al mismo alumno por
           el mismo topic con tres líneas de Python, así que un rol aquí sería
           teatro sobre una puerta abierta al lado.

        🔴 Las dos consecuencias van escritas y son MEDIDAS, no advertencias
           genéricas: una tranquiliza y la otra no, y las dos hacen falta para
           decidir.
      */}
      <div className="border-t border-[rgb(var(--filo)/0.09)] pt-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={pestilloSuelto}
            disabled={desactivado}
            onChange={(e) => alSoltarPestillo(e.target.checked)}
            className="focus-ring mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--estado-mirar))]"
          />
          <span className="text-[13px] leading-relaxed">
            <strong>Dejar llegar hasta 0,40 m/s</strong>, que es el tope del robot.
            <span className="mt-1 block text-muted-foreground">
              La capa de seguridad casi no se resiente: el hueco al parar sube de <strong>6,3
              a 7,4 cm</strong>, un centímetro. Lo que sí cambia es lo que el LIDAR no ve —
              barre a <strong>15,5 cm del suelo</strong>, y por debajo no hay ninguna
              protección—: ahí la velocidad es la única variable y la energía va con el
              cuadrado. Se vuelve a echar solo al perder el enlace.
            </span>
          </span>
        </label>
      </div>

      {/*
        🔴 EL GIRO LLEGA A 2,0 ENTERO, y no es una imprudencia simétrica: girar
           sobre el eje tiene desplazamiento CERO. Un robot a 2,0 rad/s no alcanza
           un pie ni cruza el pasillo — se queda dentro del círculo de 14,4 cm que
           ya ocupaba. Avanzar es la única componente que convierte velocidad en
           distancia. Por eso este eje se abre y el otro lleva pestillo.
      */}
      <Regla
        id="wmax"
        etiqueta="giro máximo"
        valor={ajustes.wMax}
        min={W_MIN}
        max={W_MAX}
        paso={0.1}
        texto={`${numero(ajustes.wMax, 1)} rad/s`}
        desactivado={desactivado}
        alCambiar={(v) => alCambiar({ ...ajustes, wMax: v })}
        aviso={<>
          Toda la franja está <strong>medida</strong>: entre 0,5 y 2,0 el robot cumple el
          99-102 % de lo que se le pide. A 2,0 da una vuelta en <strong>3,1 s</strong>, y a 1,2
          —donde arranca la pantalla— en 5,2.
        </>}
      />

      {/*
        La curva. Es una elección NOMBRADA y no un número: dos opciones que se
        entienden sin explicar, en vez de un exponente que nadie sabe dónde poner.
      */}
      <div>
        <span className="microetiqueta mb-1.5 block" id="curva-etiqueta">respuesta de la palanca</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="curva-etiqueta">
          {(['directa', 'suave'] as Curva[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={ajustes.curva === c}
              disabled={desactivado}
              onClick={() => alCambiar({ ...ajustes, curva: c })}
              className={`pulsable focus-ring rounded-md border px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-45 ${
                ajustes.curva === c
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-[rgb(var(--filo)/0.2)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          Con <strong>suave</strong>, media palanca pide la cuarta parte del rango: hay más
          finura cerca del centro para trazar un arco. Las dos llegan al mismo tope en el
          borde, y <strong>ninguna afecta al teclado</strong> — una tecla no tiene recorrido.
        </p>
      </div>
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
