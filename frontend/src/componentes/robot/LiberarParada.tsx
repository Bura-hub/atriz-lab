'use client'

/**
 * LIBERAR LA PARADA DE EMERGENCIA.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ ESTO EXISTE AHORA, SI EL PROYECTO LO TENÍA PROHIBIDO
 * ═══════════════════════════════════════════════════════════════════════════
 * `PLATAFORMA_STITCH.md` decía «prohibido aquí: un botón de liberar la parada,
 * ni con confirmación». El peligro que lo motivaba está **cerrado y medido**: al
 * liberar con un objetivo de Nav2 vivo el robot arrancaba solo —**34,7 cm**—
 * porque el `controller_server` nunca dejaba de publicar, y el nodo
 * `cancelar_nav2` lo dejó en **0,0 cm**, con control.
 *
 * Lo que queda no es un peligro sin resolver: es que **la web no puede
 * comprobar que ese nodo esté vivo**. Eso va escrito en la pantalla, no callado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 Y VA **DEBAJO** DEL BOTÓN ROJO, NUNCA AL LADO
 * ═══════════════════════════════════════════════════════════════════════════
 * Dos controles de parada uno junto a otro es exactamente la confusión que la
 * franja de seguridad existe para evitar. Aquí ni siquiera comparten forma: el
 * de parar es un bloque rojo de 4 px de borde y letra de 24 px; este es un
 * enlace-botón discreto que además **hay que abrir** antes de poder pulsarlo.
 *
 * ⚠️ Y no se ofrece «por si acaso»: solo aparece si **se sabe** que la parada
 *    está puesta. Con `/estado_robot` mudo (`null`) no sale, porque liberar a
 *    ciegas es justo lo que este proyecto no hace.
 */

import { useState } from 'react'
import { Liberacion, MotivoNoLiberada } from '@/lib/rosbridge/teleoperacion'
import { ControlTeleoperacion } from '@/hooks/useTeleoperacion'
import { horaCorta } from '@/lib/interfaz/formato'
import { Aviso } from '@/componentes/ui/Aviso'

export interface PropsLiberarParada {
  teleoperacion: ControlTeleoperacion
  /** `rvr-07`. Es lo que hay que teclear para confirmar. */
  nombreRobot: string
  /** De `/estado_robot`. `null` = no se sabe, y entonces esto no se ofrece. */
  paradaPuesta: boolean | null
  /** Quién ha entrado, o `null`. Sin sesión se explica el hueco y no hay botón. */
  usuario: string | null
}

/**
 * Qué se le dice a quien pulsó, según lo que el robot haya atestiguado.
 *
 * 🔴 Los cuatro motivos NO son «el mismo error». `SIGUE_PUESTA` es una negativa
 *    CON evidencia; los otros tres son «no se sabe». Fundirlos en un «no se
 *    pudo» convertiría un silencio en un no, que es la regla central del
 *    proyecto — y aquí, además, mandaría a alguien a dar por liberado un robot
 *    que puede seguir parado, o al revés.
 */
const SEGUN_MOTIVO: Readonly<Record<MotivoNoLiberada, string>> = {
  SIGUE_PUESTA:
    'El servicio contestó y el robot siguió diciendo que su bandera está PUESTA. '
    + 'Eso no es un silencio: es una negativa con evidencia. Mira el robot.',
  SIN_TESTIGO:
    'El servicio contestó, pero el robot no ha vuelto a hablar, así que no se sabe si la soltó. '
    + 'Mira el robot antes de dar nada por hecho.',
  /*
   * ⚠️ NO ELIGE CAUSA, y antes elegía. Este texto decía «puede ser un driver
   *    anterior al 2026-08-04» como si fuera la explicación, y al conducirlo
   *    contra un robot que simplemente se callaba salió esa frase — señalando a
   *    un driver viejo que no tenía nada que ver. Las dos causas encajan con los
   *    datos, así que se dicen las dos: cuando dos explicaciones encajan, el
   *    dato es que encajan dos.
   */
  SIN_REFERENCIA:
    'El servicio contestó, pero no ha llegado ningún /estado_robot con el que juzgar. Puede que el '
    + 'robot se haya callado, o que su driver sea anterior al 2026-08-04 y no publique esa bandera. '
    + 'Desde aquí no se sabe: mira el robot.',
  SE_PERDIO_EL_ENLACE:
    'Se cayó el WebSocket mientras se esperaba la confirmación. No se sabe si la orden llegó a '
    + 'aplicarse. Mira el robot.',
}

interface Resultado { liberacion: Liberacion | null; error: string | null; hora: string }

export function LiberarParada({
  teleoperacion, nombreRobot, paradaPuesta, usuario,
}: PropsLiberarParada) {
  const [abierto, setAbierto] = useState(false)
  const [escrito, setEscrito] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 EL `resultado !== null` DE ESTA CONDICIÓN NO SOBRA, Y COSTÓ UN FALLO.
   * ═══════════════════════════════════════════════════════════════════════════
   * Aquí ponía `if (paradaPuesta !== true) return null` a secas. Parece obvio:
   * con la bandera abajo no hay nada que liberar. Pero la bandera baja
   * **exactamente cuando la liberación acierta**, así que todo este componente
   * —incluido el «Liberada, y lo confirma el robot»— desaparecía en el mismo
   * instante en que tenía algo que decir.
   *
   * El efecto medido en el navegador: se pulsa «Liberar», funciona, el panel se
   * esfuma y **la pantalla no dice nada**. Quien lo pulsó no sabe si salió, si
   * falló o si se rompió algo. Es la familia de fallo de este proyecto entera:
   * la confirmación de un efecto desapareciendo al ocurrir el efecto.
   *
   * 📝 No lo vio ni `tsc`, ni `eslint`, ni las 467 pruebas — todas verdes.
   *    Apareció al CONDUCIR la aplicación contra un rosbridge de mentira y mirar
   *    la captura: la banda roja se había ido y no había ningún `role="alert"`.
   */
  if (paradaPuesta !== true && resultado === null) return null

  if (usuario === null) {
    /*
     * 🔴 EL HUECO, DICHO — y sin botón desactivado. Un control gris se lee como
     *    «esto se podrá algún día»; lo que pasa aquí es que hace falta entrar,
     *    que es una acción concreta y a un clic.
     */
    return (
      <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        Liberar la parada desde la web <strong>exige iniciar sesión</strong>, para que quede claro
        quién lo hizo. Sin sesión se libera junto al robot, en el laboratorio.
      </p>
    )
  }

  const coincide = escrito.trim().toLowerCase() === nombreRobot.toLowerCase()

  const liberar = async () => {
    setEnviando(true)
    setResultado(null)
    const hora = horaCorta(Date.now())
    try {
      const liberacion = await teleoperacion.liberarParada()
      setResultado({ liberacion, error: null, hora })
      if (liberacion.confirmada) { setAbierto(false); setEscrito('') }
    } catch (e) {
      // 🔴 Se PINTA. La orden no salió, y quien pulsó tiene que enterarse: es la
      //    misma regla que el botón rojo, que ha fallado cinco veces en silencio.
      setResultado({ liberacion: null, error: e instanceof Error ? e.message : String(e), hora })
    } finally {
      setEnviando(false)
    }
  }

  /*
   * Con la bandera ya abajo no se ofrece volver a liberar —no hay nada que
   * liberar—, pero el resultado de abajo se sigue pintando. Son dos cosas
   * distintas y antes eran la misma.
   */
  const sePuedeLiberar = paradaPuesta === true

  return (
    <div className="space-y-2">
      {!sePuedeLiberar ? null : !abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="focus-ring rounded text-[13px] text-muted-foreground underline underline-offset-2 transition-colors duration-[var(--t-estado)] hover:text-foreground"
        >
          Liberar la parada desde aquí…
        </button>
      ) : (
        <div className="vidrio aparece rounded-md p-4">
          <p className="microetiqueta">liberar la parada de {nombreRobot}</p>

          {/*
            🔴 CONFIRMACIÓN ESCRIBIENDO EL NOMBRE, no un «¿seguro?».
               Un «¿seguro?» se contesta que sí sin leerlo. Teclear `rvr-07`
               obliga a mirar QUÉ robot es — y con 16 abiertos en pestañas
               distintas, equivocarse de pestaña es el error probable, no el
               exótico.
          */}
          <label htmlFor="confirmar-liberar" className="mt-3 block text-[13px] leading-relaxed">
            Escribe <strong className="font-mono">{nombreRobot}</strong> para confirmar. Antes de
            hacerlo, <strong>mira el robot</strong>: al soltar la parada recupera el permiso de
            moverse.
          </label>
          <input
            id="confirmar-liberar"
            type="text"
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            disabled={enviando}
            autoComplete="off"
            className="focus-ring mt-2 w-full max-w-[16rem] rounded-md border border-[rgb(var(--filo)/0.16)] bg-[rgb(var(--vidrio)/0.03)] px-3 py-2 font-mono text-[15px] disabled:opacity-60"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { void liberar() }}
              disabled={!coincide || enviando}
              aria-busy={enviando}
              className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              {enviando ? 'Esperando al robot…' : 'Liberar'}
            </button>
            <button
              type="button"
              onClick={() => { setAbierto(false); setEscrito('') }}
              disabled={enviando}
              className="focus-ring rounded px-2 py-2 text-[13px] text-muted-foreground underline underline-offset-2"
            >
              Cancelar
            </button>
            <span className="text-[13px] text-muted-foreground">
              como <strong>{usuario}</strong>
            </span>
          </div>

          {/*
            ⚠️ LO QUE ESTA PANTALLA **NO** PUEDE COMPROBAR, dicho aquí y no en un
               desplegable: que `cancelar_nav2` esté vivo en el robot. Si no lo
               está y hay un objetivo de Nav2 en marcha, el robot puede reanudar
               la navegación al soltar la parada — 34,7 cm medidos antes de que
               ese nodo existiera. No hay ningún topic que lo diga.
          */}
          <div className="mt-3">
            <Aviso nivel="ATENCION" titulo="Lo que no se puede comprobar desde aquí">
              Que el nodo <code>cancelar_nav2</code> esté vivo en el robot. Si no lo está y hay un
              objetivo de navegación en marcha, el robot puede <strong>reanudarlo solo</strong> al
              soltar la parada. Ningún topic lo dice, así que esta pantalla no lo sabe.
            </Aviso>
          </div>
        </div>
      )}

      {resultado !== null && (
        <div role="alert" className="mt-2">
          {resultado.error !== null ? (
            <Aviso nivel="ERROR" titulo={`La orden NO salió · ${resultado.hora}`}>
              {resultado.error}
            </Aviso>
          ) : resultado.liberacion?.confirmada === true ? (
            /*
             * ✅ LA ÚNICA FRASE DE ESTE FICHERO QUE AFIRMA UN EFECTO FÍSICO, y la
             *    dice porque el robot la atestiguó: `/estado_robot` bajó la
             *    bandera en un mensaje POSTERIOR a la referencia. La respuesta
             *    del servicio, por sí sola, no habría bastado para escribirla.
             */
            <Aviso nivel="NOTA" titulo={`Liberada · ${resultado.hora}`}>
              Y lo confirma el robot: su bandera de parada ha bajado a <code>false</code> en un
              mensaje posterior a la orden. El bucle de mando <strong>no</strong> se ha reanudado —
              para conducir hay que volver a pedirlo.
            </Aviso>
          ) : (
            <Aviso nivel="ATENCION" titulo={`Sin confirmar · ${resultado.hora}`}>
              {resultado.liberacion?.confirmada === false
                ? SEGUN_MOTIVO[resultado.liberacion.motivo]
                : ''}
            </Aviso>
          )}
        </div>
      )}
    </div>
  )
}
