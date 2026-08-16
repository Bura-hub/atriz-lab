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

import Link from 'next/link'
import { useRobot } from '@/hooks/ContextoRobot'
import { useSesion } from '@/hooks/ContextoSesion'
import { useSalud } from '@/hooks/useSalud'
import { Salud } from '@/lib/rosbridge/salud'
import { evaluarPrecondicion, hayQueAvisar } from '@/lib/rosbridge/precondicion'
import { TESTIGO_EXIGIDO } from '@/lib/rosbridge/proveedor_testigo'
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

/*
 * 📝 AQUI VIVIO UN `InsigniaEnlaceSobreCampo`, Y SE BORRO AL DEJAR DE HACER
 *    FALTA: la insignia ya no va sobre el campo de color de la cabecera, va en
 *    la franja de signos vitales, que es de papel. La leccion que lo motivo esta
 *    escrita donde volveria a morder — el comentario de `.campo-seccion` en
 *    `globals.css` —, porque no es de este componente: es de cualquier cosa que
 *    alguien decida poner encima de un campo saturado.
 */

/**
 * El panel entero: el estado, y -cuando lo hay- lo que se sabe y lo que no.
 *
 * Las causas de `SIN_DATOS` salen tal cual de `salud.causasPosibles`: la lista y
 * su orden son de `lib/rosbridge/salud.ts`, no de este componente. Aqui solo se
 * pintan.
 */
export function PanelEnlace() {
  const { robot, transporte, conectado, ultimoAviso } = useRobot()
  const salud = useSalud(transporte)
  const { usuario, cargando } = useSesion()

  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴 POR QUE ESTE PANEL PREGUNTA POR LA SESION ANTES DE HABLAR DEL ROBOT
   * ═════════════════════════════════════════════════════════════════════════
   * El 2026-08-16 este panel decia, con el robot **perfecto**, *«puede estar
   * apagado, fuera de la red, o con el servicio parado»*. Lo era todo menos eso:
   * faltaba la sesion del PC, asi que el transporte **ni siquiera llegaba a
   * abrir un socket** — no habia cliente en el journal del robot, que desde el
   * lado del robot es indistinguible de que nadie abriera la pestaña. Costo un
   * diagnostico entero, y la persona lo pago yendo a mirar un robot que estaba
   * bien.
   *
   * 🔴 Y no basta con la puerta de `(privado)`. La puerta se comprueba **al
   *    navegar**; una sesion que vence a mitad de clase deja la pestaña abierta,
   *    el socket se cae al reintentar, y sin esto el panel volveria a acusar al
   *    robot. Es exactamente el caso que el temporizador de `ProveedorSesion`
   *    detecta: los dos arreglos son una sola cosa y por separado no sirven.
   *
   * 📌 El orden es: **lo que impide intentarlo** › **lo que dijo el robot al
   *    cerrar** › **lo que no se sabe**. Nunca al reves: acusar primero y
   *    matizar despues es como se llega a un robot desmontado por nada.
   */
  const precondicion = evaluarPrecondicion({
    exigido: TESTIGO_EXIGIDO,
    usuario,
    cargando,
    destino: robot,
  })

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

      {salud.estado === 'SIN_CONEXION' && hayQueAvisar(precondicion) && (
        <div className="space-y-2">
          <p className="text-sm max-w-prose">
            <strong>No es el robot: {precondicion.titulo}.</strong>
          </p>
          <p className="text-sm text-muted-foreground max-w-prose">{precondicion.mensaje}</p>
          {precondicion.estado === 'SIN_SESION' && (
            <p className="text-sm">
              <Link href={precondicion.enlace} className="focus-ring underline underline-offset-2">
                Entrar
              </Link>{' '}
              y volver aquí.
            </p>
          )}
        </div>
      )}

      {/*
        🔴 EL ROBOT DIJO POR QUE CERRO, Y ESO GANA A CUALQUIER SUPOSICION. Un
           4401/4403/4404 llega como aviso desde `rechazo.ts` con su explicacion
           escrita; taparlo con las tres causas genericas seria descartar el
           unico dato de primera mano que hay en toda la pantalla.
      */}
      {salud.estado === 'SIN_CONEXION' && !hayQueAvisar(precondicion) && ultimoAviso !== null && (
        <div className="space-y-2">
          <p className="text-sm max-w-prose">
            El robot <strong>cerró la conexión y dijo por qué</strong>:
          </p>
          <p className="text-sm text-muted-foreground max-w-prose">{ultimoAviso.mensaje}</p>
        </div>
      )}

      {salud.estado === 'SIN_CONEXION' && !hayQueAvisar(precondicion) && ultimoAviso === null && (
        <p className="text-sm text-muted-foreground max-w-prose">
          El navegador no consigue abrir el WebSocket con este robot, y{' '}
          <strong>no se sabe por qué</strong>: un socket que no abre no da error, así que aquí no
          hay nada que leer. Puede estar apagado, fuera de la red, o con el servicio parado — y ese
          orden no es una apuesta, son las tres, sin elegir. El cliente reintenta solo, con espera
          creciente de 1 s a 30 s.
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
