'use client'

/**
 * El estado del enlace con UN robot: `SIN_CONEXION` · `EN_LINEA` · `SIN_DATOS`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 LAS DOS COSAS QUE ESTE COMPONENTE NO HACE
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. **No dice que el robot este roto.** `evaluarSalud()` devuelve siempre
 *    `esAveria: false`, y aqui se respeta: `SIN_DATOS` sale AMBAR con sus tres
 *    causas listadas y sin elegir entre ellas. La primera -«el robot esta
 *    cargando»: RVR apagado con la Raspberry Pi viva- es el estado COTIDIANO del
 *    laboratorio, y adivinar pintaria de rojo una tarde normal.
 *
 * 2. **No pinta `FRENANDO`.** Ese estado saldria de `/collision_monitor_state`,
 *    y este proyecto no ha caracterizado que significa cada valor de su
 *    `action_type` ni ha medido su caudal -`presupuesto.ts` lanza al
 *    encontrarlo, a proposito-. `useSalud` deja `frenando` en manos de quien
 *    llama, y aqui se pasa `false`, que **no es una afirmacion de que no frene**:
 *    es que no se sabe. El hueco se declara en la pantalla de diagnostico, con
 *    `LO_QUE_NO_SE_PUEDE_DECIR`, en vez de callarse.
 *
 * ⚠️ COSTE: `useSalud` se suscribe a `/odom` -13,05 kB/s por robot- porque es el
 * unico latido a 16,5 Hz, y los 3 s de `UMBRAL_SILENCIO_MS` estan calibrados
 * contra ese ritmo (son ~50 mensajes perdidos). Es asumible en la ficha de UN
 * robot y NO lo es en el muro de 16: el muro usa `resumirBaldosa()` con
 * `/motor_status` y su propio umbral. No se unifican.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { useSalud } from '@/hooks/useSalud'
import { Salud } from '@/lib/rosbridge/salud'
import { NOTA_SIN_DATOS, TITULO_EN_LINEA, TITULO_SIN_CONEXION, TITULO_SIN_DATOS } from '@/lib/interfaz/lenguaje'
import { Insignia, TonoInsignia } from '@/componentes/ui/Insignia'

const TONO: Readonly<Record<Salud['estado'], TonoInsignia>> = {
  SIN_CONEXION: 'NEUTRO',
  EN_LINEA: 'BIEN',
  // 🔴 AMBAR, nunca GRAVE. Ver la cabecera.
  SIN_DATOS: 'ATENCION',
}

const TITULO: Readonly<Record<Salud['estado'], string>> = {
  SIN_CONEXION: TITULO_SIN_CONEXION,
  EN_LINEA: TITULO_EN_LINEA,
  SIN_DATOS: TITULO_SIN_DATOS,
}

/** La pastilla para la cabecera. Se lee de un vistazo y no explica nada. */
export function InsigniaEnlace({ sobreBarra = false }: { sobreBarra?: boolean } = {}) {
  const { transporte } = useRobot()
  const salud = useSalud(transporte)
  return (
    <Insignia tono={TONO[salud.estado]} sobreBarra={sobreBarra}>
      {TITULO[salud.estado]}
    </Insignia>
  )
}

/**
 * El panel entero: el estado, y -cuando lo hay- lo que se sabe y lo que no.
 *
 * Las causas de `SIN_DATOS` salen tal cual de `salud.causasPosibles`: la lista y
 * su orden son de `lib/rosbridge/salud.ts`, no de este componente. Aqui solo se
 * pintan.
 */
export function PanelEnlace() {
  const { transporte, conectado } = useRobot()
  const salud = useSalud(transporte)

  return (
    // `px-5 py-4`: este panel es hijo directo de una `Tarjeta`, cuyo cuerpo va a
    // sangre para que las rejillas lleguen al canto. Sin esto su prosa quedaba
    // pegada al borde izquierdo, fuera de la columna del titulo.
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Insignia tono={TONO[salud.estado]}>{TITULO[salud.estado]}</Insignia>
        <span className="text-xs text-muted-foreground font-mono">
          WebSocket {conectado ? 'abierto' : 'cerrado'}
        </span>
      </div>

      {salud.estado === 'SIN_CONEXION' && (
        <p className="text-sm text-muted-foreground max-w-prose">
          El navegador no consigue abrir el WebSocket con este robot. Puede estar apagado, fuera de
          la red, o con el servicio parado. El cliente reintenta solo, con espera creciente de 1 s a
          30 s.
        </p>
      )}

      {salud.estado === 'SIN_DATOS' && (
        <div className="space-y-2">
          <p className="text-sm max-w-prose">
            El WebSocket está abierto y hace más de 3 s que no llega <code>/odom</code>. Las causas
            posibles, <strong>sin elegir entre ellas</strong>:
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1 max-w-prose">
            {salud.causasPosibles.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground max-w-prose">{NOTA_SIN_DATOS}</p>
        </div>
      )}

      {salud.estado === 'EN_LINEA' && (
        <p className="text-sm text-muted-foreground max-w-prose">
          Llega <code>/odom</code> desde hace menos de 3 s. Ese umbral es el mismo que usa el
          detector de silencio del propio driver, para que cliente y robot coincidan en cuándo algo
          va mal.
        </p>
      )}
    </div>
  )
}
