'use client'

/**
 * POR QUÉ NO OBEDECE. La pantalla del robot que parece sano y no se mueve.
 *
 * La decisión de qué decir NO es de este componente: es de
 * `lib/robot/no_obedece.ts`, que es puro y tiene 10 pruebas detrás. Aquí solo
 * se pinta lo que aquella decide.
 *
 * ⚠️ Esta pantalla la propuso el análisis multiagente sobre el documento de
 *    plataforma, no el encargo original. Salió de dos lentes a la vez —«quien
 *    monta» y «seguridad»— y es la única de las diez que ataca directamente el
 *    modo de fallo mejor documentado del laboratorio.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA COMPOSICIÓN: TRES BANDAS, Y NO UNA PILA DE TARJETAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Esta pantalla eran dos tarjetas apiladas que terminaban a media página, y la
 * frase por la que existe —«Una causa encaja»— se pintaba como `titulo` de una
 * `Tarjeta`, o sea **con el mismo peso que «Batería»**. Un veredicto no es el
 * rótulo de una caja.
 *
 *   1. EL VEREDICTO, ancho y grande. Es lo único que hay que leer de lejos, y
 *      lleva el color de estado **solo cuando hay una causa confirmada**: sin
 *      confirmada no hay nada que el color pueda decir que el texto no diga.
 *   2. LAS TRES SEÑALES DE VIDA —enlace, `/odom`, `/scan`— que son las entradas
 *      de `diagnosticar()`. Enseñarlas separadas del veredicto es lo que deja
 *      ver **por qué** dice lo que dice.
 *   3. LAS CAUSAS, la lista entera de lo que se ha mirado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 Y LA JERARQUÍA ESTABA INVERTIDA, MEDIDA EN PÍXELES
 * ═══════════════════════════════════════════════════════════════════════════
 * En una captura de 1400×1800 con el robot apagado: la banda del VEREDICTO
 * —la razón de existir de esta pantalla— medía **172 px**, y el descargo «Lo
 * que esta pantalla no puede ver» medía **343, el doble exacto**. Un límite
 * escrito para no dar falsa tranquilidad se había comido a lo que limita.
 *
 * Y la página terminaba al 55 % del alto: **806 px de fondo vacío**, la única
 * de las nueve con ese hueco (taller 10 px, telemetría 2, diagnóstico 20). El
 * hueco no se rellena con adorno — se cierra subiendo lo que importa:
 *
 *   · el veredicto pasa a `clamp(2.2rem, 4vw, 3rem)`, y **la causa que encaja
 *     y qué hacer entran EN la propia banda**. Antes vivían 400 px más abajo,
 *     fuera del golpe de vista de alguien que mira esto proyectado.
 *   · el descargo baja a un aviso PLEGADO. Su frase —«que ninguna causa encaje
 *     no prueba que el robot obedezca»— sigue visible siempre, que es la parte
 *     que no se puede callar; los tres ejemplos se abren de un clic.
 *
 * Con eso las tres señales de vida suben al pliegue.
 */

import { ReactNode, useEffect, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import {
  Causa, EstadoCausa, UMBRAL_BARRIDO_MS, UMBRAL_ODOM_MUERTA_S, diagnosticar, resumen,
} from '@/lib/robot/no_obedece'
import { SIN_DATO, milisegundos, partirUnidad, segundos } from '@/lib/interfaz/formato'
import { Grupo } from '@/componentes/ui/Grupo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/**
 * EL DESCARGO, PLEGADO. Un aviso de nivel «NOTA» que además se abre.
 *
 * ⚠️ NO usa `<Aviso>`, y el motivo es de marcado, no de estilo: `Aviso` mete
 *    sus hijos en un `<span>`, cuyo modelo de contenido es texto —un `<details>`
 *    ahí dentro es HTML inválido—. Así que aquí se reproducen sus tres tokens
 *    (`--aviso-nota`, `--luz-a`, `.aparece`) sobre un `<details>` de verdad.
 *
 * 🔴 La frase que NO se pliega es la que no se puede callar: que ninguna causa
 *    encaje no prueba que el robot obedezca. Lo que se pliega son los ejemplos,
 *    que son contexto de fondo y valen igual con el robot encendido o apagado.
 */
function Descargo({ children }: { children: ReactNode }) {
  return (
    <details className="aparece group rounded-ficha border border-[rgb(var(--luz-a)/0.30)] bg-[rgb(var(--aviso-nota))] px-4 py-3 text-sm text-foreground">
      <summary className="focus-ring flex cursor-pointer list-none items-start gap-2">
        {/* El triángulo gira 90° al abrir, como en `Contexto`: dice si está
            abierto o cerrado, que es información y no adorno. */}
        <span
          aria-hidden="true"
          className="mt-0.5 inline-block shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-90"
        >
          ▸
        </span>
        <span className="max-w-prose leading-relaxed">
          <strong className="font-semibold">Lo que esta pantalla no puede ver: </strong>
          que ninguna causa encaje no prueba que el robot obedezca — prueba que no es ninguna de
          las que aquí se saben mirar.{' '}
          <span className="text-muted-foreground">Tres ejemplos, de un clic.</span>
        </span>
      </summary>
      {children}
    </details>
  )
}

const TONO: Readonly<Record<EstadoCausa, string>> = {
  CONFIRMADA: 'text-estado-ir',
  POSIBLE: 'text-estado-mirar',
  DESCARTADA: 'text-estado-vivo',
  NO_SE_SABE: 'text-estado-neutro',
}

const PALABRA: Readonly<Record<EstadoCausa, string>> = {
  CONFIRMADA: 'encaja',
  POSIBLE: 'puede ser',
  DESCARTADA: 'descartada',
  NO_SE_SABE: 'no se sabe',
}

/** Un icono por estado, dibujado. Nada de glifos Unicode ni emojis. */
function Marca({ estado }: { estado: EstadoCausa }) {
  const c = 'currentColor'
  return (
    <svg
      width="18" height="18" viewBox="0 0 20 20" fill="none"
      className={`${TONO[estado]} mt-0.5 shrink-0`} aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8.2" stroke={c} strokeWidth="1.5" />
      {estado === 'CONFIRMADA' && <path d="M10 5.6v5.2M10 13.7v.6" stroke={c} strokeWidth="1.9" strokeLinecap="round" />}
      {estado === 'DESCARTADA' && <path d="M6.4 10.2l2.4 2.4 4.8-4.8" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
      {estado === 'NO_SE_SABE' && <path d="M6.8 10h6.4" stroke={c} strokeWidth="1.7" strokeLinecap="round" />}
      {estado === 'POSIBLE' && <path d="M10 6.2v4.6M10 13.4v.6" stroke={c} strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  )
}

/**
 * Una causa de la lista.
 *
 * 🔴 `remedioArriba` EXISTE PARA NO DECIR LO MISMO DOS VECES EN LA MISMA
 *    PANTALLA. La banda del veredicto ya pinta el «qué hacer» de la primera
 *    causa confirmada, y con el robot apagado `diagnosticar()` devuelve **una
 *    sola causa**: sin esto, la tarjeta entera era una copia literal de la banda
 *    que tiene 300 px encima. Con enlace hay cuatro o cinco causas y solo una
 *    lleva la bandera, así que la lista sigue siendo la lista.
 */
function FilaCausa({ causa, remedioArriba = false }: {
  causa: Causa
  remedioArriba?: boolean
}) {
  return (
    <li className="flex gap-3.5 px-5 py-4">
      <Marca estado={causa.estado} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <h3 className="text-base font-semibold tracking-tight">{causa.titulo}</h3>
          <span className={`text-[11px] font-medium uppercase tracking-wider ${TONO[causa.estado]}`}>
            {PALABRA[causa.estado]}
          </span>
        </div>
        <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          {causa.evidencia}
        </p>
        {causa.remedio !== '' && !remedioArriba && (
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-foreground/85">
            {causa.remedio}
          </p>
        )}
        {causa.remedio !== '' && remedioArriba && (
          <p className="mt-2 text-[11px] italic leading-relaxed text-muted-foreground/80">
            Qué hacer, arriba en el veredicto.
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Una de las tres señales de vida de la banda del medio.
 *
 * 🔴 `valor === null` es LA AUSENCIA, y no se pinta con el peso del dato: una
 *    raya pequeña y apagada, como en `Dato` y en `Bateria`. Con el robot
 *    apagado —el estado más frecuente del laboratorio— dos de las tres celdas
 *    salen así, y una fila de rayas enormes sería peor que una fila vacía.
 *
 * 🔴 Y `alarma` tiñe **solo la señal que es el problema**, nunca las otras dos.
 *    Con el socket cerrado no se sabe nada de `/odom` ni de `/scan`: pintarlas
 *    en rojo sería afirmar un fallo que nadie ha medido.
 */
function Senal({ etiqueta, valor, alarma = false, nota }: {
  etiqueta: string
  /** Ya formateado («12,4 s»). `null` = no se sabe. */
  valor: string | null
  alarma?: boolean
  nota: string
}) {
  const { numero: cifra, unidad } = partirUnidad(valor ?? '')
  return (
    <div className="vidrio rounded-ficha px-5 py-5">
      <p className="microetiqueta">{etiqueta}</p>
      <p className="mt-3">
        {valor === null ? (
          <span className="hueco text-lg leading-none" title={SIN_DATO}>—</span>
        ) : (
          <span className={`cifra-menor ${alarma ? 'text-estado-ir' : 'text-foreground'}`}>
            {cifra}
            {unidad !== null && <span className="unidad">{unidad}</span>}
          </span>
        )}
      </p>
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{nota}</p>
    </div>
  )
}

export function PanelNoObedece() {
  const { transporte, conectado } = useRobot()
  const estado = useTopic(transporte, '/estado_robot')
  const barrido = useTopic(transporte, '/scan')
  /*
   * 🔴 `/collision_monitor_state` cuesta ~0 —publica al CAMBIAR, no cada tanto—,
   *    y sin él esta pantalla no podía ver la causa que más se parece a «no
   *    obedece»: el robot obedeciendo y recorriendo la mitad.
   */
  const monitor = useTopic(transporte, '/collision_monitor_state')
  useLatido()

  /*
   * 🔴 La pestaña oculta es una CAUSA, así que hay que saber si lo está. El
   *    navegador limita los temporizadores a ~1 Hz en segundo plano y el
   *    vigilante del driver corta a los 0,3 s: el robot para, y desde fuera
   *    parece que no obedece.
   */
  const [oculta, setOculta] = useState(false)
  useEffect(() => {
    const mirar = () => setOculta(document.visibilityState === 'hidden')
    mirar()
    document.addEventListener('visibilitychange', mirar)
    return () => document.removeEventListener('visibilitychange', mirar)
  }, [])

  const antiguedadOdomS = estado?.antiguedad_odom_s ?? null
  const msDesdeBarrido = transporte.msDesdeUltimo('/scan')

  const causas = diagnosticar({
    conectado,
    paradaEmergencia: estado?.parada_emergencia ?? null,
    rvrResponde: estado?.rvr_responde ?? null,
    antiguedadOdomS,
    reanudacionesFallidas: estado?.reanudaciones_fallidas ?? null,
    hayBarrido: barrido !== null,
    msDesdeBarrido,
    pestanaOculta: oculta,
    // `null` cuando no ha llegado nada, que NO es «no está frenando».
    frenadoMonitor: monitor === null
      ? null
      : { accion: monitor.action_type, poligono: monitor.polygon_name },
    /*
     * `null` mientras el topic no traiga nada: «no se sabe», no «no conduce».
     *
     * 📌 Sale de `/estado_robot` y NO de `/estado_ir`, aunque los dos lo traen.
     *    El robot lo duplicó a propósito el 2026-08-11 para que el canal barato
     *    —el que el muro puede pagar por los dieciséis— lo lleve también. Esta
     *    pantalla ya estaba suscrita a `/estado_robot`, así que leerlo de aquí
     *    le ahorra una suscripción entera.
     */
    conduciendoPorIR: estado?.conduciendo_por_ir ?? null,
  })

  /*
    Las que ENCAJAN, separadas de las examinadas. `diagnosticar()` devuelve todas
    las que sabe mirar con su estado, asi que «cuantas hay» y «cuantas encajan»
    son dos numeros distintos — y confundirlos es afirmar de mas.
  */
  const confirmadas = causas.filter((c) => c.estado === 'CONFIRMADA')
  const hayConfirmada = confirmadas.length > 0

  /*
   * `-1` en `antiguedad_odom_s` NO es «hace cero segundos»: es «nunca se ha
   * sabido nada de eso». Se pinta como hueco, igual que si no hubiera llegado.
   */
  const odomConocida = antiguedadOdomS !== null && antiguedadOdomS >= 0

  return (
    <div className="space-y-6">
      {/*
        ═════════════════════════════════════════════════════════════════════
        1 · EL VEREDICTO. La frase por la que existe esta pantalla.
        ═════════════════════════════════════════════════════════════════════
        🔴 El color solo cuando hay una causa CONFIRMADA, y siempre acompañando
           a la palabra que ya lo dice —«encaja», «encajan»—: una de cada doce
           personas no distingue el coral del lima, y esto se proyecta.
      */}
      {/*
        🔴 EL VEREDICTO ES UN BLOQUE PROTAGONISTA, NO UNA FRANJA. Medido en una
           captura: 172 px de banda contra 343 del descargo que la contradecía.
           El titular sube a `clamp(2.2rem, 4vw, 3rem)` —el escalón de un dato
           hero, que es lo que esta frase es en esta pantalla— y con él entran
           las dos cosas que vivían 400 px más abajo: CUÁL encaja y QUÉ HACER.
      */}
      <section className="vidrio rounded-ficha px-6 py-8 sm:px-9 sm:py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="microetiqueta">Veredicto</p>
          {/* «cuántas hay» y «cuántas encajan» son dos números distintos, y
              confundirlos es afirmar de más. */}
          <p className="microetiqueta">
            {/* El plural concuerda: con el socket cerrado `diagnosticar()`
                devuelve UNA sola causa, asi que «1 de 1 miradas» es el caso que
                mas se ve. */}
            {confirmadas.length} de {causas.length}{' '}
            {causas.length === 1 ? 'mirada' : 'miradas'}
          </p>
        </div>
        <h2
          className={`mt-3 font-semibold leading-[1.05] tracking-tight ${
            hayConfirmada ? 'text-estado-ir' : 'text-foreground'
          }`}
          style={{ fontSize: 'clamp(2.2rem, 4vw, 3rem)' }}
        >
          {resumen(causas)}
        </h2>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          En orden de probabilidad. No se elige una causa: se enseñan todas las que encajan.
        </p>

        {/*
          🔴 LA PRIMERA CONFIRMADA, NO LA PRIMERA DE LA LISTA. `diagnosticar()`
             devuelve TODAS las causas que sabe mirar, cada una con su estado
             -confirmada, posible, descartada, no se sabe-, no solo las que
             encajan. Coger `causas[0]` habria enseñado la primera EXAMINADA como
             si fuera la culpable: una afirmación falsa en la pantalla cuyo
             trabajo entero es no afirmar de más.

          Y si no hay ninguna confirmada no se pinta nada aquí: el veredicto ya
          dice «ninguna de las causas conocidas encaja», y añadir una «más
          probable» sería justo la elección que esta pantalla se niega a hacer.

          ⚠️ La columna de «Qué hacer» solo existe si HAY remedio: `Causa.remedio`
             viene vacío cuando no hay nada que hacer, y una columna vacía al
             lado de la que encaja se leería como que no se sabe qué hacer.
        */}
        {hayConfirmada && (
          <div
            className={`mt-7 grid gap-x-10 gap-y-5 border-t border-[rgb(var(--filo)/0.09)] pt-6 ${
              confirmadas[0].remedio !== '' ? 'sm:grid-cols-2' : ''
            }`}
          >
            {/* Sin la EVIDENCIA: esa se queda en la lista de causas, que es lo
                que la lista aporta sobre esta banda. Aquí van las dos cosas que
                se leen de lejos —cuál encaja y qué hacer— y nada más. */}
            <div className="min-w-0">
              <p className="microetiqueta">La causa que encaja</p>
              <p className="mt-2.5 text-[21px] font-semibold leading-snug tracking-tight text-estado-ir">
                {confirmadas[0].titulo}
              </p>
            </div>
            {confirmadas[0].remedio !== '' && (
              <div className="min-w-0">
                <p className="microetiqueta">Qué hacer</p>
                <p className="mt-2.5 max-w-prose text-[15px] font-medium leading-relaxed text-foreground/90">
                  {confirmadas[0].remedio}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/*
        ═════════════════════════════════════════════════════════════════════
        2 · LAS TRES SEÑALES DE VIDA. Lo que mira `diagnosticar()`.
        ═════════════════════════════════════════════════════════════════════
        Van en un `Grupo` porque los tres números **no vienen del mismo sitio ni
        al mismo ritmo**, y confundirlos es lo que hace que alguien lea como
        «de ahora» un dato de hace medio minuto.
      */}
      {/*
        🔴 LA `fuente` MEDÍA 103 CARACTERES Y SE PINTA EN `.microetiqueta`
           —monoespaciada, versalitas, espaciada—: una cinta gris de ~860 px que
           pesaba más que el título de dos palabras al que acompaña. Los otros
           ocho `fuente` de la aplicación no pasan de 61.

        `.microetiqueta` es para rótulos CORTOS, y esa regla ya estaba escrita.
        El matiz no se pierde: baja a la `nota` de cada señal, que es donde vive
        lo que el número no dice por sí mismo — y allí además es específico de
        SU señal en vez de una frase con punto y coma para las tres.
      */}
      <Grupo titulo="Señales de vida" fuente="dos las mide el navegador; /odom lo dice el robot">
        <div className="grid gap-4 sm:grid-cols-3">
          <Senal
            etiqueta="Enlace"
            valor={conectado ? 'abierto' : 'cerrado'}
            alarma={!conectado}
            nota={conectado
              ? 'WebSocket abierto con el robot, medido por este navegador.'
              : 'Socket cerrado, medido por este navegador. Sin él no se sabe nada de las otras dos.'}
          />
          <Senal
            etiqueta="/odom"
            valor={odomConocida ? segundos(antiguedadOdomS) : null}
            alarma={odomConocida && (antiguedadOdomS ?? 0) > UMBRAL_ODOM_MUERTA_S}
            nota={odomConocida
              ? 'Esta antigüedad la manda el robot en su estado, no la mide el navegador. Con el driver sano llega a 16,5 Hz.'
              : 'No ha llegado el estado del robot, y esa antigüedad la manda él: aquí no hay nada que leer.'}
          />
          <Senal
            etiqueta="/scan"
            valor={msDesdeBarrido === null ? null : milisegundos(msDesdeBarrido)}
            alarma={msDesdeBarrido !== null && msDesdeBarrido >= UMBRAL_BARRIDO_MS}
            nota={msDesdeBarrido === null
              ? 'No ha llegado ningún barrido a este navegador. Sin él la capa de seguridad bloquea el movimiento.'
              : 'Antigüedad del último barrido del LIDAR, medida por este navegador.'}
          />
        </div>
      </Grupo>

      {/*
        ═════════════════════════════════════════════════════════════════════
        3 · LAS CAUSAS, y debajo EL LÍMITE plegado.
        ═════════════════════════════════════════════════════════════════════
        A ancho completo, y no a dos columnas con el descargo al lado: medido en
        captura, el descargo pesaba el doble que el veredicto. Aquí la lista es
        el trabajo de la pantalla y el descargo es su nota al pie — que es el
        orden que tenían invertido.
      */}
      <Tarjeta
        titulo="Causas"
        subtitulo="Cada una con lo que se ha mirado para decirlo, y con lo que hay que hacer."
      >
        <ul className="divide-y divide-[rgb(var(--filo)/0.09)]">
          {causas.map((c) => (
            <FilaCausa key={c.id} causa={c} remedioArriba={c.id === confirmadas[0]?.id} />
          ))}
        </ul>
      </Tarjeta>

      {/*
        🔴 EL LÍMITE DE ESTA PANTALLA, EN LA PANTALLA.
        Que ninguna causa encaje no prueba que el robot obedezca. Callarlo
        convertiría esta pantalla en la falsa tranquilidad que existe para
        evitar — por eso esa frase va en el `summary`, siempre visible, y solo
        los tres ejemplos se pliegan.

        Los topos son de CSS —`list-disc`—, no un `·` tecleado dentro del texto,
        que se lleva el sangrado por delante y no lo ve ningún lector de
        pantalla.
      */}
      <Descargo>
        <ul className="mt-3 list-disc space-y-2.5 pl-9 text-[13px] leading-relaxed text-muted-foreground marker:text-muted-foreground/50">
          <li className="max-w-prose">
            Que el <strong className="text-foreground/85">descriptor del LIDAR</strong> esté
            muerto tras apagar y encender el RVR con la Pi viva. El nodo sigue vivo y sus
            servicios contestan; se ve por SSH con{' '}
            <code className="font-mono">ls -l /proc/…/fd | grep tty</code>, y dice{' '}
            <code className="font-mono">(deleted)</code>.
          </li>
          <li className="max-w-prose">
            Que el robot esté <strong className="text-foreground/85">contra una pared</strong>:
            el polígono de precaución frena al 40 % aunque se esté alejando, y un retroceso de
            30 cm puede hacer 14.
          </li>
          <li className="max-w-prose">
            Que otra pestaña esté publicando en <code className="font-mono">cmd_vel_raw</code> a
            la vez. No hay autenticación, así que <strong className="text-foreground/85">nadie
            puede saberlo</strong>: dos bucles a 10 Hz producen un movimiento que no es el de
            ninguno de los dos.
          </li>
        </ul>
      </Descargo>
    </div>
  )
}
