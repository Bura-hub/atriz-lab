'use client'

/*
 * 🔴 AQUI NO SE ESCRIBE MARKDOWN EN LAS CADENAS que van a `motivo`, `evidencia`
 *    o similares: se pintan como TEXTO PLANO. En el JSX de este fichero sí se
 *    puede marcar con `<strong>` y `<code>`, que es lo que hay debajo.
 */

/**
 * EL TALLER: donde el alumno escribe y ejecuta su código.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ESTA PANTALLA ERA UN CHASIS VACIO, Y LO ERA A PROPOSITO
 * ═══════════════════════════════════════════════════════════════════════════
 * Desde el 2026-08-04 decía «no construido» y no fingía nada: ni editor, ni
 * cursor, ni una línea de salida inventada. Su criterio de revisión era una sola
 * pregunta — **¿alguien podría creer que esto ya funciona?**
 *
 * Hoy funciona, y el criterio no se relaja: **se invierte**. La pregunta pasa a
 * ser *¿alguien podría creer que esto hace algo que no hace?*, y de ahí salen
 * las tres cosas que esta pantalla se niega a decir:
 *
 * 1. **Que el robot está parado.** Que un programa termine no lo dice. Lo dice
 *    lo que el agente mide DESPUES, y cada campo suyo puede ser «no lo sé».
 * 2. **Que esto ve todo lo que pasa en el robot.** Un guion lanzado por SSH el
 *    agente no lo ve, y va escrito.
 * 3. **Que lo que corre es lo que se ve.** En cuanto el alumno toca una tecla
 *    deja de ser cierto, y la huella de lo lanzado permite decirlo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 Y LO QUE ESTA PANTALLA ABRE, QUE ES REAL
 * ═══════════════════════════════════════════════════════════════════════════
 * El programa del alumno corre con `rclpy` NATIVO en el robot, no por rosbridge.
 * Desde ahí alcanza `raw_motors`, `move_timed` y `set_ir_mode('following')` —los
 * caminos que **se saltan la capa de seguridad**— que es justo lo que la lista
 * blanca cierra para el navegador. La frase «`raw_motors` ya no es alcanzable»
 * deja de ser cierta mientras haya un programa corriendo, y eso se dice aquí.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Aviso } from '@/componentes/ui/Aviso'
import { Insignia } from '@/componentes/ui/Insignia'
import { useRobot } from '@/hooks/ContextoRobot'
import { AVISOS_ESPACIO, ESPACIO } from '@/lib/taller/espacio'
import {
  SENALES, type Senal, opEjecutar, opEntrada, opLeer, opListar, opParar, opSenal,
} from '@/lib/taller/protocolo'
import {
  entradaViva, puedeEjecutar, textoCambiadoDesdeElLanzamiento,
} from '@/lib/taller/sesion_taller'
import { estaVacia, faltaAlgo, texto as textoDeSalida } from '@/lib/taller/salida'
import { useAgente } from './useAgente'

/** La huella de lo que hay en el editor. Doce hex, como la del agente. */
async function huellaDe(codigo: string): Promise<string> {
  const datos = new TextEncoder().encode(codigo)
  const resumen = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0'))
    .join('').slice(0, 12)
}

const GUION_INICIAL = ''

export function PanelTerminal({ etiqueta }: { etiqueta: string }) {
  const { robot } = useRobot()
  const numero = typeof robot === 'number' ? robot : null
  const anfitrion = typeof robot === 'number'
    ? `rvr-${String(robot).padStart(2, '0')}.local`
    : robot

  const { estado, salida, fichero, enviar, reintentar, limpiarSalida } = useAgente(numero, anfitrion)

  const [codigo, setCodigo] = useState(GUION_INICIAL)
  const [nombre, setNombre] = useState('mi_programa.py')
  const [entrada, setEntrada] = useState('')
  const [huellaActual, setHuellaActual] = useState('')
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const cajaSalida = useRef<HTMLPreElement | null>(null)

  // Al abrir una práctica, su texto entra en el editor.
  useEffect(() => {
    if (fichero !== null) {
      setCodigo(fichero.texto)
      setNombre(fichero.nombre)
    }
  }, [fichero])

  useEffect(() => { void huellaDe(codigo).then(setHuellaActual) }, [codigo])

  /*
   * 🔴 SE PEGA ABAJO SOLO SI YA ESTABA ABAJO. Arrastrar la vista hacia el final
   *    mientras alguien lee lo de arriba es la forma más rápida de que deje de
   *    poder leerlo, y en una práctica de sensores la salida no para nunca.
   */
  useEffect(() => {
    const c = cajaSalida.current
    if (c === null) return
    const abajo = c.scrollHeight - c.scrollTop - c.clientHeight < 40
    if (abajo) c.scrollTop = c.scrollHeight
  }, [salida])

  const ejecutable = puedeEjecutar(estado)
  const linea = entradaViva(estado)
  const corriendo = estado.ejecucion !== null
  const cambiado = textoCambiadoDesdeElLanzamiento(estado, huellaActual)
  const falta = faltaAlgo(salida)

  /** La cuenta del espacio de ESE fichero, o `null` si no se sabe. */
  const espacioDe = useMemo(() => {
    const fila = ESPACIO.find((f) => f.fichero === nombre)
    return fila?.despejar ?? null
  }, [nombre])

  const lanzar = useCallback(() => {
    limpiarSalida()
    enviar(opEjecutar(codigo, nombre))
    setConfirmando(null)
  }, [codigo, nombre, enviar, limpiarSalida])

  const mandarEntrada = useCallback(() => {
    if (!linea.viva) return
    // 🔴 NO se escribe localmente lo enviado: el PTY hace eco, como por SSH, y
    //    pintarlo aquí además saldría duplicado.
    enviar(opEntrada(`${entrada}\n`))
    setEntrada('')
  }, [entrada, enviar, linea.viva])

  return (
    <div className="space-y-4">
      {estado.enlace !== 'ABIERTO' && (
        <Aviso nivel={estado.enlace === 'ABRIENDO' ? 'NOTA' : 'ERROR'} titulo="El agente del robot">
          <p>
            {estado.enlace === 'ABRIENDO'
              ? 'Pidiendo permiso y abriendo la conexión con el agente…'
              : estado.motivoEnlace}
          </p>
          {/*
            🔴 SE DICE QUE SON DOS ENLACES. La franja de arriba —parada, voltaje,
               «en línea»— habla con rosbridge en el 9090; esto es el agente en el
               9443. Se puede tener uno vivo y el otro muerto, y quien mire la
               franja creería que está todo bien.
          */}
          {estado.enlace !== 'ABRIENDO' && (
            <p className="mt-2">
              Esto es <strong>otro enlace</strong> que el de la franja de arriba: aquella habla con
              el robot por el puerto 9090 y esto con el agente por el 9443. Que una diga «en línea»
              no dice nada de la otra.
            </p>
          )}
          {estado.enlace !== 'ABRIENDO' && (
            <button
              type="button"
              onClick={reintentar}
              className="mt-3 rounded-md border border-[rgb(var(--filo)/0.2)] px-3 py-1.5 text-[13px] hover:bg-[rgb(var(--vidrio)/0.06)]"
            >
              Volver a intentarlo
            </button>
          )}
        </Aviso>
      )}

      {!estado.relojFiable && (
        <Aviso nivel="ATENCION" titulo="El robot todavía no tiene la hora">
          <p>
            Acaba de arrancar y aún no ha preguntado a la red. No es un fallo tuyo ni de esta
            página: <strong>se arregla esperando unos segundos</strong>. La Raspberry Pi no tiene
            reloj propio, así que hasta que la red le dice la hora no puede comprobar permisos.
          </p>
        </Aviso>
      )}

      {estado.ocupacion !== null && estado.ejecucion === null && (
        <Aviso nivel="ATENCION" titulo="Este robot ya está ocupado">
          <p>
            Lo tiene <strong>{estado.ocupacion.sujeto}</strong>
            {estado.ocupacion.nombre !== '' && <> con <code className="font-mono">{estado.ocupacion.nombre}</code></>}
            {estado.ocupacion.pid !== null && <> (PID {estado.ocupacion.pid})</>}
            {estado.ocupacion.desdeS > 0 && <>, desde hace {Math.round(estado.ocupacion.desdeS / 60)} min</>}.
          </p>
          <p className="mt-2">
            Un robot solo puede correr un programa a la vez: la biblioteca crea un nodo con nombre
            fijo, y dos a la vez se pelean por el mismo robot.{' '}
            <strong>Desde aquí no se le puede quitar</strong> — habla con quien lo tiene.
          </p>
        </Aviso>
      )}

      {estado.rechazo !== null && estado.rechazo.codigo !== 'OCUPADO' && (
        <Aviso nivel="ATENCION" titulo="El robot no ha aceptado la orden">
          <p>{estado.rechazo.motivo}</p>
        </Aviso>
      )}

      <Tarjeta
        titulo={`Terminal · ${etiqueta}`}
        subtitulo="Escribe tu programa o abre una práctica, y ejecútalo en el robot."
        extremo={corriendo
          ? <Insignia tono="ATENCION">corriendo</Insignia>
          : <Insignia tono="NEUTRO">listo</Insignia>}
        pie={(
          <p>
            La parada de arriba para el robot{' '}
            <strong className="text-foreground/85">venga la orden de donde venga</strong>.{' '}
            ⚠️ Y esta pantalla <strong className="text-foreground/85">solo ve los programas que
            salen de aquí</strong>: uno lanzado por SSH se mueve igual y no aparece.
          </p>
        )}
      >
        <div className="grid gap-5 px-5 py-5 lg:grid-cols-5">
          {/* ── EL EDITOR ─────────────────────────────────────────────── */}
          <div className="lg:col-span-3">
            <div className="flex flex-col rounded-md border border-[rgb(var(--filo)/0.16)] bg-[rgb(var(--vidrio)/0.03)]">
              <div className="flex items-center justify-between gap-2 border-b border-[rgb(var(--filo)/0.12)] px-4 py-2.5">
                <p className="microetiqueta">Editor · tu código</p>
                <code className="font-mono text-[12px] text-muted-foreground">{nombre}</code>
              </div>
              {/*
                🔴 UN `<textarea>`, NO UN EDITOR DE VERDAD. Las prácticas son de
                   ~30 líneas y este repositorio tiene una regla de cero
                   dependencias nuevas; Monaco son ~5 MB para poner colores.
                ⚠️ Tab escribe cuatro espacios porque esto es Python, y se dice
                   cómo salir del campo: si no, el teclado queda atrapado para
                   quien navegue sin ratón.
              */}
              <textarea
                id="editor-taller"
                aria-label="Tu código"
                spellCheck={false}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault()
                    const t = e.currentTarget
                    const i = t.selectionStart
                    const nuevo = `${codigo.slice(0, i)}    ${codigo.slice(t.selectionEnd)}`
                    setCodigo(nuevo)
                    requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = i + 4 })
                  }
                }}
                placeholder={'from atriz import Robot\n\nwith Robot() as robot:\n    robot.avanzar(0.20, 3)'}
                className="min-h-[260px] w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <p className="border-t border-[rgb(var(--filo)/0.09)] px-4 py-2 text-[11px] text-muted-foreground">
                Tab escribe cuatro espacios. Para salir de la caja con el teclado, Escape y luego Tab.
              </p>
            </div>
            {cambiado && (
              <p className="mt-2 text-[13px] text-[rgb(var(--estado-mirar))]">
                Has cambiado el texto desde que lanzaste: <strong>lo que corre no es lo que ves</strong>.
              </p>
            )}
          </div>

          {/* ── LA SALIDA ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="flex h-full flex-col rounded-md border border-[rgb(var(--filo)/0.16)] bg-[rgb(var(--vidrio)/0.03)]">
              <p className="microetiqueta border-b border-[rgb(var(--filo)/0.12)] px-4 py-2.5">
                Salida del programa
              </p>
              {estaVacia(salida) ? (
                <div className="flex flex-1 items-start px-4 py-5">
                  {/*
                    🔴 VACIO DE VERDAD MIENTRAS NO HAYA NADA: ni prompt, ni
                       cursor, ni una línea de ejemplo. Es la regla que traía esta
                       pantalla desde que era un chasis, y no cambia porque ahora
                       funcione.
                  */}
                  <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                    Aquí aparecerá lo que imprima tu programa, según lo vaya imprimiendo.
                  </p>
                </div>
              ) : (
                <pre
                  ref={cajaSalida}
                  className="min-h-[260px] flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground"
                >
                  {textoDeSalida(salida)}
                </pre>
              )}
              {falta !== '' && (
                <p className="border-t border-[rgb(var(--filo)/0.09)] px-4 py-2 text-[11px] text-muted-foreground">
                  ⚠️ {falta}.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── LA LINEA DE ENTRADA ───────────────────────────────────────── */}
        <div className="border-t border-[rgb(var(--filo)/0.09)] px-5 py-5">
          <label htmlFor="stdin-taller" className="microetiqueta mb-2 block">
            Lo que le contestas al programa
          </label>
          <input
            id="stdin-taller"
            type="text"
            disabled={!linea.viva}
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') mandarEntrada() }}
            placeholder={linea.viva
              ? 'escribe la medida y pulsa Enter'
              : 'el programa te pedirá que midas algo y pulses Enter'}
            className={`w-full rounded-md border border-[rgb(var(--filo)/0.12)] px-3.5 py-2.5 font-mono text-sm ${
              linea.viva
                ? 'bg-[rgb(var(--vidrio)/0.06)] text-foreground'
                : 'cursor-not-allowed bg-[rgb(var(--vidrio)/0.03)] text-muted-foreground'
            } placeholder:text-muted-foreground/50`}
          />
          {!linea.viva && (
            /*
             * 🔴 EL MOTIVO CAMBIÓ, y es la mitad del arreglo. Decía «no hay nada
             *    al otro lado», que era cierto cuando el agente no existía. Ahora
             *    existe: el motivo es que no hay programa corriendo.
             */
            <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              {linea.motivo} Los cuatro <code className="font-mono">input()</code> de{' '}
              <code className="font-mono">04_giro_preciso.py</code> y el de{' '}
              <code className="font-mono">99_test_ctrl_c.py</code> se contestan aquí.
            </p>
          )}

          {/* ── LOS MANDOS ─────────────────────────────────────────────── */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!ejecutable.puede || codigo.trim() === ''}
              onClick={() => setConfirmando(nombre)}
              className="rounded-md border border-[rgb(var(--filo)/0.2)] bg-[rgb(var(--vidrio)/0.06)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              Ejecutar
            </button>
            <button
              type="button"
              disabled={!corriendo}
              onClick={() => enviar(opParar())}
              className="rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              Parar el programa
            </button>
            <span className="font-mono text-[13px] text-muted-foreground">
              PID {estado.ejecucion?.pid ?? '—'}
            </span>
            {estado.ejecucion?.restanteS != null && (
              <span className="text-[13px] text-muted-foreground">
                le quedan {Math.floor(estado.ejecucion.restanteS / 60)} min{' '}
                {estado.ejecucion.restanteS % 60} s
              </span>
            )}
          </div>

          {!ejecutable.puede && ejecutable.motivo !== '' && (
            <p className="mt-2 text-[13px] text-muted-foreground">{ejecutable.motivo}</p>
          )}

          {/*
            LAS SEÑALES. No es un menú de experto: SIGINT repetido, SIGQUIT,
            SIGTERM y SIGHUP son el OBJETO DE ESTUDIO de la práctica 99, y su
            ejercicio 5 pide un `kill -9`.
          */}
          {corriendo && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="microetiqueta">Señales</span>
              {SENALES.map((s: Senal) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(opSenal(s))}
                  className="rounded-md border border-[rgb(var(--filo)/0.16)] px-2.5 py-1 font-mono text-[12px] hover:bg-[rgb(var(--vidrio)/0.06)]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── LA CONFIRMACION DE ESPACIO ─────────────────────────────────── */}
        {confirmando !== null && (
          <div className="border-t border-[rgb(var(--filo)/0.09)] px-5 py-5">
            <Aviso nivel="ATENCION" titulo="Antes de ejecutar, mira el suelo">
              <p>
                {espacioDe !== null ? (
                  <>Esta práctica necesita <strong>{espacioDe}</strong>.</>
                ) : (
                  <>
                    No puedo saber cuánto espacio necesita este programa:{' '}
                    <strong>la cuenta sale de tu código</strong>.
                  </>
                )}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {AVISOS_ESPACIO.map((a) => <li key={a}>{a}</li>)}
              </ul>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={lanzar}
                  className="rounded-md border border-[rgb(var(--filo)/0.2)] bg-[rgb(var(--vidrio)/0.08)] px-4 py-2 text-sm"
                >
                  Está despejado, ejecutar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(null)}
                  className="rounded-md border border-[rgb(var(--filo)/0.16)] px-4 py-2 text-sm"
                >
                  Ahora no
                </button>
              </div>
            </Aviso>
          </div>
        )}
      </Tarjeta>

      {/* ── EL DESENLACE ───────────────────────────────────────────────── */}
      {estado.desenlace !== null && (
        <Tarjeta
          titulo="Cómo terminó"
          subtitulo="Lo que dijo el robot al acabar, y lo que comprobó después."
        >
          <div className="space-y-2 px-5 py-5 text-[13px] leading-relaxed">
            <p>
              Terminó por <strong>{estado.desenlace.motivo.toLowerCase().replace(/_/g, ' ')}</strong>
              {estado.desenlace.senal !== null && <> ({estado.desenlace.senal})</>}
              {estado.desenlace.codigo !== null && <>, con código {estado.desenlace.codigo}</>}
              , tras {estado.desenlace.duracionS} s.
            </p>
            {/*
              🔴 UN CODIGO 0 NO ES «TODO BIEN», y esta pantalla no lo dice. Lo
                 único que informa de lo que hizo el ROBOT es lo de abajo, y sus
                 campos pueden decir «no lo sé».
            */}
            {estado.desenlace.efecto === null ? (
              <p className="text-muted-foreground">
                El robot <strong>no llegó a comprobar</strong> qué pasó después. Que el programa
                terminara no dice que el robot se haya quedado quieto.
              </p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  Barrido del LIDAR:{' '}
                  {estado.desenlace.efecto.scanLlegaba === null ? 'no se comprobó'
                    : estado.desenlace.efecto.scanLlegaba
                      ? (estado.desenlace.efecto.stopScanLlamado
                        ? 'seguía encendido, y el robot lo apagó'
                        : 'seguía encendido, y NO se apagó')
                      : 'ya estaba apagado'}
                  {estado.desenlace.efecto.navegacionEnMarcha === true
                    && ' — no se apagó porque hay una navegación en marcha que lo necesita'}
                </li>
                <li>
                  Movimiento después:{' '}
                  {estado.desenlace.efecto.odomMaxLineal === null
                    ? 'no se midió'
                    : `${estado.desenlace.efecto.odomMaxLineal.toFixed(3)} m/s como mucho`}
                </li>
              </ul>
            )}
            {estado.desenlace.lineasDescartadas > 0 && (
              <p className="text-muted-foreground">
                Se descartaron {estado.desenlace.lineasDescartadas} líneas de salida.
              </p>
            )}
          </div>
        </Tarjeta>
      )}

      {/* ── LAS PRACTICAS ──────────────────────────────────────────────── */}
      <Tarjeta
        titulo="Las prácticas del robot"
        subtitulo="La lista sale del robot, no de esta página."
        extremo={(
          <button
            type="button"
            onClick={() => enviar(opListar())}
            className="rounded-md border border-[rgb(var(--filo)/0.16)] px-3 py-1.5 text-[13px]"
          >
            Actualizar
          </button>
        )}
      >
        <div className="px-5 py-5">
          {estado.ficheros.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              El robot no ha dado ninguna lista todavía.
            </p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {estado.ficheros.map((f) => {
                const fila = ESPACIO.find((x) => x.fichero === f.nombre)
                return (
                  <li key={f.nombre}>
                    <button
                      type="button"
                      onClick={() => enviar(opLeer(f.nombre))}
                      className="w-full rounded-md border border-[rgb(var(--filo)/0.12)] px-3 py-2 text-left hover:bg-[rgb(var(--vidrio)/0.05)]"
                    >
                      <code className="font-mono text-[13px]">{f.nombre}</code>
                      <span className="ml-2 text-[12px] text-muted-foreground">
                        {/*
                          🔴 «no tengo la cuenta de este fichero» y no un hueco:
                             la tabla de espacio de esta web y los ficheros del
                             robot NO coinciden —cinco nombres de diez no existen
                             allí— y callarlo haría creer que no hace falta sitio.
                        */}
                        {fila?.despejar ?? 'no tengo la cuenta de este fichero'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {estado.directorio !== '' && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">{estado.directorio}</p>
          )}
        </div>
      </Tarjeta>

      <Aviso nivel="ATENCION" titulo="Lo que abre este terminal">
        <p>
          Tu programa corre <strong>en el robot, con permisos de verdad</strong>. Desde ahí puede
          hacer cosas que esta web tiene cerradas a propósito — mover los motores saltándose la capa
          de seguridad, por ejemplo. No hay forma de impedirlo sin quitarte Python: lo que hay es
          que <strong>lo sepas</strong>, y que la parada de emergencia siga funcionando pase lo que
          pase.
        </p>
      </Aviso>
    </div>
  )
}
