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

/**
 * Un ritmo en hercios, con la escala de las cifras y no con la del texto.
 *
 * 🔴 LAS UNICAS CIFRAS REALES DE ESTA PANTALLA ERAN LO MAS PEQUEÑO QUE HABIA.
 *    Las cinco columnas iban a `text-sm` monoespaciada, asi que la tabla se leia
 *    como una hoja de calculo: 16,53 / 16,57 / 1,00 / 0,03 Hz —los cuatro
 *    numeros medidos contra el robot, y con el robot apagado los UNICOS numeros
 *    de la pantalla— pesaban lo mismo que el nombre del topic y menos que el
 *    parrafo de debajo.
 *
 * ⚠️ La AUSENCIA no crece con el dato: sigue en `.hueco`, pequeña y apagada. Es
 *    la regla de `Dato`, y aqui importa mas que en ningun sitio — con el robot
 *    apagado ocho de las diez celdas de ritmo son huecos, y pintarlos a 22 px
 *    llenaria la tabla de rayas enormes.
 */
function Hercios({ valor }: { valor: number | null | undefined }) {
  if (valor === null || valor === undefined) {
    return <span className="hueco text-sm italic">{SIN_DATO}</span>
  }
  return (
    <span className="cifra-menor">
      {numero(valor, 2)}
      <span className="unidad">Hz</span>
    </span>
  )
}

function FilaTopic({ topic }: { topic: TopicModelado }) {
  const { transporte } = useRobot()
  const { llegadas } = useMuestreo(transporte, topic)
  const observado = ritmoObservado(llegadas)
  const medido = ritmoMedidoDe(topic)
  const desde = transporte.msDesdeUltimo(topic)

  return (
    <tr className="border-t border-border">
      {/* `text-base`: el nombre del topic es la clave de la fila y no puede ser
          del tamaño de la contabilidad que lleva al lado. */}
      <td className="py-4 pr-4 font-mono text-base">{topic}</td>
      {/* Estas dos columnas son contabilidad del enlace, no medidas del robot:
          se quedan en el cuerpo pequeño a proposito, y eso es lo que hace que
          los dos ritmos de la derecha destaquen. */}
      <td className="py-4 pr-4 text-right font-mono tabular-nums text-sm">{llegadas.n}</td>
      <td className="py-4 pr-4 text-right font-mono tabular-nums text-sm">
        {desde === null ? <span className="hueco italic">{SIN_DATO}</span> : milisegundos(desde)}
      </td>
      <td className="py-4 pr-4 text-right">
        <Hercios valor={observado} />
      </td>
      {/*
        🔴 SIN `text-muted-foreground`, Y ES UNA DECISION, NO UN DESCUIDO.
           Esta columna era la mas pequeña, la mas a la derecha y la unica
           atenuada — o sea lo mas apagado del cuadro— cuando es el PATRON DE
           COMPARACION: el valor medido contra el robot, que no depende del
           enlace y que con el robot apagado es lo unico que se puede leer.
      */}
      <td className="py-4 text-right">
        <Hercios valor={medido} />
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
        {/*
          🔴 EL ROTULO Y SU EXPLICACION SE LEIAN COMO LA MISMA COSA. El `dt` iba
             en `text-sm font-medium` minuscula y el `dd` en `text-xs`: dos
             tamaños de la misma fuente separados por 2 px, asi que la lista era
             una mancha de prosa de ~350 px sin una sola cifra ni un solo
             escalon. En `.microetiqueta` —monoespaciada, versalitas, espaciada—
             el hueco declarado se distingue de su motivo sin leer ninguno de los
             dos, que es exactamente para lo que existe esa clase.

          📝 Y NUMERADOS: son cinco cosas concretas que esta interfaz no puede
             decir, no un parrafo. El numero las hace contables — «cinco», y se
             ve— y da a cada una un nombre para citarla.

          ⚠️ `.rejilla` y no una pila: en dos columnas ocupan la mitad del alto.
             La quinta entrada abarca las dos, porque con cinco celdas en una
             malla de dos la ultima fila dejaria medio hueco con el fondo de la
             rejilla asomando — una banda de color solido sin nada dentro.
             Ademas la rejilla va A SANGRE, que es lo que `Tarjeta` espera de
             ella; el relleno lo pone cada celda.
        */}
        <dl className="rejilla sm:grid-cols-2">
          {LO_QUE_NO_SE_PUEDE_DECIR.map((h, i) => (
            <div
              key={h.que}
              className={`px-5 py-4${
                i === LO_QUE_NO_SE_PUEDE_DECIR.length - 1 ? ' sm:col-span-2' : ''
              }`}
            >
              <dt className="microetiqueta">
                {String(i + 1).padStart(2, '0')} · {h.que}
              </dt>
              <dd className="mt-2 max-w-prose text-sm leading-snug text-muted-foreground">
                {h.porque}
              </dd>
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
