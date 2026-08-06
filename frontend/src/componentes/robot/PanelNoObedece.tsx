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
 *   3. LAS CAUSAS y EL LÍMITE, a dos columnas. El límite al lado y no debajo:
 *      es la mitad del diseño, no un apéndice.
 */

import { useEffect, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import {
  Causa, EstadoCausa, UMBRAL_BARRIDO_MS, UMBRAL_ODOM_MUERTA_S, diagnosticar, resumen,
} from '@/lib/robot/no_obedece'
import { SIN_DATO, milisegundos, partirUnidad, segundos } from '@/lib/interfaz/formato'
import { Grupo } from '@/componentes/ui/Grupo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

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

function FilaCausa({ causa }: { causa: Causa }) {
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
        {causa.remedio !== '' && (
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-foreground/85">
            {causa.remedio}
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
        🔴 DOS COLUMNAS, Y LA DERECHA NO ES RELLENO. La banda ocupaba el ancho
           entero con su contenido en el 45 % izquierdo -~600×150 px de blanco a
           la derecha- y, peor, decía «una causa encaja» **sin decir cuál**: la
           causa vivía 400 px más abajo, fuera del golpe de vista de alguien que
           mira esto proyectado. El hueco se cierra con la única información que
           faltaba, no con adorno.
      */}
      <section className="vidrio flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4 rounded-ficha px-6 py-7 sm:px-8">
        <div className="min-w-0">
          <p className="microetiqueta">Veredicto</p>
          <h2
            className={`mt-3 font-semibold leading-[1.12] tracking-tight ${
              hayConfirmada ? 'text-estado-ir' : 'text-foreground'
            }`}
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)' }}
          >
            {resumen(causas)}
          </h2>
          <p className="mt-3.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
            En orden de probabilidad. No se elige una causa: se enseñan todas las que encajan.
          </p>
        </div>

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
        */}
        {confirmadas.length > 0 && (
          <div className="min-w-[13rem] shrink-0 sm:text-right">
            <p className="microetiqueta">La primera que encaja</p>
            <p className="mt-2 text-[19px] font-semibold leading-snug text-estado-ir">
              {confirmadas[0].titulo}
            </p>
            <p className="microetiqueta mt-2">
              {confirmadas.length} de {causas.length} miradas
            </p>
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
      <Grupo
        titulo="Señales de vida"
        fuente="el enlace y el barrido los mide este navegador; la antigüedad de /odom la manda el robot en su estado"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Senal
            etiqueta="Enlace"
            valor={conectado ? 'abierto' : 'cerrado'}
            alarma={!conectado}
            nota={conectado
              ? 'WebSocket abierto con el robot.'
              : 'Socket cerrado. Sin él no se sabe nada de las otras dos.'}
          />
          <Senal
            etiqueta="/odom"
            valor={odomConocida ? segundos(antiguedadOdomS) : null}
            alarma={odomConocida && (antiguedadOdomS ?? 0) > UMBRAL_ODOM_MUERTA_S}
            nota={odomConocida
              ? 'Antigüedad de la última muestra. Con el driver sano llega a 16,5 Hz.'
              : 'No ha llegado el estado del robot, así que no hay antigüedad que leer.'}
          />
          <Senal
            etiqueta="/scan"
            valor={msDesdeBarrido === null ? null : milisegundos(msDesdeBarrido)}
            alarma={msDesdeBarrido !== null && msDesdeBarrido >= UMBRAL_BARRIDO_MS}
            nota={msDesdeBarrido === null
              ? 'No ha llegado ningún barrido. Sin él la capa de seguridad bloquea el movimiento.'
              : 'Antigüedad del último barrido del LIDAR, medida aquí.'}
          />
        </div>
      </Grupo>

      {/*
        ═════════════════════════════════════════════════════════════════════
        3 · LAS CAUSAS Y EL LÍMITE, a dos columnas.
        ═════════════════════════════════════════════════════════════════════
        `items-start` para que la columna corta no se estire hasta la altura de
        la larga: con el robot apagado hay UNA causa y tres límites, y una
        tarjeta con medio metro de blanco dentro se lee como un fallo.
      */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Tarjeta
          titulo="Causas"
          subtitulo="Cada una con lo que se ha mirado para decirlo, y con lo que hay que hacer."
        >
          <ul className="divide-y divide-[rgb(var(--filo)/0.09)]">
            {causas.map((c) => <FilaCausa key={c.id} causa={c} />)}
          </ul>
        </Tarjeta>

        {/*
          🔴 EL LÍMITE DE ESTA PANTALLA, EN LA PANTALLA.
          Que ninguna causa encaje no prueba que el robot obedezca. Callarlo
          convertiría esta pantalla en la falsa tranquilidad que existe para
          evitar.
        */}
        <Tarjeta
          titulo="Lo que esta pantalla no puede ver"
          subtitulo="Que ninguna causa encaje no prueba que el robot obedezca: prueba que no es ninguna de las que aquí se saben mirar."
        >
          {/*
            En un `div` con su propio `px-5`: el cuerpo de `Tarjeta` va a sangre
            para que las rejillas lleguen al canto, y una lista suelta que herede
            eso se pega al borde izquierdo. Y los topos son de CSS —`list-disc`—,
            no un `·` tecleado dentro del texto, que se lleva el sangrado por
            delante y no lo ve ningún lector de pantalla.
          */}
          <div className="px-5 py-4">
            <ul className="list-disc space-y-3 pl-5 text-[13px] leading-relaxed text-muted-foreground marker:text-muted-foreground/50">
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
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}
