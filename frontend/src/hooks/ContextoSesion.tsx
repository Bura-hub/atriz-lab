'use client'

/**
 * QUIÉN ES QUIEN MIRA, para toda la aplicación.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ UN CONTEXTO Y NO UN `fetch` EN CADA SITIO
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo preguntan dos piezas que están lejos: el raíl —para enseñar la entrada de
 * `/usuarios` y el pie de sesión— y `BotonParada`, dentro del marco del robot.
 * Con un `fetch` en cada una habría **dos peticiones y dos verdades**, y la
 * segunda podría llegar antes o después: durante un instante el raíl diría que
 * hay sesión y la pantalla del robot que no. Es la misma razón por la que
 * `ProveedorRobot` tiene UNA teleoperación y no una por componente.
 *
 * ⚠️ Y LA RESPUESTA LA DA EL SERVIDOR, siempre. La cookie es `httpOnly`: el
 *    navegador **no puede leerla**, así que no hay forma de que este hook
 *    «deduzca» una sesión. Solo sabe lo que le contesta `/api/sesion/quien`,
 *    que revalida la firma en cada llamada.
 */

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface ValorSesion {
  /** El nombre de quien tiene la sesión, o `null` si no hay ninguna. */
  usuario: string | null
  /**
   * `profesor` | `alumno`, o `null` si no hay sesión **o la cuenta ya no
   * existe** —alguien la borró con la sesión abierta—.
   *
   * 🔴 Los dos casos dan `null` a propósito: en los dos, la interfaz no debe
   *    ofrecer nada que dependa del rol. Distinguirlos daría dos estados que se
   *    tratan igual.
   */
  rol: 'profesor' | 'alumno' | null
  /**
   * 🔴 `true` mientras no se sabe todavía, y **no es lo mismo que «no hay
   *    sesión»**. Sin este tercer estado, en el primer pintado el raíl
   *    parpadearía —enseñando la interfaz de invitado y cambiando medio segundo
   *    después—, y peor: el panel de liberación aparecería y desaparecería.
   *    Es la misma regla que el `null` de `/estado_robot`: no saber no es un no.
   */
  cargando: boolean
  /**
   * 🔴🔴 LA SESIÓN QUE HABÍA **SE ACABÓ SOLA**, sin que nadie pulsara «Salir».
   *
   * Sin esto, la caducidad a mitad de clase es un cambio **mudo**: el pie del
   * raíl pasa de decir tu nombre a decir «Entrar» y nada más, que es
   * indistinguible de haber salido a propósito. Quien está midiendo con una
   * cinta en la mano no mira el raíl — mira el robot, que de pronto deja de
   * contestar, y va a buscar la avería al sitio equivocado. Es exactamente el
   * diagnóstico que costó el 2026-08-16, con el reloj como causa en vez de la
   * puerta.
   *
   * ⚠️ Se apaga al volver a entrar y **no lo enciende `salir()`**: una salida
   *    deliberada no es una sorpresa y avisar de ella sería el ruido que
   *    entrena a no mirar.
   */
  caduco: boolean
  /**
   * Tras entrar o salir. Vuelve a preguntar al servidor.
   *
   * `motivo: 'salida'` dice que la desaparición de la sesión **estaba
   * prevista**, para que no se cuente como caducidad.
   */
  refrescar: (motivo?: 'salida') => Promise<void>
}

const Contexto = createContext<ValorSesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<string | null>(null)
  const [rol, setRol] = useState<'profesor' | 'alumno' | null>(null)
  const [expira, setExpira] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [caduco, setCaduco] = useState(false)
  /*
   * 🔴 UN `ref`, NO UN ESTADO. Se lee y escribe DENTRO de `refrescar`, y un
   *    estado ahí obligaría a meterlo en las dependencias del `useCallback`:
   *    `refrescar` cambiaría de identidad en cada respuesta, y con ella los tres
   *    `useEffect` que la tienen como dependencia — el temporizador de
   *    caducidad se reprogramaría solo, en bucle. Es la misma razón por la que
   *    la guarda del gesto del mapa tuvo que ser un `ref`.
   */
  const habiaSesion = useRef(false)

  const refrescar = useCallback(async (motivo?: 'salida') => {
    /** Un solo sitio donde se decide si la desaparición fue una sorpresa. */
    const fijar = (quien: string | null) => {
      if (quien === null && habiaSesion.current && motivo !== 'salida') setCaduco(true)
      if (quien !== null) setCaduco(false)
      habiaSesion.current = quien !== null
      setUsuario(quien)
    }
    try {
      const r = await fetch('/api/sesion/quien', { cache: 'no-store' })
      /*
       * 🔴 `quien` contesta **200 con `usuario: null`** cuando no hay sesión, no
       *    401. Antes devolvía 401 y este bloque lo trataba como el caso normal
       *    —lo decía un comentario aquí mismo—, pero el navegador no lee
       *    comentarios: pintaba una línea roja en la consola en cada carga de
       *    cada página, para el estado en el que están los alumnos siempre.
       *
       * El `else` NO sobra: un 500 por falta de `ATRIZ_SECRETO` sigue cayendo
       * ahí, y ahí sí no hay sesión posible.
       */
      if (r.ok) {
        const d = (await r.json()) as {
          usuario: string | null
          rol?: 'profesor' | 'alumno' | null
          expira?: number | null
        }
        fijar(typeof d.usuario === 'string' ? d.usuario : null)
        setRol(d.rol === 'profesor' || d.rol === 'alumno' ? d.rol : null)
        setExpira(typeof d.expira === 'number' ? d.expira : null)
      } else {
        fijar(null)
        setRol(null)
        setExpira(null)
      }
    } catch {
      /*
       * Si el servidor no contesta, **no hay sesión** hasta que se demuestre lo
       * contrario. Es el lado seguro: la alternativa —conservar la última que se
       * vio— dejaría el panel de liberación en pantalla con el servidor caído.
       *
       * 🔴 PERO ESTO NO ES UNA CADUCIDAD, y por eso NO pasa por `fijar()`. Que
       *    el servidor no conteste no dice nada sobre el testigo: decir «tu
       *    sesión ha caducado» ante un corte de red sería afirmar lo que no se
       *    ha medido, y encima mandaría a volver a entrar a quien no puede.
       *    `habiaSesion` se deja intacto: si la sesión seguía viva, la siguiente
       *    respuesta buena lo dirá.
       */
      setUsuario(null)
      setRol(null)
      setExpira(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void refrescar() }, [refrescar])

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴 LA CADUCIDAD A MITAD DE CLASE, QUE ERA EL PUNTO CIEGO
   * ═════════════════════════════════════════════════════════════════════════
   * Hasta hoy esto preguntaba **una sola vez, al montar**. Una sesión dura 8 h y
   * una clase 2, así que la primera del día puede vencer **dentro** de la
   * práctica — y entonces el raíl seguía **diciendo tu nombre** mientras el
   * testigo ya daba 401 y los robots dejaban de contestar. El único aviso vivía
   * en `/diagnostico`, que es la pantalla que nadie abre.
   *
   * 🔴 UN TEMPORIZADOR, NO UN SONDEO. Se sabe **cuándo** vence, así que no hay
   *    que preguntar cada N segundos: se pregunta una vez, justo al vencer. Un
   *    sondeo periódico sería tráfico permanente para un evento que ocurre una
   *    vez cada ocho horas.
   */
  useEffect(() => {
    if (expira === null) return
    const falta = expira - Date.now()
    /*
     * ⚠️ Si ya venció, se pregunta en el acto. Y `setTimeout` no admite esperas
     *    de más de ~24,8 días (desborda a 32 bits y dispara INMEDIATAMENTE, en
     *    bucle): con 8 h no ocurre, pero el tope se pone porque el día que
     *    alguien suba `DURACION_SESION_MS` esto se convertiría en un bucle
     *    ocupado, y nadie relacionaría las dos cosas.
     */
    const espera = Math.min(Math.max(falta + 1000, 0), 2 ** 31 - 1)
    const t = setTimeout(() => { void refrescar() }, espera)
    return () => clearTimeout(t)
  }, [expira, refrescar])

  /*
   * 🔴 Y AL VOLVER A LA PESTAÑA, porque el temporizador NO corre con el portátil
   *    suspendido — que es exactamente lo que pasa entre dos clases. Se pregunta
   *    al recuperar el foco, y solo si ha pasado un rato: sin esa guarda, cada
   *    alt-tab dispararía una petición.
   */
  useEffect(() => {
    let ultima = Date.now()
    const mirar = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultima < 60_000) return
      ultima = Date.now()
      void refrescar()
    }
    document.addEventListener('visibilitychange', mirar)
    window.addEventListener('focus', mirar)
    return () => {
      document.removeEventListener('visibilitychange', mirar)
      window.removeEventListener('focus', mirar)
    }
  }, [refrescar])

  return (
    <Contexto.Provider value={{ usuario, rol, cargando, caduco, refrescar }}>
      {children}
    </Contexto.Provider>
  )
}

/**
 * La sesión de esta pestaña.
 *
 * 📝 Devuelve un valor de invitado en vez de lanzar si nadie montó el proveedor:
 *    a diferencia de `useRobot()`, que sin proveedor significa un fallo de
 *    montaje, aquí «no hay sesión» es una respuesta perfectamente válida y no
 *    tiene por qué tumbar una pantalla.
 */
export function useSesion(): ValorSesion {
  return useContext(Contexto) ?? {
    usuario: null,
    rol: null,
    cargando: false,
    caduco: false,
    refrescar: async () => {},
  }
}
