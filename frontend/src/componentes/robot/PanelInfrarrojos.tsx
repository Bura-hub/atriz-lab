'use client'

/**
 * INFRARROJOS — lo que este robot ve de los otros, y lo que les dice.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL HUECO NO ERA EMITIR: ERA MIRAR
 * ═══════════════════════════════════════════════════════════════════════════
 * `lib/robot/infrarrojos.ts` son 263 líneas con el mensaje entero modelado, las
 * tres zonas medidas, sus trampas y diecisiete pruebas — y **ninguna pantalla lo
 * usaba**. `useTopic.ts` lo decía sin rodeos: *«HOY NINGUNA PANTALLA SE SUSCRIBE,
 * a propósito»*. Lo único de infrarrojos que llegaba a la interfaz era **un
 * booleano**, `conduciendo_por_ir`, y por el canal barato.
 *
 * Mientras tanto, en el Taller ya hay **cinco prácticas de IR** y `atriz.py` da
 * siete métodos. O sea que el alumno ya podía hacerlo todo —incluido poner el
 * robot a seguir a otro— y **no podía verlo**.
 *
 * 👤 Pedido por el usuario: *«todo lo que tenemos disponible hasta ahora con los
 *    sensores IR quiero que lo incluyas en alguna sección»*.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LAS TRES COSAS QUE ESTA PANTALLA TIENE PROHIBIDO HACER
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. **Una brújula de cuatro cuadrantes.** Está medido con los dos robots que
 *    DELANTE y DERECHA dan **exactamente el mismo patrón** de sensores. Pintar
 *    cuatro sería mentir con datos reales — el fallo del clasificador de color de
 *    este mismo repositorio, con otra cara.
 * 2. **Decir «no hay nadie».** La lectura es intermitente: el emisor manda cada
 *    0,4 s contra un registro que caduca al segundo, así que salen muestras
 *    vacías entre medias. Por eso el tipo se llama `NADIE_EN_ESTA_MUESTRA`.
 * 3. **Confirmar que se emitió.** El infrarrojo es INVISIBLE: no hay testigo
 *    humano posible, y `/send_infrared_message` solo dice que el servicio no
 *    lanzó. Lo único que lo confirma es el `/estado_ir` **del otro robot**.
 *
 * ⚠️ COSTE: `/estado_ir` va a 1 Hz y **su caudal NO está medido**. Lo esperable
 *    es el orden de `/estado_robot` —348 bytes a 1 Hz, 0,35 kB/s—, pero esperable
 *    no es medido y por eso no entra en `CAUDAL_KBS` ni en el muro. Solo corre
 *    mientras esta pestaña está abierta.
 *
 * ⏳ Y NADA DE ESTO HA VISTO UN `/estado_ir` REAL: hace falta un segundo robot.
 */

import { useCallback, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { SIN_DATO, horaCorta, numero } from '@/lib/interfaz/formato'
import {
  AVISO_EMISION, CODIGO_MAX, CODIGO_MIN, FUERZA_MAX, FUERZA_MIN, FUERZA_POR_DEFECTO,
  NOMBRE_MODO_IR, NOMBRE_ZONA, ZonaIR, avisoConduccionIR, peticionBaliza, peticionIR, ultimoMensaje,
  zonaDelEmisor,
} from '@/lib/robot/infrarrojos'
import {
  NOMBRE_MODO_CONDUCCION, SEGUNDOS_POR_DEFECTO, TOPE_SEGUNDOS,
  type ModoConduccionIR, peticionConduccionIR,
} from '@/lib/robot/conduccion_ir'
import { Aviso } from '@/componentes/ui/Aviso'
import { Dato } from '@/componentes/ui/Dato'

const SERVICIO_EMITIR = '/send_infrared_message'
/*
 * 🔴 LA BALIZA TIENE SU PROPIO SERVICIO, Y ESO ES LA SEGURIDAD.
 *    `set_ir_mode` lleva `broadcasting` y `following` en el mismo campo como
 *    cadena libre, y la lista blanca filtra por servicio, no por argumento: si
 *    la web hablara con aquel, tendría abierto también el modo que hace
 *    **conducir al robot solo** —sin watchdog ni `collision_monitor`, porque los
 *    modos IR son del firmware y no pasan por `cmd_vel`—.
 *    Aquí la petición es un booleano: la orden peligrosa **no se puede
 *    escribir**. Encargado a la Pi el 2026-08-16 y desplegado el 2026-08-17.
 */
const SERVICIO_BALIZA = '/set_ir_baliza'
/*
 * 🔴🔴 EL ÚNICO MANDO DE ESTA PANTALLA QUE PONE EL ROBOT A CONDUCIR.
 *    `seguir` y `huir` son modos del FIRMWARE: el RVR conduce solo, sin pasar
 *    por `cmd_vel`, así que **ni el watchdog ni el `collision_monitor` lo ven**.
 *    Es la única forma de mover un robot de este laboratorio con la capa de
 *    seguridad fuera del circuito.
 *
 *    Por eso el plazo es obligatorio y con tope: no existe la petición «para
 *    siempre». El driver arma un temporizador de un disparo y lo apaga solo.
 */
const SERVICIO_CONDUCCION = '/set_ir_conduccion'

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * EL TERCER CÓDIGO PARA LAS ZONAS: forma de línea, no color
 * ═══════════════════════════════════════════════════════════════════════════
 * La gramática de `marca-estado` habla de PRESENCIA DE DATO, no de bueno/malo, y
 * encaja sin forzarla:
 *
 *   entera    las tres zonas MEDIDAS y el patrón desconocido: el dato está
 *   guionada  «nadie en esta muestra»: llega a ratos, que es literalmente el
 *             comportamiento del sensor
 *   media     rancia y sin sondeo: no se sabe
 *
 * 🔴 `PATRON_NO_MEDIDO` se lleva la marca ENTERA a propósito: el dato SÍ está
 *    —hay alguien cerca, eso lo dice el sensor—; lo que falta es la traducción.
 *    Darle la marca de «no se sabe» diría que no ha llegado nada.
 */
const MARCA: Readonly<Record<ZonaIR, string>> = {
  IZQUIERDA: 'marca-bien',
  DETRAS: 'marca-bien',
  DELANTE_O_DERECHA: 'marca-bien',
  PATRON_NO_MEDIDO: 'marca-bien',
  NADIE_EN_ESTA_MUESTRA: 'marca-atencion',
  RANCIA: 'marca-neutro',
  SIN_SONDEO: 'marca-neutro',
}

const TINTA: Readonly<Record<ZonaIR, string>> = {
  IZQUIERDA: 'text-[rgb(var(--estado-vivo))]',
  DETRAS: 'text-[rgb(var(--estado-vivo))]',
  DELANTE_O_DERECHA: 'text-[rgb(var(--estado-vivo))]',
  PATRON_NO_MEDIDO: 'text-[rgb(var(--estado-mirar))]',
  NADIE_EN_ESTA_MUESTRA: 'text-[rgb(var(--estado-mirar))]',
  RANCIA: 'text-[rgb(var(--estado-neutro))]',
  SIN_SONDEO: 'text-[rgb(var(--estado-neutro))]',
}

export function PanelInfrarrojos() {
  const { transporte, conectado } = useRobot()
  const estado = useTopic(transporte, '/estado_ir')

  const [codigo, setCodigo] = useState(0)
  const [fuerza, setFuerza] = useState(FUERZA_POR_DEFECTO)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ hora: string; texto: string; malo: boolean } | null>(null)

  const [farCode, setFarCode] = useState(0)
  const [nearCode, setNearCode] = useState(0)
  const [balizaEnviando, setBalizaEnviando] = useState(false)
  const [balizaResultado, setBalizaResultado] =
    useState<{ hora: string; texto: string; malo: boolean } | null>(null)

  const cambiarBaliza = useCallback(async (encender: boolean) => {
    const cuerpo = peticionBaliza(encender, farCode, nearCode)
    const hora = horaCorta(Date.now())
    /*
     * `peticionBaliza` solo devuelve `null` al ENCENDER con un código malo:
     * apagar funciona siempre, a propósito. Un mando que apaga algo no puede
     * quedarse bloqueado porque haya un valor raro en otro control.
     */
    if (cuerpo === null) {
      setBalizaResultado({ hora, texto: 'Los códigos tienen que estar entre 0 y 7. No se ha enviado nada.', malo: true })
      return
    }
    setBalizaEnviando(true)
    try {
      const r = await transporte.llamar(SERVICIO_BALIZA, cuerpo) as Record<string, unknown>
      const ok = r.success === true
      const m = typeof r.message === 'string' && r.message !== '' ? ` El robot dice: «${r.message}»` : ''
      setBalizaResultado({
        hora,
        malo: !ok,
        texto: ok
          ? (encender
            ? `Baliza encendida: lejos ${farCode}, cerca ${nearCode}.${m}`
            : `Baliza apagada — y con ella el seguimiento y la evasión.${m}`)
          : `El robot rechazó la orden.${m}`,
      })
    } catch (e) {
      setBalizaResultado({
        hora, malo: true,
        texto: `La orden NO se ha enviado: ${e instanceof Error ? e.message : String(e)}`,
      })
    } finally {
      setBalizaEnviando(false)
    }
  }, [transporte, farCode, nearCode])

  const [modoCond, setModoCond] = useState<ModoConduccionIR>('seguir')
  const [segundos, setSegundos] = useState(SEGUNDOS_POR_DEFECTO)
  const [condEnviando, setCondEnviando] = useState(false)
  const [condResultado, setCondResultado] =
    useState<{ hora: string; texto: string; malo: boolean } | null>(null)

  const mandarConduccion = useCallback(async (modo: ModoConduccionIR) => {
    const cuerpo = peticionConduccionIR(modo, farCode, nearCode, segundos)
    const hora = horaCorta(Date.now())
    if (cuerpo === null) {
      setCondResultado({
        hora, malo: true,
        texto: `Los códigos van de 0 a 7 y el plazo de 1 a ${TOPE_SEGUNDOS} s. No se ha enviado nada.`,
      })
      return
    }
    setCondEnviando(true)
    try {
      const r = await transporte.llamar(SERVICIO_CONDUCCION, cuerpo) as Record<string, unknown>
      const ok = r.success === true
      const m = typeof r.message === 'string' && r.message !== '' ? ` El robot dice: «${r.message}»` : ''
      setCondResultado({
        hora,
        malo: !ok,
        texto: ok
          ? (modo === 'off'
            ? `Conducción por infrarrojos apagada.${m}`
            : `El robot va a ${NOMBRE_MODO_CONDUCCION[modo]} durante ${segundos} s.${m}`)
          : `El robot rechazó la orden.${m}`,
      })
    } catch (e) {
      setCondResultado({
        hora, malo: true,
        texto: `La orden NO se ha enviado: ${e instanceof Error ? e.message : String(e)}`,
      })
    } finally {
      setCondEnviando(false)
    }
  }, [transporte, farCode, nearCode, segundos])

  const emitir = useCallback(async () => {
    const cuerpo = peticionIR(codigo, fuerza)
    const hora = horaCorta(Date.now())
    /*
     * 🔴 `peticionIR` devuelve `null` en vez de recortar. Si esto no estuviera,
     *    un valor fuera de rango se doblaría en silencio y la pantalla diría que
     *    emitió lo que se pidió. Aquí no puede pasar —los dos controles acotan—
     *    y aun así se comprueba: el día que alguien añada un campo de texto, la
     *    guarda ya está puesta.
     */
    if (cuerpo === null) {
      setResultado({ hora, texto: 'El código o la fuerza están fuera de rango. No se ha enviado nada.', malo: true })
      return
    }
    setEnviando(true)
    try {
      const r = await transporte.llamar(SERVICIO_EMITIR, cuerpo) as Record<string, unknown>
      const ok = r.success === true
      const mensaje = typeof r.message === 'string' && r.message !== '' ? ` El robot dice: «${r.message}»` : ''
      setResultado({
        hora,
        malo: !ok,
        texto: ok
          ? `Orden enviada: código ${codigo} por los cuatro emisores.${mensaje}`
          : `El robot rechazó la orden.${mensaje}`,
      })
    } catch (e) {
      setResultado({
        hora,
        malo: true,
        texto: `La orden NO se ha enviado: ${e instanceof Error ? e.message : String(e)}`,
      })
    } finally {
      setEnviando(false)
    }
  }, [transporte, codigo, fuerza])

  const lectura = estado === null ? null : zonaDelEmisor(estado)
  const mensaje = estado === null ? null : ultimoMensaje(estado)
  const conduciendo = estado === null ? null : avisoConduccionIR(estado)

  return (
    <div className="space-y-4">
      {/*
        ═══════════════════════════════════════════════════════════════════════
        🔴🔴 ESTO VA PRIMERO PORQUE ES LO ÚNICO QUE MUEVE EL ROBOT
        ═══════════════════════════════════════════════════════════════════════
        `following` y `evading` son modos del FIRMWARE: el RVR conduce solo, sin
        pasar por `cmd_vel`. Ni el vigilante del driver ni el `collision_monitor`
        los ven. La web no los puede pedir —no están en la lista blanca, a
        propósito— pero el alumno los arranca desde el Taller con `seguir_a_otro()`,
        así que esta pantalla **sí los puede recibir**.
      */}
      {conduciendo !== null && (
        <Aviso nivel="ERROR" titulo="Este robot se mueve solo">
          {conduciendo}
        </Aviso>
      )}

      {!conectado ? (
        <Aviso nivel="NOTA" titulo="Sin enlace">
          Sin WebSocket no llega <code>/estado_ir</code>, así que no se sabe nada de los
          infrarrojos.
        </Aviso>
      ) : estado === null ? (
        <Aviso nivel="NOTA" titulo="Todavía no ha llegado /estado_ir">
          El topic va a <strong>1 Hz</strong>. Si no llega en unos segundos, mira si el driver está
          publicando: esta pantalla no puede distinguir «aún no» de «nunca».
        </Aviso>
      ) : (
        <>
          {/* ── Dónde está el otro robot ──────────────────────────────── */}
          <div className="pozo-interior px-5 py-4" role="status">
            <span className="microetiqueta">otro robot</span>
            <div className={`mt-1 flex items-center gap-2 ${TINTA[lectura!.zona]}`}>
              <span aria-hidden="true" className={`marca-estado ${MARCA[lectura!.zona]}`} />
              <span className="text-xl font-semibold leading-none">{NOMBRE_ZONA[lectura!.zona]}</span>
            </div>
            {/*
              🔴 LA EVIDENCIA VA SIEMPRE, NO PLEGADA. Sin ella el veredicto es una
                 opinión: «detrás» y «detrás porque responden los sensores 1 y 3,
                 que es el patrón medido» son dos afirmaciones distintas, y solo
                 la segunda se puede discutir. Es lo que hace que esta pantalla no
                 sea una brújula.
            */}
            <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
              {lectura!.evidencia}
            </p>
          </div>

          {/*
            🔴 SI `sensor_0` TRAE DATOS ALGÚN DÍA, LA MEDIDA DE LA QUE CUELGA TODO
               ESTO SE HA QUEDADO CORTA. No llevó datos NUNCA en los dos robots y
               en ~10 experimentos, y sobre eso se construyeron los tres patrones.
               Se saca a la superficie en vez de ignorarlo: así es como se pierde
               un hallazgo.
          */}
          {lectura!.sensor0ConDatos && (
            <Aviso nivel="ATENCION" titulo="El sensor 0 está trayendo datos, y nunca lo había hecho">
              Los tres patrones de esta pantalla se midieron con <code>sensor_0</code> mudo en los
              dos robots. Si ahora habla, <strong>hay que repetir la medida</strong>: lo que dice
              arriba puede haberse quedado corto.
            </Aviso>
          )}

          <div className="rejilla sm:grid-cols-2 xl:grid-cols-4">
            <Dato
              etiqueta="Modo"
              valor={NOMBRE_MODO_IR[estado.modo] ?? estado.modo}
              nota={estado.modo === 'broadcasting'
                ? `Emitiendo los códigos ${estado.far_code} (lejos) y ${estado.near_code} (cerca).`
                : undefined}
            />
            {/*
              🔴 `hay_mensaje` NO ES UN ADORNO: sin él, `ultimo_codigo = 0` no se
                 distingue de «llegó el código 0», que es un código válido.
            */}
            <Dato
              etiqueta="Último código"
              valor={mensaje === null ? SIN_DATO : String(mensaje.codigo)}
              crudo={mensaje?.codigo}
              antiguedad={mensaje === null || !Number.isFinite(mensaje.antiguedadS)
                ? undefined
                : `hace ${numero(mensaje.antiguedadS, 1)} s`}
              nota={mensaje === null ? 'No ha llegado ningún mensaje desde que arrancó el driver.' : undefined}
            />
            <Dato
              etiqueta="Edad de la lectura"
              valor={Number.isFinite(estado.antiguedad_lectura_s)
                ? `${numero(estado.antiguedad_lectura_s, 2)} s`
                : SIN_DATO}
              crudo={estado.antiguedad_lectura_s}
              nota="El registro del firmware caduca al segundo: más viejo que eso no dice dónde hay nadie."
            />
            <Dato
              etiqueta="Sensores"
              valor={`${estado.sensor_1} · ${estado.sensor_2} · ${estado.sensor_3}`}
              nota="Los sensores 1, 2 y 3. 255 es «no veo nada». El 0 no lleva datos nunca."
            />
          </div>
        </>
      )}

      {/* ── Emitir ────────────────────────────────────────────────────── */}
      <div className="rounded border border-border p-4">
        <h3 className="text-sm font-medium">Decirle algo a otro robot</h3>
        <p className="mt-0.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          Emite un código por los cuatro emisores. <strong>No mueve este robot.</strong>
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <span className="microetiqueta mb-1.5 block" id="cod-etiqueta">código</span>
            {/*
              🔴 OCHO BOTONES Y NO UN CAMPO. El rango es 0-7 y no va a crecer: son
                 los códigos que el firmware admite. Con ocho valores, un campo de
                 número solo añade la posibilidad de escribir un 9.
              ⚠️ Y ocho códigos para DIECISÉIS robots: dos del aula comparten
                 código por fuerza y son indistinguibles. Se dice abajo.
            */}
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="cod-etiqueta">
              {Array.from({ length: CODIGO_MAX - CODIGO_MIN + 1 }, (_, i) => i + CODIGO_MIN).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={codigo === c}
                  disabled={!conectado || enviando}
                  onClick={() => setCodigo(c)}
                  className={`pulsable focus-ring w-9 rounded-md border py-1.5 text-sm tabular-nums disabled:cursor-not-allowed disabled:opacity-45 ${
                    codigo === c
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-[rgb(var(--filo)/0.2)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[14rem] flex-1">
            <label htmlFor="ir-fuerza" className="microetiqueta mb-1.5 block">fuerza</label>
            <div className="flex items-center gap-3">
              <input
                id="ir-fuerza"
                type="range"
                min={FUERZA_MIN}
                max={FUERZA_MAX}
                step={1}
                value={fuerza}
                disabled={!conectado || enviando}
                onChange={(e) => setFuerza(Number(e.target.value))}
                className="deslizador focus-ring w-full"
              />
              <output htmlFor="ir-fuerza" className="cifra-menor shrink-0 tabular-nums">{fuerza}</output>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { void emitir() }}
            disabled={!conectado || enviando}
            aria-busy={enviando}
            className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {enviando ? 'Enviando…' : 'Emitir'}
          </button>
        </div>

        {/*
          🔴 LA MISMA FUERZA A LOS CUATRO, Y NO ES UNA SIMPLIFICACIÓN DE LA
             INTERFAZ: el firmware deja encender y apagar cada emisor por
             separado, pero **el nivel tiene que ser el mismo en todos los
             encendidos**. Cuatro deslizadores ofrecerían una combinación que el
             robot no puede cumplir. Es lo que hace `atriz.py` del robot.
        */}
        <p className="mt-3 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          {AVISO_EMISION}
        </p>

        {resultado !== null && (
          <div className="mt-3" role="status">
            {/*
              🔴 NUNCA «se emitió». El infrarrojo es INVISIBLE: no hay testigo
                 humano posible, que es lo que en los demás servicios salva la
                 papeleta. Lo único que confirma esto es el `/estado_ir` del OTRO
                 robot trayendo el código.
            */}
            <Aviso
              nivel={resultado.malo ? 'ERROR' : 'NOTA'}
              titulo={`${resultado.malo ? 'No salió' : 'Orden enviada'} · ${resultado.hora}`}
            >
              {resultado.texto}
              {!resultado.malo && (
                <> No se puede comprobar desde aquí: el infrarrojo no se ve, y este robot no se
                escucha a sí mismo. <strong>Míralo en el «último código» del otro robot.</strong></>
              )}
            </Aviso>
          </div>
        )}
      </div>

      {/*
        ═══════════════════════════════════════════════════════════════════════
        LA BALIZA CONTINUA — emitir hasta que alguien la apague
        ═══════════════════════════════════════════════════════════════════════
        🔴 SE PUEDE CONFIRMAR MEDIO EFECTO, Y HAY QUE DECIR CUAL. El `success`
           del servicio dice que el driver acepto la peticion. Pero `/estado_ir`
           publica `modo`, `far_code` y `near_code`, asi que la pantalla SI
           puede enseñar que **el robot dice estar emitiendo** —eso es
           observable, arriba, en «modo»—. Lo que sigue sin poder confirmarse es
           que la luz infrarroja salga de verdad: es invisible y el robot no se
           escucha a si mismo. Son dos cosas distintas y se dicen por separado.
      */}
      <div className="vidrio p-5">
        <h3 className="filete-titulo text-[17px] font-semibold tracking-tight">Baliza continua</h3>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          Deja el robot <strong>emitiendo sin parar</strong>, para que otro lo encuentre. A
          diferencia de «Emitir», que manda un solo mensaje, esto <strong>queda encendido hasta
          que lo apagues</strong>.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="microetiqueta">Código lejos</span>
            <input
              type="number" min={CODIGO_MIN} max={CODIGO_MAX} step={1} value={farCode}
              onChange={(e) => setFarCode(Number(e.target.value))}
              className="focus-ring w-20 rounded-md border border-[rgb(var(--filo)/0.2)] bg-transparent px-2 py-1.5 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="microetiqueta">Código cerca</span>
            <input
              type="number" min={CODIGO_MIN} max={CODIGO_MAX} step={1} value={nearCode}
              onChange={(e) => setNearCode(Number(e.target.value))}
              className="focus-ring w-20 rounded-md border border-[rgb(var(--filo)/0.2)] bg-transparent px-2 py-1.5 font-mono"
            />
          </label>

          <button
            type="button"
            onClick={() => { void cambiarBaliza(true) }}
            disabled={!conectado || balizaEnviando}
            aria-busy={balizaEnviando}
            className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {balizaEnviando ? 'Enviando…' : 'Encender baliza'}
          </button>
          <button
            type="button"
            onClick={() => { void cambiarBaliza(false) }}
            disabled={!conectado || balizaEnviando}
            aria-busy={balizaEnviando}
            className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            Apagar
          </button>
        </div>

        {/*
          🔴 ESTO NO ES LETRA PEQUEÑA. «Apagar» apaga TRES cosas, y quien pulse
             para callar la baliza estara ademas desactivando el seguimiento. Es
             la semantica del driver —lo dice el propio `.srv`— y no se adivina
             mirando un boton que pone «Apagar».
        */}
        <p className="mt-3 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          <strong>Apagar apaga tres cosas</strong>: la baliza, el seguimiento y la evasión. No hay
          forma de apagar solo una. Y los códigos van <strong>de 0 a 7</strong>, así que con
          dieciséis robots hay parejas que comparten código y son indistinguibles.
        </p>

        {balizaResultado !== null && (
          <div className="mt-3" role="status">
            <Aviso
              nivel={balizaResultado.malo ? 'ERROR' : 'NOTA'}
              titulo={`${balizaResultado.malo ? 'No salió' : 'Orden aceptada'} · ${balizaResultado.hora}`}
            >
              {balizaResultado.texto}
              {!balizaResultado.malo && (
                <> Que el robot <strong>diga</strong> estar emitiendo se ve arriba, en{' '}
                <strong>«modo»</strong>. Que la luz infrarroja salga de verdad{' '}
                <strong>no se puede comprobar desde aquí</strong>: es invisible y este robot no se
                escucha a sí mismo — hace falta el «último código» del otro.</>
              )}
            </Aviso>
          </div>
        )}
      </div>

      {/*
        ═════════════════════════════════════════════════════════════════════
        SEGUIR Y HUIR — el único mando de esta pantalla que MUEVE el robot
        ═════════════════════════════════════════════════════════════════════
        🔴 Va el ÚLTIMO de la pestaña a propósito: es lo más peligroso que hay
           aquí, y quien llega buscando «leer el sensor» no tiene que tropezarse
           con ello antes que con lo que venía a hacer.
      */}
      <div className="vidrio p-5">
        <h3 className="filete-titulo text-[17px] font-semibold tracking-tight">
          Seguir o huir de otro robot
        </h3>

        <div className="mt-3">
          <Aviso nivel="ATENCION" titulo="Esto MUEVE el robot, y la capa de seguridad no lo ve">
            Los conduce su <strong>firmware</strong>, no esta web: no pasa por{' '}
            <code>cmd_vel</code>, así que <strong>ni el vigilante ni el{' '}
            <code>collision_monitor</code> intervienen</strong>. Es la única forma de mover un
            robot de este laboratorio con la capa de seguridad fuera del circuito. Por eso{' '}
            <strong>el plazo es obligatorio</strong>: el robot se apaga solo al vencer, como
            máximo a los {TOPE_SEGUNDOS} s. La parada de emergencia también lo corta.
          </Aviso>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="microetiqueta">Qué hace</span>
            <select
              value={modoCond}
              onChange={(e) => setModoCond(e.target.value as ModoConduccionIR)}
              className="focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] bg-transparent px-2 py-1.5"
            >
              <option value="seguir">{NOMBRE_MODO_CONDUCCION.seguir}</option>
              <option value="huir">{NOMBRE_MODO_CONDUCCION.huir}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="microetiqueta">Durante (s)</span>
            <input
              type="number" min={1} max={TOPE_SEGUNDOS} step={1} value={segundos}
              onChange={(e) => setSegundos(Number(e.target.value))}
              className="focus-ring w-24 rounded-md border border-[rgb(var(--filo)/0.2)] bg-transparent px-2 py-1.5 font-mono"
            />
          </label>

          <button
            type="button"
            onClick={() => { void mandarConduccion(modoCond) }}
            disabled={!conectado || condEnviando}
            aria-busy={condEnviando}
            className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {condEnviando ? 'Enviando…' : 'Empezar'}
          </button>
          <button
            type="button"
            onClick={() => { void mandarConduccion('off') }}
            disabled={!conectado || condEnviando}
            aria-busy={condEnviando}
            className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            Parar ahora
          </button>
        </div>

        {/*
          🔴🔴 EVIDENCIA 129, Y NO ES LETRA PEQUEÑA. Se dice porque quien esté
             delante del robot es el único que puede resolverlo, y el síntoma no
             se parece a la causa: la web seguirá viva y con latido.
             ⚠️ n=1 y la hipótesis de disparo NO está confirmada — se cuenta como
             lo que es, no como una certeza, porque este proyecto no afirma lo
             que no ha medido.
        */}
        <div className="mt-3">
          <Aviso nivel="NOTA" titulo="Pasó una vez: el robot se quedó a medias al apagar un seguimiento">
            El 17 de agosto de 2026, al apagar un <em>seguir</em> activo, el RVR{' '}
            <strong>dejó de mandar telemetría pero siguió contestando</strong> a las órdenes de
            infrarrojos. En esta pantalla se vería así:{' '}
            <strong>las medidas se quedan viejas mientras el robot parece conectado</strong>.
            Ocurrió <strong>una vez</strong> y no se sabe qué lo dispara.{' '}
            <strong>Se arregla apagando y encendiendo el RVR con su botón</strong> — la Raspberry
            Pi se recupera sola.
          </Aviso>
        </div>

        {condResultado !== null && (
          <div className="mt-3" role="status">
            <Aviso
              nivel={condResultado.malo ? 'ERROR' : 'NOTA'}
              titulo={`${condResultado.malo ? 'No salió' : 'Orden aceptada'} · ${condResultado.hora}`}
            >
              {condResultado.texto}
              {!condResultado.malo && (
                <> Lo que hace el robot se ve arriba, en <strong>«modo»</strong>: ahí sale si de
                verdad está conduciendo por infrarrojos.</>
              )}
            </Aviso>
          </div>
        )}
      </div>

      <Aviso nivel="ATENCION" titulo="Tres límites del hardware, medidos">
        Solo hay <strong>8 códigos para 16 robots</strong>: dos del aula comparten código por
        fuerza y son indistinguibles. El sensor discrimina <strong>tres zonas, no cuatro</strong> —
        delante y a la derecha dan el mismo patrón en los dos robots—. Y con{' '}
        <strong>más de dos robots emitiendo a la vez no está medido</strong>: no se sabe si se
        estorban.
      </Aviso>
    </div>
  )
}
