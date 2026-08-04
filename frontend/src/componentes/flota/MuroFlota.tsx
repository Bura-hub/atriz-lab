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
import { numero } from '@/lib/interfaz/formato'
import { BaldosaConectada } from './BaldosaConectada'

export function MuroFlota() {
  const porRobot = caudalDeFlota(TOPICS_MURO, 1)
  const total = caudalDeFlota(TOPICS_MURO, TOTAL_ROBOTS)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
          <h1 className="text-lg font-semibold">Flota · {TOTAL_ROBOTS} robots</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">
            Cada baldosa abre su propio WebSocket y está suscrita a{' '}
            <code>{TOPICS_MURO.join(' + ')}</code>: {numero(porRobot, 2)} kB/s por robot,{' '}
            {numero(total, 2)} kB/s los {TOTAL_ROBOTS}. Con <code>/odom</code> dentro serían
            1,7 Mbit/s, y con <code>/scan</code>, 10,3 — el WiFi entero del aula.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {ROBOTS.map((id) => (
            <BaldosaConectada key={id} id={id} />
          ))}
        </div>

        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cómo leer este muro
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1.5 max-w-prose">
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
