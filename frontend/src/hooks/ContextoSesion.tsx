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

import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface ValorSesion {
  /** El nombre de quien tiene la sesión, o `null` si no hay ninguna. */
  usuario: string | null
  /**
   * 🔴 `true` mientras no se sabe todavía, y **no es lo mismo que «no hay
   *    sesión»**. Sin este tercer estado, en el primer pintado el raíl
   *    parpadearía —enseñando la interfaz de invitado y cambiando medio segundo
   *    después—, y peor: el panel de liberación aparecería y desaparecería.
   *    Es la misma regla que el `null` de `/estado_robot`: no saber no es un no.
   */
  cargando: boolean
  /** Tras entrar o salir. Vuelve a preguntar al servidor. */
  refrescar: () => Promise<void>
}

const Contexto = createContext<ValorSesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  const refrescar = useCallback(async () => {
    try {
      const r = await fetch('/api/sesion/quien', { cache: 'no-store' })
      if (r.ok) {
        const d = (await r.json()) as { usuario: string }
        setUsuario(d.usuario)
      } else {
        // 401 es la respuesta normal de quien no ha entrado: no es un error.
        setUsuario(null)
      }
    } catch {
      /*
       * Si el servidor no contesta, **no hay sesión** hasta que se demuestre lo
       * contrario. Es el lado seguro: la alternativa —conservar la última que se
       * vio— dejaría el panel de liberación en pantalla con el servidor caído.
       */
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void refrescar() }, [refrescar])

  return (
    <Contexto.Provider value={{ usuario, cargando, refrescar }}>
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
    cargando: false,
    refrescar: async () => {},
  }
}
