'use client'

/**
 * EL PANEL HONDO. Es la primera pantalla que se construyo, a proposito: hace
 * visible lo que la capa de datos ya sabe -antiguedades, llegadas, estado del
 * enlace, avisos- **antes** de que haya nada bonito encima. En este proyecto la
 * pantalla que mide vale mas que la que decora.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 EL RITMO QUE SE VE AQUI ES «OBSERVADO EN EL NAVEGADOR», Y NO ES EL DEL
 *      ROBOT
 * ═══════════════════════════════════════════════════════════════════════════
 * Entre el publicador del robot y este contador hay seis piezas que pueden
 * perder o agrupar mensajes: el ejecutor de ROS, rosbridge, el WiFi del aula, la
 * pila TCP, el bucle de eventos del navegador y el propio muestreo de 500 ms.
 *
 * En este proyecto el instrumento ya ha mentido cinco veces, y una es
 * exactamente esta: un medidor daba **11,3 Hz sobre un robot que iba a 16,5**, y
 * la comprobacion PASABA porque el umbral era «> 10 Hz» -habria mandado a
 * arreglar un driver sano. Por eso cada ritmo va **al lado del valor medido en
 * el robot**, y la conclusion honesta de una diferencia es «algo entre el robot
 * y esta pestaña esta perdiendo mensajes», no «el robot publica despacio».
 *
 * → Y por eso el veredicto de salud NO sale de aqui: `evaluarSalud()` decide por
 *   ANTIGUEDAD de la ultima llegada, nunca por Hz.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { TopicModelado } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { caudalDeFlota } from '@/lib/flota/presupuesto'
import { SIN_DATO, milisegundos, numero } from '@/lib/interfaz/formato'
import { LO_QUE_NO_SE_PUEDE_DECIR } from '@/lib/interfaz/lenguaje'
import { ritmoMedidoDe, ritmoObservado } from '@/lib/interfaz/llegadas'
import { Aviso } from '@/componentes/ui/Aviso'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { PanelEnlace } from './EstadoEnlace'
import { useMuestreo } from './useMuestreo'

/**
 * Los cuatro topics que esta pantalla paga. `/scan` NO esta: es el 83 % del
 * trafico de un robot y esta pantalla no lo necesita para nada.
 *
 * 📝 `/odom` lo mira ademas `useSalud` con un manejador vacio, y eso **no cuesta
 * ni un byte mas**: el `Transporte` comparte una sola suscripcion por topic entre
 * todos sus oyentes.
 */
const TOPICS: readonly TopicModelado[] = ['/odom', '/encoders', '/motor_status', '/battery_state']

function FilaTopic({ topic }: { topic: TopicModelado }) {
  const { transporte } = useRobot()
  const { llegadas } = useMuestreo(transporte, topic)
  const observado = ritmoObservado(llegadas)
  const medido = ritmoMedidoDe(topic)
  const desde = transporte.msDesdeUltimo(topic)

  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-4 font-mono text-sm">{topic}</td>
      <td className="py-2 pr-4 text-right font-mono tabular-nums text-sm">{llegadas.n}</td>
      <td className="py-2 pr-4 text-right font-mono tabular-nums text-sm">
        {desde === null ? <span className="italic text-muted-foreground">{SIN_DATO}</span> : milisegundos(desde)}
      </td>
      <td className="py-2 pr-4 text-right font-mono tabular-nums text-sm">
        {observado === null
          ? <span className="italic text-muted-foreground">{SIN_DATO}</span>
          : `${numero(observado, 2)} Hz`}
      </td>
      <td className="py-2 text-right font-mono tabular-nums text-sm text-muted-foreground">
        {medido === undefined ? SIN_DATO : `${numero(medido, 2)} Hz`}
      </td>
    </tr>
  )
}

export function PanelDiagnostico() {
  const { ultimoAviso, robot } = useRobot()
  useLatido()

  const caudal = caudalDeFlota(TOPICS, 1)

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Enlace" subtitulo={`Robot ${String(robot)} · un WebSocket por robot, sin namespace.`}>
        <PanelEnlace />
      </Tarjeta>

      {ultimoAviso !== null && (
        <Aviso nivel="ERROR" titulo="Aviso del cliente">
          {ultimoAviso.mensaje}
        </Aviso>
      )}

      <Tarjeta
        titulo="Llegadas por topic"
        subtitulo={`Esta pantalla está suscrita a ${TOPICS.length} topics: ${numero(caudal, 2)} kB/s medidos para este robot. El muro de 16 no puede pagar esto y por eso usa otros dos.`}
      >
        {/* `px-5`: la tabla es hija directa de la tarjeta, que va a sangre, asi
            que sin esto la ultima columna -alineada a la derecha- tocaba el
            canto de la ficha. Y `pt-3`, para que la cabecera no se pegue a la
            linea que la separa del titulo. */}
        <div className="overflow-x-auto px-5 pt-3">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Topic</th>
                <th className="pb-2 pr-4 font-medium text-right">Mensajes</th>
                <th className="pb-2 pr-4 font-medium text-right">Último hace</th>
                <th className="pb-2 pr-4 font-medium text-right">Observado aquí</th>
                <th className="pb-2 font-medium text-right">Medido en el robot</th>
              </tr>
            </thead>
            <tbody>
              {TOPICS.map((t) => (
                <FilaTopic key={t} topic={t} />
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-3 max-w-prose">
          «Observado aquí» son los mensajes que han llegado a esta pestaña, con la marca de tiempo
          que les pone el navegador. Entre el robot y esta tabla hay rosbridge, el WiFi del aula y el
          bucle de eventos de JavaScript: si sale por debajo del valor medido,{' '}
          <strong>lo que dice es que algo del camino pierde mensajes</strong>, no que el robot
          publique despacio. Con menos de dos mensajes no hay ningún intervalo que medir y pone «
          {SIN_DATO}» — nunca 0 Hz.
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-prose">
          El veredicto de estado no sale de esta tabla: se decide por la antigüedad de la última
          llegada, no por una frecuencia.
        </p>
      </Tarjeta>

      <Tarjeta
        titulo="Lo que esta interfaz no puede decir"
        subtitulo="Un hueco declarado es honesto; un hueco callado se lee como «todo bien»."
      >
        {/* Mismo motivo que en `PanelEnlace`: el cuerpo de la tarjeta va a
            sangre, asi que la lista pone su propio relleno. */}
        <dl className="space-y-3 px-5 py-4">
          {LO_QUE_NO_SE_PUEDE_DECIR.map((h) => (
            <div key={h.que}>
              <dt className="text-sm font-medium">{h.que}</dt>
              <dd className="text-xs text-muted-foreground max-w-prose">{h.porque}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Cómo se comprueba desde fuera" subtitulo="Si algo de arriba no cuadra, el robot se mira así.">
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1 max-w-prose">
          <li>
            Que el proceso exista no prueba nada: <code>ros2 topic list</code> conserva topics de
            nodos muertos, y el driver puede tener sus topics registrados y estar mudo.
          </li>
          <li>
            Si llega <code>/scan</code> y no llega <code>/odom</code>, sospecha de una excepción
            dentro de un manejador de telemetría del driver: el detector de silencio no salta,
            porque mide desde la última muestra del RVR, no desde la última publicación.
          </li>
          <li>
            Un robot cargando —RVR apagado con la Raspberry Pi viva— es el estado cotidiano del
            laboratorio y se ve exactamente igual que uno dormido.
          </li>
        </ul>
      </Tarjeta>
    </div>
  )
}
