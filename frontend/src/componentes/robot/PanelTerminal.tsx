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
import { Insignia, TonoInsignia } from '@/componentes/ui/Insignia'
import { useRobot } from '@/hooks/ContextoRobot'
import { AVISOS_ESPACIO, ESPACIO } from '@/lib/taller/espacio'
import {
  SENALES, type Senal, cabeElCodigo, opEjecutar, opEntrada, opLeer, opListar, opParar,
  opSenal,
} from '@/lib/taller/protocolo'
import {
  type FaseEnlace,
  entradaViva, insigniaDelTerminal, puedeEjecutar, textoCambiadoDesdeElLanzamiento,
} from '@/lib/taller/sesion_taller'
import { estaVacia, faltaAlgo } from '@/lib/taller/salida'
import { hayTraza } from '@/lib/taller/salida_resaltada'
import { EditorPython } from './EditorPython'
import { SalidaPrograma } from './SalidaPrograma'
import { useAgente } from './useAgente'

/** La huella de lo que hay en el editor. Doce hex, como la del agente. */
async function huellaDe(codigo: string): Promise<string> {
  const datos = new TextEncoder().encode(codigo)
  const resumen = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0'))
    .join('').slice(0, 12)
}

const GUION_INICIAL = ''

/**
 * EL ESTADO DEL AGENTE, EN UNA PALABRA Y UN TONO.
 *
 * 🔴 `CERRADO` es NEUTRO, no GRAVE. El agente cerrado es el estado de partida
 *    —todavia no se ha pedido nada— y pintarlo de rojo diria que hay una averia
 *    donde solo hay una conexion sin abrir. El rojo se reserva para `RECHAZADO`,
 *    que SI es un hecho: el robot dijo que no.
 */
const TONO_AGENTE: Readonly<Record<FaseEnlace, TonoInsignia>> = {
  ABIERTO: 'BIEN',
  ABRIENDO: 'NEUTRO',
  CERRADO: 'NEUTRO',
  RECHAZADO: 'GRAVE',
}

const TEXTO_AGENTE: Readonly<Record<FaseEnlace, string>> = {
  ABIERTO: '9443',
  ABRIENDO: 'abriendo',
  CERRADO: 'sin abrir',
  RECHAZADO: 'rechazado',
}

export function PanelTerminal({ etiqueta }: { etiqueta: string }) {
  const { robot, conectado } = useRobot()
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

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 👤 EL MODO EXPANDIDO — y por qué NO es la Fullscreen API
   * ═══════════════════════════════════════════════════════════════════════════
   * *«que esta sección se pueda poner en pantalla completa»*.
   *
   * 🔴🔴 Y LA FULLSCREEN API HABRÍA HECHO DESAPARECER LA PARADA DE EMERGENCIA.
   *      No taparla: **desaparecer**. La parada se teletransporta al `<nav>` del
   *      raíl con `createPortal`, y ese `<nav>` es **hermano** del Taller, no
   *      antepasado: en pantalla completa el navegador solo pinta el elemento y
   *      sus descendientes, así que el botón deja de renderizarse. Y no se puede
   *      reubicar sobre la marcha, porque el destino del portal se resuelve una
   *      sola vez.
   *
   * → Modo expandido en CSS que ocupa todo **menos los 272 px del raíl**. Se gana
   *   casi la misma superficie y la única pieza que frena un robot en marcha
   *   sigue estando a la vista y pulsable.
   *
   * ⚠️ Y UN HALLAZGO QUE HAY QUE DECIR: hoy **tapar la parada deja las pruebas en
   *    verde**. La única guardia comprueba CONTENCIÓN en el DOM —que el botón
   *    esté dentro del `<nav>`— y no visibilidad, y además se salta sin robot.
   *    Por eso este modo respeta el raíl por construcción en vez de fiarse.
   */
  const [expandido, setExpandido] = useState(false)

  /*
   * 🔴 ESCAPE SALE, y es obligatorio en cualquier capa que ocupe la pantalla:
   *    sin él, quien no encuentre el botón se queda dentro. Se registra solo
   *    mientras está expandido, para no robarle la tecla a nadie más.
   *
   * ⚠️ Y NO se cierra al perder el foco ni al cambiar de pestaña: el programa del
   *    alumno puede estar corriendo, y plegar la salida sola mientras imprime
   *    sería perder de vista justo lo que se está mirando.
   */
  useEffect(() => {
    if (!expandido) return
    const salir = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandido(false) }
    window.addEventListener('keydown', salir)
    return () => window.removeEventListener('keydown', salir)
  }, [expandido])
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
  /*
   * 🔴 La insignia NO es `corriendo ? ... : 'listo'`. Sin enlace, «listo» seria
   *    una afirmacion que esta pantalla no puede hacer. Ver `insigniaDelTerminal`.
   */
  const insignia = insigniaDelTerminal(estado)

  /** La cuenta del espacio de ESE fichero, o `null` si no se sabe. */
  const espacioDe = useMemo(() => {
    const fila = ESPACIO.find((f) => f.fichero === nombre)
    return fila?.despejar ?? null
  }, [nombre])

  /*
   * 🔴 EL TOPE SE COMPRUEBA ANTES DE MANDAR, y hasta la auditoría del robot
   *    (evidencia 117 §6) no lo comprobaba nadie: `TOPE_CODIGO_BYTES` estaba
   *    declarado y sin usar. El tope existe para que un pegote enorme **no viaje
   *    por el WiFi del aula** — comprobarlo solo en el robot significa mandarlo
   *    primero, que es justo lo que se quería evitar.
   */
  const noCabe = useMemo(() => cabeElCodigo(codigo), [codigo])

  const lanzar = useCallback(() => {
    if (cabeElCodigo(codigo) !== '') return
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
      {/*
        ═══════════════════════════════════════════════════════════════════════
        🔴🔴 LOS DOS ENLACES, JUNTOS Y SIEMPRE (2026-08-16) — F5
        ═══════════════════════════════════════════════════════════════════════
        Este panel decía «son dos enlaces y se puede tener uno vivo y el otro
        muerto»… **en un aviso que solo aparece cuando el agente falla**. Con el
        agente conectado la pantalla no mencionaba en ningún sitio que hubiera un
        segundo enlace: el requisito se cumplía solo cuando algo se rompía.

        Lo destapó una prueba de navegador que exigía la palabra «agente» sin
        condición y que **falló por la razón buena** — `atriz-agente` estaba
        arriba en rvr-01, así que el aviso no salía y la palabra no aparecía en
        toda la página.

        🔴 Y por qué importa de verdad: la franja de signos vitales de arriba
           dice «en línea» mirando **rosbridge en el 9090**. El terminal habla con
           **el agente en el 9443**, que es otro proceso y otro puerto. Quien vea
           la franja verde y el terminal mudo no tiene forma de saber que son dos
           cosas — y buscará la avería en el sitio equivocado.

        📌 Se pinta como una sola línea con las dos insignias: el estado de los
           dos, en el mismo renglón, es lo que hace evidente que son dos.
      */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-ficha border border-[rgb(var(--filo)/0.12)] px-4 py-2.5">
        <span className="microetiqueta shrink-0">los dos enlaces</span>
        <span className="flex items-center gap-2">
          <Insignia tono={conectado ? 'BIEN' : 'NEUTRO'}>
            {conectado ? 'rosbridge · 9090' : 'rosbridge · sin conexión'}
          </Insignia>
          <span className="text-[12px] text-muted-foreground">telemetría y conducir</span>
        </span>
        <span className="flex items-center gap-2">
          <Insignia tono={TONO_AGENTE[estado.enlace]}>
            {estado.enlace === 'ABIERTO' ? 'agente · 9443' : `agente · ${TEXTO_AGENTE[estado.enlace]}`}
          </Insignia>
          <span className="text-[12px] text-muted-foreground">este terminal</span>
        </span>
      </div>

      {estado.enlace !== 'ABIERTO' && (
        <Aviso nivel={estado.enlace === 'ABRIENDO' ? 'NOTA' : 'ERROR'} titulo="El agente del robot">
          <p>
            {estado.enlace === 'ABRIENDO'
              ? 'Pidiendo permiso y abriendo la conexión con el agente…'
              : estado.motivoEnlace}
          </p>
          {/*
            🔴 SE DICE QUE SON DOS ENLACES. La franja de signos vitales —voltaje,
               «en línea»— habla con rosbridge en el 9090; esto es el agente en el
               9443. Se puede tener uno vivo y el otro muerto, y quien mire la
               franja creería que está todo bien.

            📝 «la franja de ARRIBA» hasta el 2026-08-16, y era exacto hasta ese
               día: la parada vivía ahí. Se fue al raíl —el defecto nº1 era que
               hacía scroll— y con ella dejó de ser cierto que la parada esté
               arriba. Un texto que sitúa una pieza deja de valer en cuanto la
               pieza se mueve, y **nada avisa**: se encontró leyendo la salida de
               una prueba que fallaba por otra cosa.

            🔴 Y LO QUE SIGUE SIN ESTAR: este aviso solo se pinta con el agente
               en `ABRIENDO` o en error. Con el agente CONECTADO la pantalla no
               dice en ningún sitio que haya un segundo enlace — o sea que el
               párrafo de arriba describe un requisito que se cumple solo cuando
               algo falla. Es el Taller de la F5 («el estado de los DOS enlaces
               se ve junto») y está anotado en la prueba.
          */}
          {estado.enlace !== 'ABRIENDO' && (
            <p className="mt-2">
              Esto es <strong>otro enlace</strong> que el de la franja de signos vitales: aquella habla con
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

      {/*
        ═══════════════════════════════════════════════════════════════════════
        EL MODO EXPANDIDO — ocupa todo MENOS el raíl, a propósito
        ═══════════════════════════════════════════════════════════════════════
        `lg:left-[272px]` es exactamente el ancho del raíl (`RailNavegacion`), así
        que la parada de emergencia sigue **visible y pulsable** con el terminal
        a pantalla casi completa. Por debajo de `lg` el raíl va arriba y no al
        lado, así que ahí se ocupa todo: en un portátil de aula —la escena que
        manda— siempre estamos en `lg`.

        🔴 `z-40` y NO más: el raíl es `z-30` y la capa tiene que quedar por
           encima del contenido y por DEBAJO de nada que importe. Subirlo a 50
           empezaría una carrera con la única pieza que no puede perderla.
      */}
      <div
        className={expandido
          ? 'fixed inset-0 z-40 overflow-auto bg-background p-4 lg:left-[272px] lg:p-6'
          : ''}
      >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          // Ancla estable: sirve para enlazar y para que la herramienta de
          // capturas pueda pulsarlo sin adivinar un selector.
          id="expandir-taller"
          onClick={() => setExpandido((v) => !v)}
          className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-3 py-1.5 text-[13px]"
        >
          {expandido ? 'Plegar el terminal' : 'Expandir el terminal'}
        </button>
      </div>
      <Tarjeta
        titulo={`Terminal · ${etiqueta}`}
        subtitulo="Escribe tu programa o abre una práctica, y ejecútalo en el robot."
        extremo={<Insignia tono={insignia.tono}>{insignia.texto}</Insignia>}
        pie={(
          <p>
            La parada del raíl para el robot{' '}
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
                🔴 SIGUE SIENDO UN `<textarea>`, no un editor de verdad: cero
                   dependencias nuevas, y `pantallas_reales.test.ts:187` exige que
                   exista y no esté `disabled`. Lo que hay debajo es un espejo de
                   color; el detalle de por qué no se despega, en `EditorPython`.
                ⚠️ Tab escribe cuatro espacios porque esto es Python, y se dice
                   cómo salir del campo: si no, el teclado queda atrapado para
                   quien navegue sin ratón.
              */}
              <EditorPython
                codigo={codigo}
                alCambiar={setCodigo}
                ejemplo={'from atriz import Robot\n\nwith Robot() as robot:\n    robot.avanzar(0.20, 3)'}
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
            <div className="flex h-full flex-col overflow-hidden rounded-md border border-[rgb(var(--filo)/0.16)] bg-[rgb(var(--vidrio)/0.03)]">
              <p className="microetiqueta border-b border-[rgb(var(--filo)/0.12)] px-4 py-2.5">
                Salida del programa
              </p>
              {estaVacia(salida) ? (
                /*
                  🔴 EL PANEL ES OSCURO TAMBIÉN VACÍO, y se probó al revés. Con la
                     caja clara mientras no hay salida y oscura en cuanto llega
                     una línea, la superficie **cambia de identidad delante de
                     quien la mira**: parecen dos cosas distintas según el momento.
                     Lo que el fondo oscuro dice es «aquí escribe la máquina», y
                     eso es cierto antes de que escriba.
                  ⚠️ La prosa del vacío sí baja a `--consola-apagada`: es la
                     interfaz hablando, no el programa, y no puede tener el mismo
                     peso que una línea de salida.
                */
                <div className="consola flex flex-1 items-start rounded-b-md px-4 py-5 text-[rgb(var(--consola-apagada))]">
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
                  /*
                    ═══════════════════════════════════════════════════════════
                    🔴 TRES ARREGLOS EN UNA LÍNEA, Y DOS SON DE ACCESIBILIDAD
                    ═══════════════════════════════════════════════════════════
                    · `.consola`: el panel oscuro. Marca procedencia — esto lo
                      escribió el programa del alumno, no la interfaz.
                    · `tabIndex={0}`: **con `overflow-auto` y sin foco, un usuario
                      de teclado NO PODÍA DESPLAZAR LA SALIDA.** Es WCAG 2.1.1, y
                      es la única forma de leer un programa que imprime más de lo
                      que cabe.
                    · `role="log"` + `aria-live="polite"`: un lector de pantalla
                      **no se enteraba de nada de lo que imprime el programa**.
                      `log` es el rol que existe para esto: anuncia lo que se
                      AÑADE, no relee todo el bloque en cada línea.
                  */
                  tabIndex={0}
                  role="log"
                  aria-live="polite"
                  aria-label="Salida del programa"
                  className="consola focus-ring min-h-[260px] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md px-4 py-3 font-mono text-[12.5px] leading-relaxed"
                >
                  <SalidaPrograma lineas={salida.lineas} cola={salida.cola} />
                </pre>
              )}
              {/*
                🔴 EL AVISO SOLO SALE SI SE HA MARCADO ALGO. Uno permanente acaba
                   sin leerse, y aquí importa que se lea: el color de esta caja no
                   viene del robot —el agente fija `TERM=dumb`, no llega ni un
                   código de escape—, lo deduce la web de la FORMA del texto.
              */}
              {hayTraza(salida.lineas) && (
                <p className="border-t border-[rgb(var(--filo)/0.09)] px-4 py-2 text-[11px] text-muted-foreground">
                  Lo señalado como error sale de la <strong>forma</strong> del texto, no de un aviso
                  del robot. Si tu programa imprime algo con pinta de traza, se pintará igual.
                </p>
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
              disabled={!ejecutable.puede || codigo.trim() === '' || noCabe !== ''}
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
          {noCabe !== '' && (
            <p className="mt-2 text-[13px] text-[rgb(var(--estado-mirar))]">{noCabe}</p>
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
      </div>

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
