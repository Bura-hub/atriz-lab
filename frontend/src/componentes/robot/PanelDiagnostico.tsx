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
import { Grupo } from '@/componentes/ui/Grupo'
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
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 Y ARREGLARLO SE PASO DE FRENADA: LAS DOS COLUMNAS ACABARON CON LA MISMA
 *      CLASE
 * ═══════════════════════════════════════════════════════════════════════════
 * La correccion anterior subio las DOS columnas de ritmo a `.cifra-menor` y
 * quito el `text-muted-foreground` de la de la derecha. Resultado, medido en una
 * captura con el robot apagado: **lo mas grande de la pantalla eran los
 * `16,53 · 16,57 · 1,00 · 0,03 Hz` de «MEDIDO EN EL ROBOT»**, que son una
 * CONSTANTE del laboratorio escrita en `llegadas.ts` —no una medida de este
 * robot ahora—, mientras «OBSERVADO AQUI», que es la unica medida de verdad de
 * la tabla, salia en gris y en cursiva.
 *
 * Y lo peor no se ve con el robot apagado: **con las dos columnas en la misma
 * clase, en cuanto lleguen datos seran tipograficamente indistinguibles**. Un
 * dia alguien leera la constante creyendo que es la lectura — que es exactamente
 * el fallo contra el que existe la columna de comparacion.
 *
 * → La regla ya estaba escrita en `Dato.tsx` y no se aplico aqui: **el patron de
 *   comparacion va un escalon POR DEBAJO de la medida y en tinta secundaria**.
 *   Nunca la misma clase para el patron y para la medida.
 *
 *     observado aqui   ->  `.cifra` (28-36 px) en tinta plena     <- LA MEDIDA
 *     medido en el robot -> `.cifra-menor` (22 px) en secundaria  <- EL PATRON
 *
 * ⚠️ La AUSENCIA no crece con el dato: sigue en `.hueco`, pequeña y apagada. Es
 *    la regla de `Dato`, y aqui importa mas que en ningun sitio — con el robot
 *    apagado ocho de las diez celdas de ritmo son huecos, y pintarlos a 36 px
 *    llenaria la tabla de rayas enormes.
 */
function Hercios({ valor, patron }: {
  valor: number | null | undefined
  /** `true` = es la constante del laboratorio, no una medida de este robot. */
  patron?: boolean
}) {
  if (valor === null || valor === undefined) {
    return <span className="hueco text-sm italic">{SIN_DATO}</span>
  }
  return (
    <span className={patron === true ? 'cifra-menor text-muted-foreground' : 'cifra'}>
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
      {/* LA MEDIDA. Es lo único de esta tabla que depende del robot de ahora. */}
      <td className="py-4 pr-4 text-right">
        <Hercios valor={observado} />
      </td>
      {/*
        🔴 EL PATRON DE COMPARACION, UN ESCALON POR DEBAJO Y EN TINTA SECUNDARIA.
           Una version anterior lo dejo a la misma escala que la medida y a plena
           tinta «para que no fuera lo mas apagado del cuadro»; el efecto medido
           en captura fue el contrario — la constante del laboratorio se convirtio
           en lo mas grande de la pantalla. Ver la cabecera de `Hercios`.
      */}
      <td className="py-4 text-right">
        <Hercios valor={medido} patron />
      </td>
    </tr>
  )
}

export function PanelDiagnostico() {
  const { ultimoAviso, robot } = useRobot()
  useLatido()

  const caudal = caudalDeFlota(TOPICS, 1)

  return (
    /*
      🔴 BANDEADA, Y CON EL MISMO RITMO QUE LAS OTRAS DOS PANTALLAS DE
         INSTRUMENTO. Esto era una pila plana de cuatro tarjetas iguales con
         `space-y-4` —lo que `Grupo` se escribio para acabar— mientras telemetria
         iba bandeada y a `space-y-8`. Dos ritmos verticales distintos en pestañas
         hermanas se leen como dos aplicaciones.

         Las tres bandas responden a tres preguntas distintas: si hay cable, qué
         viaja por él, y qué no se puede saber ni con cable ni sin él.
    */
    <div className="space-y-8">
      <Grupo
        titulo="El enlace"
        fuente={`robot ${String(robot)} · un WebSocket por robot, sin namespace`}
      >
        <div className="grid gap-4">
          <Tarjeta titulo="Estado del socket">
            <PanelEnlace />
          </Tarjeta>

          {ultimoAviso !== null && (
            <Aviso nivel="ERROR" titulo="Aviso del cliente">
              {ultimoAviso.mensaje}
            </Aviso>
          )}
        </div>
      </Grupo>

      <Grupo
        titulo="Lo que llega"
        fuente={`${TOPICS.length} topics · ${numero(caudal, 2)} kB/s para este robot`}
      >
        <Tarjeta
          titulo="Llegadas por topic"
          subtitulo="El muro de 16 robots no puede pagar estos cuatro topics, y por eso usa otros dos."
          /*
            🔴 LOS DOS PARRAFOS DE CIERRE, AL PIE Y A DOS COLUMNAS.

            Colgaban del cuerpo con `max-w-prose` justo debajo de una tabla de
            ancho completo: la prosa medía ~490 px y la tabla ~1040, así que a su
            derecha quedaba una columna muerta de ~585 px — el hueco más grande de
            esta pantalla. En el pie y repartidos en dos columnas ocupan el ancho
            que la tarjeta ya tiene, y cada uno sigue leyéndose en una medida de
            línea sana.

            ⚠️ Cada párrafo va envuelto en su `div`: `Tarjeta.pie` aplica `mt-2` a
               un `p` que siga a otro `p`, y en una rejilla eso desalinearía la
               segunda columna medio renglón.
          */
          pie={
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              <div>
                <p>
                  «Observado aquí» son los mensajes que han llegado a esta pestaña, con la marca de
                  tiempo que les pone el navegador. Entre el robot y esta tabla hay rosbridge, el
                  WiFi del aula y el bucle de eventos de JavaScript: si sale por debajo del valor
                  medido, <strong>lo que dice es que algo del camino pierde mensajes</strong>, no que
                  el robot publique despacio.
                </p>
              </div>
              <div>
                <p>
                  Con menos de dos mensajes no hay ningún intervalo que medir y pone «{SIN_DATO}» —
                  nunca 0 Hz. Y el veredicto de estado no sale de esta tabla: se decide por la
                  antigüedad de la última llegada, no por una frecuencia.
                </p>
              </div>
            </div>
          }
        >
          {/* `px-5`: la tabla es hija directa de la tarjeta, que va a sangre, asi
              que sin esto la ultima columna -alineada a la derecha- tocaba el
              canto de la ficha. Y `pt-3`, para que la cabecera no se pegue a la
              linea que la separa del titulo. */}
          <div className="overflow-x-auto px-5 pb-1 pt-3">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Topic</th>
                  <th className="pb-2 pr-4 font-medium text-right">Mensajes</th>
                  <th className="pb-2 pr-4 font-medium text-right">Último hace</th>
                  {/* La cabecera acompaña a la escala de su columna: la medida en
                      tinta plena, el patrón de comparación en secundaria. */}
                  <th className="pb-2 pr-4 font-medium text-right text-foreground">Observado aquí</th>
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
        </Tarjeta>
      </Grupo>

      <Grupo
        titulo="Lo que no se puede decir"
        fuente="ni con enlace ni sin él"
      >
        <div className="grid gap-4">
          <Tarjeta
            titulo="Los cinco huecos"
            subtitulo="Un hueco declarado es honesto; un hueco callado se lee como «todo bien»."
          >
            {/*
              🔴 EL ROTULO Y SU EXPLICACION SE LEIAN COMO LA MISMA COSA. El `dt`
                 iba en `text-sm font-medium` minuscula y el `dd` en `text-xs`:
                 dos tamaños de la misma fuente separados por 2 px, asi que la
                 lista era una mancha de prosa de ~350 px sin una sola cifra ni un
                 solo escalon. En `.microetiqueta` —monoespaciada, versalitas,
                 espaciada— el hueco declarado se distingue de su motivo sin leer
                 ninguno de los dos, que es exactamente para lo que existe esa
                 clase.

              📝 Y NUMERADOS: son cinco cosas concretas que esta interfaz no puede
                 decir, no un parrafo. El numero las hace contables — «cinco», y
                 se ve— y da a cada una un nombre para citarla.

              🔴 LA ENTRADA DE ANCHO COMPLETO VA LA PRIMERA, NO LA ULTIMA.
                 Con cinco celdas en una malla de dos, una tiene que ocupar la
                 fila entera. Estaba al final y ahi se leia como lo que sobra:
                 dos filas de pares y una banda suelta colgando. Puesta la
                 primera es una ENTRADILLA —lo que abre la lista— y las cuatro
                 restantes cierran en un 2x2 limpio.

              ⚠️ La rejilla va A SANGRE, que es lo que `Tarjeta` espera de ella;
                 el relleno lo pone cada celda.

              ⚠️ NO lleva `auto-rows-fr`, y es deliberado: igualaria la fila de la
                 entradilla —dos renglones— con las de contenido, que tienen
                 cuatro. Añadiria papel en blanco en vez de quitarlo. Las celdas
                 de una MISMA fila ya salen igual de altas: eso lo hace la
                 rejilla sola.
            */}
            <dl className="rejilla sm:grid-cols-2">
              {LO_QUE_NO_SE_PUEDE_DECIR.map((h, i) => (
                <div key={h.que} className={`px-5 py-4${i === 0 ? ' sm:col-span-2' : ''}`}>
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

          <Tarjeta
            titulo="Cómo se comprueba desde fuera"
            subtitulo="Si algo de arriba no cuadra, el robot se mira así."
          >
            {/*
              🔴 A TRES COLUMNAS, Y NO POR DENSIDAD. Con `max-w-prose` esta lista
                 medía ~490 px debajo de una tarjeta de 1040: dejaba una columna
                 muerta de ~550 px a su derecha, el mismo defecto que los párrafos
                 de la tabla de arriba. Son tres comprobaciones independientes, así
                 que una por columna es además lo que son.
            */}
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-3 md:grid md:grid-cols-3 md:gap-x-8 md:space-y-0">
              <li>
                Que el proceso exista no prueba nada: <code>ros2 topic list</code> conserva topics
                de nodos muertos, y el driver puede tener sus topics registrados y estar mudo.
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
      </Grupo>
    </div>
  )
}
