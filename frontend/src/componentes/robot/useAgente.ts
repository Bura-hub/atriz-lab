'use client'

/**
 * EL SEGUNDO SOCKET: el que habla con el agente de sesión del robot.
 *
 * Vive junto al componente y no en `src/hooks/` a propósito — es la regla del
 * repositorio para los hooks que pertenecen a UNA pantalla, y `useMuestreo.ts`
 * es el precedente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 SON DOS ENLACES, Y LA PANTALLA TIENE QUE PODER DISTINGUIRLOS
 * ═══════════════════════════════════════════════════════════════════════════
 * El resto de la aplicación habla con **rosbridge en el 9090**. Esto habla con
 * el **agente en el 9443**, que es otro proceso y otro puerto.
 *
 * Consecuencia que no se puede tapar: **se puede ver la salida del programa con
 * la parada de emergencia muerta, y al revés**. La franja de seguridad del marco
 * usa el primero; esta pantalla usa los dos. Por eso el estado de cada uno se
 * enseña por separado y ninguno dice nada del otro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 EL TESTIGO SE PIDE ANTES DE CADA CONEXIÓN, Y NO SE GUARDA
 * ═══════════════════════════════════════════════════════════════════════════
 * Dura diez minutos y el agente solo lo mira **en el apretón de manos**: una vez
 * abierta la conexión, la caducidad ya no interviene. Así que no hace falta que
 * sobreviva a la clase, y como hoy viaja en claro —sin TLS, decisión tomada—
 * cada minuto de vida de más es ventana de fuga gratis.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SALIDA_VACIA, type Salida, anadir, cerrar as cerrarSalida, conRecorteDelAgente,
} from '@/lib/taller/salida'
import {
  TALLER_INICIAL, type EstadoTaller, tras, trasAbrir, trasCerrar,
} from '@/lib/taller/sesion_taller'
import { type OpTaller, leerMensaje, motivoDeCierre } from '@/lib/taller/protocolo'

/** El puerto del agente. rosbridge sigue en el 9090, intacto. */
export const PUERTO_AGENTE = 9443

/*
 * 🔴 SE IMPORTAN, NO SE REESCRIBEN. Aqui habia dos constantes con los mismos
 *    valores que las de `testigo_robot.ts`, y la auditoria del robot lo marco:
 *    «duplicados… divergen en silencio» (evidencia 117 §6).
 *
 *    Y divergir aqui no da un error legible: el navegador ofreceria un
 *    subprotocolo que el agente no reconoce, el agente no devolveria ninguno, y
 *    el socket se cerraria con **1006 y sin motivo** — el peor sintoma posible,
 *    porque no dice nada y se busca en el robot.
 */
import { PREFIJO_TESTIGO, SUBPROTOCOLO_AGENTE } from '@/lib/sesion/testigo_robot'

/**
 * 🔴 DIEZ SEGUNDOS PARA ABRIR, Y NO ES UN ADORNO.
 *
 * Está medido en este proyecto que un socket a una dirección que no contesta
 * **se cuelga sin llamar a `onclose` nunca**: un SYN sin respuesta tarda ~21 s
 * en rendirse. Sin este plazo, «el agente no está corriendo» y «se está
 * conectando» son indistinguibles para siempre.
 */
const PLAZO_ABRIR_MS = 10_000

export interface Agente {
  estado: EstadoTaller
  salida: Salida
  /** El texto del fichero que se acaba de pedir con `leer`. */
  fichero: { nombre: string; texto: string } | null
  enviar: (op: OpTaller) => boolean
  /** Vuelve a intentarlo desde cero: testigo nuevo y socket nuevo. */
  reintentar: () => void
  limpiarSalida: () => void
}

export function useAgente(numeroRobot: number | null, anfitrion: string): Agente {
  const [estado, setEstado] = useState<EstadoTaller>(TALLER_INICIAL)
  const [salida, setSalida] = useState<Salida>(SALIDA_VACIA)
  const [fichero, setFichero] = useState<{ nombre: string; texto: string } | null>(null)
  const [intento, setIntento] = useState(0)
  const socket = useRef<WebSocket | null>(null)

  const enviar = useCallback((op: OpTaller) => {
    const ws = socket.current
    if (ws === null || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(op))
    return true
  }, [])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])
  const limpiarSalida = useCallback(() => setSalida(SALIDA_VACIA), [])

  useEffect(() => {
    if (numeroRobot === null) {
      /*
       * 🔴 UN ROBOT ALCANZADO POR IP NO TIENE NÚMERO, y el testigo lleva `rob`
       *    dentro. No se puede firmar uno que abra: se dice, en vez de intentarlo
       *    y dejar que el agente cierre con un 4404 que parecería un fallo.
       */
      setEstado((e) => trasCerrar(e,
        'Este robot está abierto por su dirección IP, y el terminal necesita saber su número '
        + '(de 1 a 16) para pedir permiso. Entra por «/robot/7», con el número.'))
      return undefined
    }

    let vivo = true
    let ws: WebSocket | null = null
    let plazo: ReturnType<typeof setTimeout> | null = null

    setEstado((e) => trasAbrir(e))
    setSalida(SALIDA_VACIA)

    /*
     * El testigo se pide y solo entonces se abre. Si la petición falla, el
     * motivo se pinta tal cual: un 401 aquí significa «no has entrado», que se
     * arregla entrando, y no tiene nada que ver con el robot.
     */
    void (async () => {
      let testigo: string
      try {
        const r = await fetch(`/api/sesion/testigo?robot=${numeroRobot}`, { cache: 'no-store' })
        if (!vivo) return
        if (r.status === 401) {
          setEstado((e) => trasCerrar(e,
            'Hay que iniciar sesión para abrir el terminal: es lo único de esta aplicación '
            + 'que ejecuta código en el robot.'))
          return
        }
        const cuerpo = await r.json() as { testigo?: string; error?: string }
        if (!r.ok || typeof cuerpo.testigo !== 'string') {
          setEstado((e) => trasCerrar(e, cuerpo.error ?? 'El servidor no ha dado credencial.'))
          return
        }
        testigo = cuerpo.testigo
      } catch (e) {
        if (!vivo) return
        setEstado((x) => trasCerrar(x,
          `No he podido pedir la credencial al servidor: ${e instanceof Error ? e.message : String(e)}`))
        return
      }
      if (!vivo) return

      try {
        ws = new WebSocket(`ws://${anfitrion}:${PUERTO_AGENTE}`,
          [`${PREFIJO_TESTIGO}${testigo}`, SUBPROTOCOLO_AGENTE])
      } catch (e) {
        setEstado((x) => trasCerrar(x,
          `No he podido abrir el socket: ${e instanceof Error ? e.message : String(e)}`))
        return
      }
      socket.current = ws

      plazo = setTimeout(() => {
        if (ws !== null && ws.readyState === WebSocket.CONNECTING) {
          // Ver `PLAZO_ABRIR_MS`: sin esto, un socket colgado no llama a nada.
          try { ws.close() } catch { /* da igual */ }
          setEstado((e) => trasCerrar(e,
            `El agente de este robot no ha contestado en ${PLAZO_ABRIR_MS / 1000} s. `
            + 'Suele ser que no esté corriendo («systemctl status atriz-agente» en el robot), '
            + 'o que no se llegue a él por la red.'))
        }
      }, PLAZO_ABRIR_MS)

      ws.onopen = () => {
        if (plazo !== null) clearTimeout(plazo)
        // Lo primero: reengancharse a lo que hubiera, y pedir las prácticas.
        ws?.send(JSON.stringify({ op: 'atriz_adjuntar' }))
        ws?.send(JSON.stringify({ op: 'atriz_listar' }))
      }

      ws.onmessage = (ev) => {
        const m = leerMensaje(typeof ev.data === 'string' ? ev.data : '')
        if (m.clase === 'SALIDA') {
          setSalida((s) => anadir(s, m.texto))
          return
        }
        if (m.clase === 'FICHERO') {
          setFichero({ nombre: m.nombre, texto: m.texto })
          return
        }
        if (m.clase === 'RECORTE') {
          setSalida((s) => conRecorteDelAgente(s, m.lineasDescartadas))
        }
        if (m.clase === 'FIN') {
          // La última línea sin salto —un `input()` sin contestar— no se pierde.
          setSalida((s) => cerrarSalida(s))
        }
        setEstado((e) => tras(e, m))
      }

      ws.onclose = (ev) => {
        if (plazo !== null) clearTimeout(plazo)
        if (!vivo) return
        /*
         * 🔴 EL MOTIVO SE TRADUCE, y el del agente gana al nuestro. Un código a
         *    secas —«4404»— no le dice nada a un alumno; y el 1013 (la Pi sin
         *    hora) no es un fallo suyo ni de la web, se arregla esperando.
         */
        const traducido = motivoDeCierre(ev.code)
        const suyo = ev.reason !== '' ? ev.reason : ''
        setEstado((e) => trasCerrar(e, traducido !== ''
          ? (suyo !== '' ? `${traducido} (el robot dice: «${suyo}»)` : traducido)
          : (suyo !== '' ? suyo : 'La conexión con el agente se cerró.')))
      }

      ws.onerror = () => {
        // No se pinta nada aquí: `onerror` no trae motivo y `onclose` llega
        // detrás con el suyo. Escribir dos frases daría dos causas para un fallo.
      }
    })()

    return () => {
      vivo = false
      if (plazo !== null) clearTimeout(plazo)
      if (ws !== null) {
        ws.onopen = null
        ws.onmessage = null
        ws.onclose = null
        ws.onerror = null
        try { ws.close() } catch { /* ya estaba */ }
      }
      socket.current = null
    }
  }, [numeroRobot, anfitrion, intento])

  return { estado, salida, fichero, enviar, reintentar, limpiarSalida }
}
