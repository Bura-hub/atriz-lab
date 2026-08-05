'use client'

/**
 * EL MURO DEL PROFESOR: los 16 robots a la vez, para mirarlos de lejos.
 *
 * 🔴🔴 LO QUE ESTE MURO NO PUEDE HACER HOY, Y VA ESCRITO EN LA PANTALLA:
 * **no puede saber si un robot esta vivo.** Para eso haria falta el ritmo de
 * `/odom`, que cuesta 1,7 Mbit/s por los 16. `/motor_status` llega a 1 Hz
 * **republicado desde el estado cacheado del driver**, asi que sigue llegando con
 * el RVR apagado: distingue «la Raspberry Pi esta viva» de «no hay nadie», y nada
 * mas.
 *
 * → Por eso la baldosa dice «sin señal de vida» y NUNCA «averiado». Se cierra con
 *   una linea en el driver -un `/latido` a 1 Hz con un contador monotono, ~0,5
 *   kB/s los 16- que hoy no existe en la rama `ros2`.
 *
 * ⚠️ Y cuando exista: **la interfaz tendra que comparar DOS lecturas separadas en
 * el tiempo**, porque el latido va `TRANSIENT_LOCAL` y un suscriptor nuevo puede
 * recibir el ultimo valor latcheado. Una sola lectura no probaria nada. Lo que da
 * la garantia es la republicacion a 1 Hz, no el QoS.
 */

import { TOPICS_MURO, caudalDeFlota } from '@/lib/flota/presupuesto'
import { ROBOTS, TOTAL_ROBOTS } from '@/lib/interfaz/identidad'
import { destinoDe } from '@/lib/interfaz/direcciones'
import { numero } from '@/lib/interfaz/formato'
import { BaldosaConectada } from './BaldosaConectada'
import { DondeBuscar, useDirecciones } from './DondeBuscar'

export function MuroFlota() {
  const porRobot = caudalDeFlota(TOPICS_MURO, 1)
  const total = caudalDeFlota(TOPICS_MURO, TOTAL_ROBOTS)
  const { direcciones, poner } = useDirecciones()

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/*
        LA LUZ AMBIENTE. Dos orbes desenfocados y FIJOS que tiñen la pantalla
        entera: es lo que impide que el pozo oscuro se lea como «apagado» en vez
        de como «profundo». Fijos por rendimiento — ver `.luz-ambiente`.
      */}
      <div className="luz-ambiente" aria-hidden="true" />
      {/*
        LA BARRA DE MÁQUINA. El grafito ocupa una región entera —no
        es un acento— y es lo que hace que esta pantalla se reconozca a tres
        metros aunque no se lea una palabra. La cifra de caudal va en la barra
        porque es la restricción que gobierna el diseño de este muro.
      */}
      <header className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-5 px-4 pb-7 pt-12 sm:px-6">
        <div>
          <h1
            className="bg-gradient-to-b from-white to-[#A8B0C8] bg-clip-text font-semibold leading-[0.96] tracking-[-0.048em] text-transparent"
            style={{ fontSize: 'clamp(2.5rem, 6.4vw, 4.875rem)' }}
          >
            Flota Atriz
          </h1>
          <p className="mt-3.5 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
            {TOTAL_ROBOTS} Sphero RVR en el aula. Los que están en color piden algo; los de
            vidrio, no. Cada ficha abre su propio WebSocket y escucha solo{' '}
            <code className="font-mono text-foreground/80">{TOPICS_MURO.join(' + ')}</code>.
          </p>
        </div>

        {/*
          El presupuesto de red, en pastillas de vidrio. No es adorno: es el
          número que decide a qué topics puede suscribirse este muro.
        */}
        <dl className="flex flex-wrap gap-2.5">
          <div className="vidrio rounded-md px-[18px] py-[13px]">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              por robot
            </dt>
            <dd className="mt-0.5 font-mono text-[21px] font-semibold">
              {numero(porRobot, 2)}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">kB/s</span>
            </dd>
          </div>
          <div className="vidrio rounded-md px-[18px] py-[13px]">
            <dt className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              los {TOTAL_ROBOTS}
            </dt>
            <dd className="mt-0.5 font-mono text-[21px] font-semibold">
              {numero(total, 2)}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">kB/s</span>
            </dd>
          </div>
        </dl>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        {/*
          🔴 El cuadro de direcciones va ANTES de la losa y CERRADO. Es
             configuracion, no estado: no cambia con lo que hace el robot, asi
             que se pliega. Los motivos de una baldosa NO se pliegan nunca —esa
             es la regla— pero esto no es un motivo, es un ajuste de red de
             ESTE navegador.
        */}
        <div className="mb-4">
          <DondeBuscar direcciones={direcciones} poner={poner} />
        </div>

        {/*
          ── EL ÚNICO MOMENTO DE MOVIMIENTO ORQUESTADO DE LA APLICACIÓN ───────
          Las dieciséis fichas suben 20 px y aparecen al entrar, con 60 ms entre
          una y la siguiente. `craft-floor`: «one authored moment, not scattered
          effects».

          🔴 Y ES CSS, NO JAVASCRIPT, POR UNA RAZÓN QUE IMPORTA. Una entrada
             escalonada hecha con estado de React se repetiría en cada
             re-render, y aquí hay dieciséis WebSockets reconectándose por su
             cuenta: el muro se pondría a barajar sus fichas cada vez que un
             robot volviera. Una animación CSS corre **al montar y nunca más**,
             que es exactamente la garantía que hace falta.

          📌 `4x4` es la forma que pide el encargo: el profesor mira los
             dieciséis a la vez, a veces proyectados. Las columnas de móvil se
             conservan porque un teléfono no puede con cuatro.
        */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ROBOTS.map((id, i) => (
            <div
              key={id}
              // `h-full` en el envoltorio Y en la ficha: si no, el envoltorio de
              // la animacion no estira y las fichas de una misma fila quedan de
              // alturas distintas, con hueco muerto debajo de las cortas.
              className="animate-entrar h-full"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <BaldosaConectada id={id} destino={destinoDe(id, direcciones)} />
            </div>
          ))}
        </div>

        {/* La leyenda del idioma: qué significa vidrio y qué significa color. */}
        <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-2 text-[12.5px] text-muted-foreground">
          <li>
            <strong className="font-semibold text-foreground">Bloque de color</strong> — este
            robot pide algo
          </li>
          <li>
            <strong className="font-semibold text-foreground">Vidrio</strong> — sin novedad, o no
            se llega a él
          </li>
        </ul>

        <section className="vidrio mt-8 rounded-ficha p-7">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Cómo leer este muro
          </h2>
          <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong>Rojo solo por un hecho</strong>: atasco confirmado por el firmware del RVR, o
              batería por debajo de 6,5 V, y además con señal reciente. Nunca por un hueco.
            </li>
            <li>
              <strong>«Sin señal de vida» no es una avería.</strong> Un robot cargando —RVR apagado
              con la Raspberry Pi encendida— es el estado más común del laboratorio y se ve igual que
              uno dormido.
            </li>
            <li>
              <strong>La batería se lee en voltios.</strong> El porcentaje del firmware marcó 100 %
              con la batería a 8,29 V, a 1,29 V del umbral de «baja».
            </li>
            <li>
              Una baldosa se pone en «sin señal de vida» tras 5 s sin <code>/motor_status</code>.
              Ese umbral es del muro y no se puede intercambiar con el de la ficha de un robot: son
              dos topics de ritmos distintos.
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}
