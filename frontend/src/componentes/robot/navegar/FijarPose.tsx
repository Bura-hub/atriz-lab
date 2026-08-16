'use client'

/**
 * DECIRLE AL ROBOT DÓNDE ESTÁ — el gesto que una vez lo puso a conducir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ ES UN MODO APARTE Y NO UN CLIC MÁS
 * ═══════════════════════════════════════════════════════════════════════════
 * AMCL arranca en (0,0) por su `set_initial_pose: true`. Si el robot no está
 * ahí, TODO lo que venga después está desplazado — y Nav2 dice `SUCCEEDED`
 * igual. Y no hay otra vía: este robot **no tiene rumbo absoluto**, así que la
 * pose de partida tiene que venir del operador.
 *
 * El mismo gesto —pulsar en el mapa— tiene que hacer dos cosas distintas, y una
 * de ellas MUEVE EL ROBOT. Con un solo modo, quien quisiera corregir la pose
 * lanzaría un objetivo de navegación.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 Y ESO PASÓ DE VERDAD, EL 2026-08-15, CON EL ROBOT DELANTE
 * ═══════════════════════════════════════════════════════════════════════════
 * Un arrastre dispara `mousedown → mouseup → CLICK` — el navegador sintetiza el
 * tercero. El manejador de `mouseup` publicaba la pose y hacía `setModoPose
 * (false)`; y **después** llegaba el `click`, cuya guarda era `if (modoPose)
 * return` — para entonces ya valía `false`. Así que pasaba, y **mandaba un
 * objetivo de navegación al punto donde se soltó**. El robot se puso en marcha
 * y se enredó con unos cables.
 *
 * **La guarda escrita para impedirlo se desactivaba a sí misma dos líneas antes.**
 *
 * 🔴 Y EL ARREGLO NO PUEDE SER UN `useState`: entre el `mouseup` y el `click`
 *    puede haber un re-render, y entonces el `click` corre con el valor nuevo.
 *    La marca vive en un `ref`, que se lee y escribe **síncrono** y no depende
 *    de cuándo repinte React — que es justo lo que no se puede razonar desde
 *    fuera.
 */

import { useCallback, useRef, useState } from 'react'
import { Transporte } from '@/lib/rosbridge/transporte'
import {
  LO_QUE_NO_SE_PUEDE_CONFIRMAR, mensajePoseInicial, poseDelGesto,
} from '@/lib/robot/pose_inicial'
import { PuntoDelMapa } from './LienzoMapa'

export interface FijarPose {
  modoPose: boolean
  alternar: () => void
  aviso: string | null
  alBajar: (p: PuntoDelMapa) => void
  alSoltar: (p: PuntoDelMapa) => void
  /**
   * Devuelve `true` si este `click` es el que sintetiza el navegador tras un
   * arrastre, y por tanto **hay que tragárselo**.
   *
   * 🔴 Consume la marca al llamarla: es de un solo uso a propósito. Si se
   *    limitara a consultarla, el siguiente clic legítimo también se perdería.
   */
  consumirClic: () => boolean
}

export function useFijarPose(transporte: Transporte): FijarPose {
  const [modoPose, setModoPose] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [arrastre, setArrastre] = useState<PuntoDelMapa | null>(null)
  const tragarSiguienteClic = useRef(false)

  const alternar = useCallback(() => {
    setModoPose((v) => !v)
    setAviso(null)
    setArrastre(null)
  }, [])

  const alBajar = useCallback((p: PuntoDelMapa) => {
    if (!modoPose) return
    setAviso(null)
    setArrastre(p)
  }, [modoPose])

  const alSoltar = useCallback((p: PuntoDelMapa) => {
    if (!modoPose || arrastre === null) return
    // Se limpia SIEMPRE y lo primero: si esto quedara detrás de una rama que
    // puede salir antes, un gesto rechazado dejaría el arrastre colgado.
    setArrastre(null)
    const arrastrePx = Math.hypot(p.px - arrastre.px, p.py - arrastre.py)
    /*
     * 🔴 SE MARCA **ANTES** DE DECIDIR NADA. El `click` sintetizado llega igual
     *    aunque la pose se rechace por falta de rumbo, así que ahí también hay
     *    que tragárselo. Ponerlo detrás del `if` es exactamente el defecto que
     *    enredó al robot con los cables.
     */
    tragarSiguienteClic.current = true
    const lectura = poseDelGesto({ x: arrastre.x, y: arrastre.y }, { x: p.x, y: p.y }, arrastrePx)
    if (!lectura.hay) { setAviso(lectura.motivo); return }
    try {
      transporte.publicar('/initialpose', mensajePoseInicial(lectura.pose))
      setAviso(LO_QUE_NO_SE_PUEDE_CONFIRMAR)
      setModoPose(false)
    } catch (err) {
      setAviso(`No he podido publicarla: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [modoPose, arrastre, transporte])

  const consumirClic = useCallback(() => {
    if (!tragarSiguienteClic.current) return false
    tragarSiguienteClic.current = false
    return true
  }, [])

  return { modoPose, alternar, aviso, alBajar, alSoltar, consumirClic }
}

export function ControlFijarPose({ fijar, deshabilitado }: { fijar: FijarPose; deshabilitado: boolean }) {
  const { modoPose, alternar, aviso } = fijar
  return (
    <div className="mt-4 border-t border-[rgb(var(--filo)/0.09)] pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={deshabilitado}
          onClick={alternar}
          className={`pulsable focus-ring rounded-md border px-3 py-1.5 text-[13px] ${
            modoPose
              ? 'border-[rgb(var(--estado-mirar)/0.5)] bg-[rgb(var(--estado-mirar)/0.12)]'
              : 'border-[rgb(var(--filo)/0.2)] hover:bg-[rgb(var(--vidrio)/0.06)]'
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          {modoPose ? 'Cancelar' : 'Decirle al robot dónde está'}
        </button>
        {modoPose && (
          <span className="text-[13px] text-[rgb(var(--estado-mirar))]">
            Pulsa donde está el robot y <strong>arrastra hacia donde mira</strong>, sin
            soltar. Mientras tanto no se mandan objetivos.
          </span>
        )}
      </div>

      {aviso !== null && (
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          {aviso.replace(/\*\*/g, '')}
        </p>
      )}

      {!modoPose && aviso === null && (
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          AMCL arranca creyendo que el robot está en el origen del mapa. Si no lo está —y
          tras un arranque en frío casi nunca lo está— todo lo que venga después sale
          desplazado, y <strong>Nav2 dirá que llegó igual</strong>. Este robot no tiene
          brújula: la pose de partida sólo puede dársela una persona.
        </p>
      )}
    </div>
  )
}
