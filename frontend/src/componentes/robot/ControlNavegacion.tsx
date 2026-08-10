'use client'

/**
 * ARRANCAR Y PARAR SLAM Y NAV2 DESDE LA WEB, sin SSH.
 *
 * 🔴🔴 CORREGIDO EL 2026-08-08 DESDE EL ROBOT: LO DE ABAJO ERA FALSO AL
 *      ESCRIBIRSE. Esta cabecera decía «NO VERIFICADO […] hasta que el supervisor
 *      corra, `/pedir_slam` y `/pedir_nav` **no existirán en el robot**». El
 *      supervisor lleva corriendo desde el **2026-08-07**, los dos servicios
 *      contestan, y esa misma tarde se usaron de verdad: `/pedir_slam` levantó
 *      SLAM y se mapeó el cuarto, `/pedir_nav` levantó Nav2 y navegó.
 *
 *      📝 **La lección, en su versión de dos máquinas:** este cliente dedujo el
 *      estado del robot de **cuándo se había subido el código**, no de haberlo
 *      consultado. **El repositorio dice qué existe; solo el robot dice qué está
 *      corriendo.** Es la misma forma que «`ros2 topic list` incluye topics de
 *      nodos muertos»: la lista y el proceso son cosas distintas.
 *
 * ✅ **Lo que sí sigue en pie, y es lo útil:** que el mensaje de plazo agotado
 *    **nombre el servicio**. El caso existe de verdad —un driver caído o una
 *    unidad `latcheada` dan exactamente esa firma—, solo que la causa no es la
 *    que yo suponía.
 *
 * ✅ **VALIDADA CONTRA EL SUPERVISOR REAL. Aquí decía que no, y era falso.**
 *
 * Esta línea rezaba «los seis estados se han visto contra un doble, no contra
 * el supervisor real» — cierto al escribirla, falso desde el 2026-08-09. **Cinco
 * de los seis se han visto de verdad, en rvr-01**, y cada uno por una vía
 * distinta:
 *
 *     APAGADO      las dos unidades, en reposo y tras pararlas
 *     ARRANCANDO   SLAM 4 · 9 · 14 s (2026-08-09) · Nav2 1…21 s (2026-08-10),
 *                  con los segundos SUBIENDO, que es lo que la pantalla pinta
 *     FUNCIONANDO  SLAM en ~18 s · Nav2 en 21 s
 *     CIEGO        forzado apagando el barrido con SLAM vivo — el estado que
 *                  `systemctl is-active` llamaría `active`
 *     MUDO         apareció SOLO las dos veces, al parar SLAM y al parar Nav2
 *     DESCONOCIDO  con `atriz-slam.service` sin instalar (2026-08-07)
 *
 * ⏳ **El único que no se ha visto es `FALLO`**, y no se fuerza a la ligera: la
 *    forma barata de provocarlo —pedir Nav2 sin mapa— agota el `StartLimitBurst`
 *    en ~40 s y deja la unidad `failed`, de la que **solo se sale con
 *    `reset-failed` desde el robot**. Se probaría de paso el `latcheado`, pero
 *    deja el robot inservible desde la web hasta que alguien entre por SSH.
 *
 * 📝 Y la lección, por segunda vez en este fichero: **un «no verificado» que ya
 *    no lo es manda a desconfiar de código que funciona**, y gasta la
 *    credibilidad de los avisos que sí importan. Al validar algo, hay que venir
 *    a borrar su marca — no basta con anotarlo en la bitácora.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE SE PIDE Y NO SE ORDENA
 * ═══════════════════════════════════════════════════════════════════════════
 * `/pedir_slam` y `/pedir_nav` son `SetBool`, y su `success` dice **que el
 * supervisor aceptó la petición**, no que la unidad esté funcionando. La
 * confirmación llega por `/estado_navegacion`, igual que `color_activo`
 * confirma `enable_color` y `parada_emergencia` confirma la liberación. Es el
 * tercer sitio donde este proyecto aplica la misma regla, y viene de que ya
 * midió lo contrario: `undercarriage_white` devuelve `success=true` y deja el
 * LED apagado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE HAY SESION
 * ═══════════════════════════════════════════════════════════════════════════
 * Nav2 son **~58 % de un núcleo** que salen de la batería del RVR, y la
 * autonomía (~2 h) ya no cubre una clase. Arrancarlo no es un gesto personal:
 * se lo gasta a todo el que use ese robot después. Mismo criterio que liberar
 * la parada — no porque sea peligroso, sino porque conviene que tenga un nombre
 * detrás.
 *
 * ⚠️ Y con el mismo límite, dicho igual de claro: **la sesión protege la
 *    interfaz, no el robot.** Cualquiera del aula puede llamar a esos servicios
 *    desde la consola del navegador sin pasar por aquí. Eso es la Fase B.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useSesion } from '@/hooks/ContextoSesion'
import { useTopic } from '@/hooks/useTopic'
import { horaCorta } from '@/lib/interfaz/formato'
import {
  UMBRAL_LATIDO_NAV_MS, decidirBoton, frase, leer, leerMapa, tono,
  type Sistema,
} from '@/lib/robot/navegacion'
import { Aviso } from '@/componentes/ui/Aviso'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/*
 * 🔴 LOS TOKENS SON TRIPLETES RGB, NO COLORES: `--estado-vivo: 21 122 61`. Hay
 *    que envolverlos en `rgb(...)` o la clase se genera y **no pinta nada** —
 *    que es lo que pasó al escribir esto: CIEGO y BLOQUEADO salieron en negro
 *    sobre la captura, o sea los dos estados más graves indistinguibles de un
 *    texto cualquiera. No lo vio `tsc`, ni `eslint`, ni las 538 pruebas.
 *
 * 🔴 Y los nombres van del vocabulario, no de la cabeza: la primera versión usó
 *    `--estado-bien` y `--estado-mal`, que **no existen**. Es la segunda vez que
 *    invento un token en este repositorio.
 */
const CLASE_TONO: Record<ReturnType<typeof tono>, string> = {
  BIEN: 'text-[rgb(var(--estado-vivo))]',
  AVISO: 'text-[rgb(var(--estado-mirar))]',
  // Teja, NO `--destructive`. En esta pantalla vive el slab de la parada de
  // emergencia, y `MarcoRobot` lleva escrito que es «el único elemento en rojo».
  // `--estado-ir` existe precisamente para alarmar sin ser EL rojo de la parada.
  MAL: 'text-[rgb(var(--estado-ir))]',
  NEUTRO: 'text-muted-foreground',
}

interface Envio { hora: string; texto: string; malo: boolean; pedia: 'ARRANCAR' | 'PARAR' }

export function ControlNavegacion() {
  const { transporte, conectado } = useRobot()
  const { usuario } = useSesion()
  const estado = useTopic(transporte, '/estado_navegacion')

  /*
   * 🔴 SI EL LATIDO NO AVANZA, TODO LO DEMAS ES VIEJO.
   *
   * `/estado_navegacion` va TRANSIENT_LOCAL: el último mensaje se queda ahí
   * aunque el supervisor muera, así que un enlatado de hace media hora entra
   * como si fuera de ahora. Sin esta guardia la pantalla pintaría FUNCIONANDO
   * sobre un robot que no tiene a nadie detrás — que es exactamente el fallo
   * que este proyecto lleva documentado desde el RVR dormido con el nodo vivo.
   */
  const visto = useRef<{ latido: number; cuando: number } | null>(null)
  const [avanza, setAvanza] = useState(false)

  useEffect(() => {
    if (estado === null) return
    const ahora = Date.now()
    if (visto.current === null || estado.latido > visto.current.latido) {
      visto.current = { latido: estado.latido, cuando: ahora }
      setAvanza(true)
    }
  }, [estado])

  // Y hay que MIRAR EL RELOJ, no solo reaccionar a los mensajes: si dejan de
  // llegar, este efecto no se vuelve a disparar nunca y `avanza` se quedaría
  // en `true` para siempre. Es la misma forma que el detector de silencio del
  // driver, y por la misma razón.
  useEffect(() => {
    const t = setInterval(() => {
      const v = visto.current
      setAvanza(v !== null && Date.now() - v.cuando < UMBRAL_LATIDO_NAV_MS)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  if (!conectado) {
    return (
      <Aviso nivel="ERROR" titulo="Sin enlace con el robot">
        No hay WebSocket, así que no se sabe si SLAM o Nav2 están corriendo, y no se puede pedir
        que arranquen.
      </Aviso>
    )
  }

  return (
    <Tarjeta titulo="Arrancar la navegación">
      <div className="grid gap-4 sm:grid-cols-2">
        <Sistema_ sistema="slam" avanza={avanza} usuario={usuario} />
        <Sistema_ sistema="nav" avanza={avanza} usuario={usuario} />
      </div>

      {usuario === null && (
        <p className="mt-4 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          Arrancar SLAM o Nav2 <strong>exige iniciar sesión</strong>. No es por peligro: Nav2 son
          ~58 % de un núcleo saliendo de la batería del robot, y la autonomía ya no cubre una
          clase entera — conviene que quede claro quién lo puso en marcha.
        </p>
      )}

      {/*
        🔴🔴 EL MAPA, CON NOMBRE Y FECHA — y aquí NO hay semáforo.
        ═══════════════════════════════════════════════════════════════════════
        El robot añadió `mapa_nombre` y `mapa_edad_s` el 2026-08-08 **para esta
        pantalla**, porque `hay_mapa` a solas no defiende del peor fallo medido:
        un mapa que NO es del sitio hace que Nav2 declare el objetivo cumplido a
        **41,3 cm**, con `SUCCEEDED` y sin una línea de error en ningún log.

        🔴 **Y aquí no se gradúa, se pregunta.** La edad NO mide lo que falla: un
        mapa de ayer del cuarto equivocado es igual de peligroso que uno de hace
        un mes, y `mapa_edad_s` es el `mtime` —copiar un mapa viejo lo
        rejuvenece—, así que un semáforo daría VERDE justo en el caso peor.
        Se enseñan los dos datos y se deja escrita la pregunta que solo puede
        contestar quien está mirando el aula.
      */}
      <MapaEnUso avanza={avanza} />

      <Contexto>
        <p>
          Estos botones <strong>piden</strong>, no ordenan. Que el servicio conteste que sí
          significa que el supervisor aceptó la petición, no que la unidad esté funcionando: eso
          lo dice el estado de arriba, que llega del robot una vez por segundo.
        </p>
        <p>
          🔴 <strong>«Levantado» no es «funcionando», y está medido.</strong> Un{' '}
          <code>slam_toolbox</code> que sobrevivió a un reinicio del driver se quedó con el búfer
          TF roto: <code>systemctl</code> decía <code>active</code>, los procesos estaban vivos, y
          el mapa salió <strong>idéntico celda a celda tras mover el robot 80 cm</strong>. Por eso
          aquí hay seis estados y no un interruptor — «levantado y no procesa» tiene su propia
          casilla.
        </p>
        <p>
          Y hay un agujero que esto <strong>no</strong> cierra: cualquier pestaña de la web puede
          apagar el barrido del LIDAR de este robot, y sin barrido la navegación se queda ciega.
          Lo que sí hace es <strong>dejar de ser silencioso</strong>: aparece como «no le llega el
          barrido» en un segundo o dos, en vez de como un robot que no obedece.
        </p>
      </Contexto>
    </Tarjeta>
  )
}

function MapaEnUso({ avanza }: { avanza: boolean }) {
  const { transporte } = useRobot()
  const estado = useTopic(transporte, '/estado_navegacion')
  const mapa = leerMapa(estado, avanza)

  if (mapa.nombre === null) {
    return (
      <p className="mt-4 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        El robot no dice qué mapa tiene. Sin uno, Nav2 no puede arrancar.
      </p>
    )
  }

  return (
    <div className="mt-4 rounded border border-border p-3">
      <p className="text-[13px] leading-relaxed">
        Mapa en uso: <strong>{mapa.nombre}</strong>
        {mapa.edad !== null && <> · guardado <strong>{mapa.edad}</strong></>}
      </p>
      <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        🔴 <strong>¿Es de este sitio, y no se han movido las mesas desde entonces?</strong> Es la
        única pregunta que protege del peor fallo medido: con un mapa que no era del sitio, Nav2
        dio el objetivo por cumplido <strong>a 41 cm</strong>, con la tolerancia en 10 y{' '}
        <strong>sin una sola línea de error en ningún log</strong>. Lo destapó una cinta métrica.
        Si dudas, vuelve a mapear — es más barato que la duda.
      </p>
      <p className="mt-1 max-w-prose text-[12px] leading-relaxed text-muted-foreground">
        ⚠️ La fecha es la del fichero, no la de cuándo se recorrió el sitio: copiar un mapa viejo
        lo rejuvenece. Por eso va el nombre al lado y la decisión es tuya.
      </p>
      {/*
        🔴🔴 AÑADIDO EL 2026-08-09 (evidencias 96 y 97), y corrige el sesgo de la
        línea de arriba. Esa avisa de que una fecha VIEJA puede engañar; el robot
        midió que una fecha NUEVA engaña en la dirección contraria, y peor,
        porque «guardado hace 2 minutos» se lee como una buena noticia.

        Lo que da valor a un mapa son los METROS recorridos, no su antigüedad:

            160 cm de recorrido ->  4 nodos ·  49 celdas · 89,3 % desconocido
            781 cm de recorrido -> 17 nodos · 506+       · 47,4 %

        Con el primero, Nav2 no encontraba ruta por un hueco de 47 cm y se
        atribuyó al ancho; con el segundo, el MISMO hueco da plan recto y el
        robot lo cruza. La causa no era el hueco: era el mapa.

        📌 Y explica el caso que este panel crea sin querer: arrancar SLAM aquí,
           pararlo y pasar a Navegar deja un mapa de segundos de antigüedad y
           casi vacío. **Mapear no es instantáneo: son metros.**

        🔴 SIGUE SIN HABER UMBRAL, y ahora por partida doble. El robot solo
           publica `mapa_nombre` y `mapa_edad_s`: nodos y cobertura no viajan,
           así que la web NO PUEDE medir la calidad. Y un umbral de «demasiado
           nuevo» sería falso — un mapa de 8 m puede tener dos minutos y estar
           perfecto. Se enseña el hecho y decide quien conduce, igual que con la
           edad. `navegacion.test.ts` impide añadir el umbral sin justificarlo.
      */}
      <p className="mt-1 max-w-prose text-[12px] leading-relaxed text-muted-foreground">
        ⚠️ Y una fecha reciente <strong>tampoco</strong> es buena noticia por sí sola: lo que hace
        útil a un mapa son los <strong>metros recorridos</strong> al hacerlo. Medido: con{' '}
        <strong>160 cm</strong> el mapa sale con 4 nodos y un 89 % sin explorar, y Nav2 no
        encuentra ruta por un hueco que <strong>sí cabe</strong>; con <strong>781 cm</strong>, el
        mismo hueco da plan recto. Si acabas de mapear en dos minutos, vuelve a hacerlo dando una
        vuelta al espacio.
      </p>
    </div>
  )
}

function Sistema_({
  sistema, avanza, usuario,
}: { sistema: Sistema; avanza: boolean; usuario: string | null }) {
  const { transporte } = useRobot()
  const estado = useTopic(transporte, '/estado_navegacion')
  const [enviando, setEnviando] = useState(false)
  const [envio, setEnvio] = useState<Envio | null>(null)

  const lectura = leer(estado, sistema, avanza)
  const boton = decidirBoton(lectura, sistema)
  const nombre = sistema === 'slam' ? 'SLAM' : 'Nav2'
  const servicio = sistema === 'slam' ? '/pedir_slam' : '/pedir_nav'

  const pedir = useCallback(async (arrancar: boolean) => {
    setEnviando(true)
    setEnvio(null)
    const hora = horaCorta(Date.now())
    try {
      const r = await transporte.llamar(servicio, { data: arrancar }) as { success?: unknown; message?: unknown }
      const ok = r?.success === true
      const detalle = typeof r?.message === 'string' && r.message.length > 0 ? ` El robot dice: «${r.message}»` : ''
      setEnvio({
        hora,
        pedia: arrancar ? 'ARRANCAR' : 'PARAR',
        /*
         * 🔴 «Petición aceptada», NUNCA «arrancado». El efecto lo confirma el
         *    estado de arriba, y tarda ~15-20 s (medido en rvr-01) en llegar a
         *    FUNCIONANDO.
         *
         * 🔴 Y EL TEXTO DEPENDE DE LO QUE SE PIDIO. Decía siempre «no dirá
         *    "funcionando" hasta que lo esté», y al pulsar PARAR eso es un
         *    sinsentido: se acaba de pedir lo contrario. Visto en el robot el
         *    2026-08-09, tras parar SLAM.
         */
        texto: ok
          ? (arrancar
            ? `Petición aceptada. Mira el estado: no dirá «funcionando» hasta que lo esté.${detalle}`
            : `Petición de parada aceptada. Mira el estado: no dirá «apagado» hasta que lo esté.${detalle}`)
          : `El supervisor ha rechazado la petición.${detalle || ' No ha dicho por qué.'}`,
        malo: !ok,
      })
    } catch (e) {
      /*
       * 🔴 EL CASO DE HOY, Y SE NOMBRA EL SERVICIO A PROPOSITO. Mientras el
       *    supervisor no esté instalado en el robot, este servicio no existe y
       *    rosbridge agota el plazo. «No respondió» a secas mandaría a buscar
       *    una avería; nombrarlo manda a mirar si el robot está actualizado.
       */
      setEnvio({
        hora,
        pedia: arrancar ? 'ARRANCAR' : 'PARAR',
        texto: `No hubo respuesta a ${servicio}: ${e instanceof Error ? e.message : String(e)}. `
          + 'Si el robot todavía no tiene instalado el supervisor de navegación, es esto y no una '
          + 'avería — el servicio aún no existe ahí.',
        malo: true,
      })
    } finally {
      setEnviando(false)
    }
  }, [transporte, servicio])

  /*
   * 🔴🔴 EL ACUSE SE RETIRA CUANDO EL ESTADO YA LO CONTESTA.
   *
   * Visto en el robot el 2026-08-09: SLAM llegó a «funcionando» a los ~18 s y el
   * aviso seguía diciendo *«no dirá "funcionando" hasta que lo esté»* **un minuto
   * después**, con «funcionando» escrito tres centímetros más arriba. Un mensaje
   * que dice «espera» cuando la espera terminó enseña a no leer los mensajes.
   *
   * → El acuse es de la PETICIÓN, y deja de aportar en cuanto el estado alcanza
   *   lo que se pidió. El de un RECHAZO se queda: ahí el estado no va a moverse,
   *   y retirarlo borraría la única explicación que hay.
   */
  const llego = envio !== null && !envio.malo && (
    envio.pedia === 'ARRANCAR'
      ? lectura.pintado !== 'APAGADO' && lectura.pintado !== 'ARRANCANDO'
      : lectura.pintado === 'APAGADO')

  const puedePulsar = boton.habilitado && usuario !== null && !enviando

  return (
    <div className="rounded border border-border p-3">
      {/*
        🔴 EN COLUMNA, NO EN UNA FILA CON `justify-between`. Con la fila, la frase
           de CIEGO —«levantado, pero no le llega el barrido — el robot no
           conducirá»— se aplastaba contra el título y ocupaba el ancho entero en
           una sola línea apretada. Es la frase más importante del panel.
      */}
      <h3 className="text-sm font-medium">{nombre}</h3>
      <p className={`mt-0.5 text-[13px] leading-snug ${CLASE_TONO[tono(lectura.pintado)]}`}>
        {frase(lectura, sistema)}
      </p>

      {lectura.detalle !== '' && (
        // Del robot, TAL CUAL. No se reescribe ni se resume aquí.
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{lectura.detalle}</p>
      )}

      {boton.accion !== null && (
        <button
          type="button"
          onClick={() => pedir(boton.accion === 'ARRANCAR')}
          disabled={!puedePulsar}
          className={`pulsable mt-3 w-full rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            boton.accion === 'PARAR'
              // 🔴 Teja, no `--destructive`: el rojo de la parada es exclusivo
              //    suyo y este panel comparte pantalla con ella.
              ? 'border border-[rgb(var(--estado-ir))] text-[rgb(var(--estado-ir))]'
              : 'bg-foreground text-background'
          }`}
        >
          {enviando
            ? 'Enviando…'
            : boton.accion === 'ARRANCAR' ? `Arrancar ${nombre}` : `Parar ${nombre}`}
        </button>
      )}

      {/*
        🔴 EL MOTIVO SIEMPRE, tambien cuando no hay boton. Un control gris y mudo
           —o su ausencia— se lee como un fallo de la web. Aqui siempre hay una
           frase que dice que pasa y, cuando se puede, que hacer.
      */}
      {boton.motivo !== '' && (
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          {boton.motivo}
        </p>
      )}

      {envio !== null && !llego && (
        <div className="mt-3" role="alert">
          <Aviso nivel={envio.malo ? 'ERROR' : 'NOTA'} titulo={`${nombre} · ${envio.hora}`}>
            {envio.texto}
          </Aviso>
        </div>
      )}
    </div>
  )
}
