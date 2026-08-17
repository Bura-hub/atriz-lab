'use client'

/**
 * La bateria del RVR, en VOLTIOS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE NO HAY UN PORCENTAJE GRANDE EN ESTA TARJETA
 * ═══════════════════════════════════════════════════════════════════════════
 * Medido el 2026-08-01: el porcentaje del firmware decia **100 % con la bateria
 * a 8,29 V**, a 1,29 V del umbral de «baja» del propio firmware (7,0 V; critica
 * 6,5 V, histeresis 0,2). Es una estimacion gruesa, y decidir con ella manda a
 * cargar tarde.
 *
 * Y hay una segunda trampa encima: `sensor_msgs/BatteryState.percentage` es una
 * **fraccion 0-1**, no un porcentaje. Leerlo como 0-100 hizo que un robot al
 * 34 % pareciera estar al 0 % y provoco una falsa alarma de bateria agotada. Se
 * enseña, pequeño y explicado, para que nadie lo busque en otro sitio; no decide
 * nada.
 *
 * ⚠️ `/battery_state` llega **cada 30,0 s exactos** -es el latido del keepalive
 * del driver-, asi que su antiguedad va SIEMPRE al lado del voltaje: un valor de
 * hace 28 s no es un valor de ahora.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic, useTopicFechado } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { NivelBateria, V_BAJA, V_CRITICA, nivelBateria } from '@/lib/rosbridge/contrato'
import { EscalaImpresa } from '@/componentes/ui/EscalaImpresa'
import type { Escala } from '@/lib/interfaz/escala'
import { SIN_DATO, milisegundos, numero, partirUnidad, voltios } from '@/lib/interfaz/formato'
import { porcentajeDe, voltajeDe } from '@/lib/interfaz/lecturas'
import { Insignia, TonoInsignia } from '@/componentes/ui/Insignia'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/**
 * LA REGLA DE LA BATERIA.
 *
 * 🔴 El TOPE sale de una medida: el proyecto registro **8,29 V al "100 %"** del
 *    firmware, y 8,4 es el nominal de dos celdas de Li-ion en serie a plena
 *    carga. El SUELO es una eleccion —0,5 V por debajo de critica, lo justo para
 *    que el umbral no quede pegado al canto— y se dice que lo es.
 *
 * ⚠️ Los dos umbrales NO se escriben aqui: salen de `V_BAJA` y `V_CRITICA`,
 *    que es de donde los saca `nivelBateria()`. Copiarlos daria dos fuentes de
 *    verdad para el mismo numero, que es como el proyecto acabo con
 *    `--estado-ir` valiendo exactamente `--destructive`.
 */
const ESCALA_BATERIA: Escala = {
  min: 6.0,
  max: 8.4,
  marcas: [
    { en: V_CRITICA, nombre: 'crítica' },
    { en: V_BAJA, nombre: 'baja' },
  ],
}

const TONO: Readonly<Record<NivelBateria, TonoInsignia>> = {
  OK: 'BIEN',
  BAJA: 'ATENCION',
  CRITICA: 'GRAVE',
  // 🔴 DESCONOCIDO NO se pinta como OK. Son cosas distintas, y colapsarlas es lo
  //    que hacia `nivelBateria(NaN)` antes de arreglarse.
  DESCONOCIDO: 'NEUTRO',
}

/**
 * EL TONO DE LA BARRA, por umbral.
 *
 * 👤 Pedido por el usuario el 2026-08-16: «a la barra de bateria dale color
 *    segun el umbral en el que esta».
 *
 * 🔴 VIVE AL LADO DE `TONO` Y SALE DEL MISMO `nivel`. No es una segunda fuente
 *    de verdad: `nivelBateria()` decide una vez y esto solo elige con que se
 *    pinta. Separarlos seria como acabo el proyecto con dos copias de la
 *    semantica de bateria, una de las cuales podia decir «bien» sobre un NaN.
 *
 * 🔴 Y NINGUNO ES `--destructive`. Ese rojo es EXCLUSIVO de la parada de
 *    emergencia: `--estado-ir` es teja (168 62 40) y existe precisamente porque
 *    antes valia el mismo RGB que la parada, y `/no-obedece` acabo con CUATRO
 *    cosas en el rojo del boton.
 *
 * ⚠️ `DESCONOCIDO` no tiñe: sin dato no hay cursor que pintar, asi que este
 *    valor no llega a usarse — pero el `Record` es total a proposito, para que
 *    añadir un nivel nuevo sea un error de tipos y no un olvido.
 */
const TONO_BARRA: Readonly<Record<NivelBateria, string | undefined>> = {
  OK: '--estado-vivo',
  BAJA: '--estado-mirar',
  CRITICA: '--estado-ir',
  DESCONOCIDO: undefined,
}

const TEXTO: Readonly<Record<NivelBateria, string> > = {
  OK: 'por encima del umbral',
  BAJA: 'toca cargar',
  CRITICA: 'el RVR se va a apagar',
  // 🔴 NO SE PINTA. La entrada existe porque el `Record` es total, pero el
  //    veredicto de `DESCONOCIDO` no llega a la pantalla: bajo la raya del
  //    voltaje decia «no se sabe», o sea la misma ausencia dos veces, en simbolo
  //    y en prosa. La condicion que lo impide esta en la fila hero.
  DESCONOCIDO: SIN_DATO,
}

/**
 * EL VOLTAJE PARA LA FRANJA DEL MARCO, en las seis pestañas.
 *
 * 🔴 Vive AQUI y no en `MarcoRobot` para que la semantica de la bateria se
 *    decida en UN solo sitio: los umbrales (`nivelBateria`), el tono, y sobre
 *    todo que **DESCONOCIDO no es OK**. Duplicarla en la cabecera habria sido
 *    la forma exacta de que un dia una de las dos dijera «bien» sobre un
 *    `voltage` que llego como NaN.
 *
 * 📝 Sin porcentaje y sin antiguedad: aqui no caben, y la tarjeta de la pestaña
 *    de telemetria sigue siendo la que los da. Esto responde a una sola
 *    pregunta —«¿le queda bateria a este robot?»— sin cambiar de pantalla, que
 *    es lo que pide §4 del documento de diseño.
 */
export function VoltajeDelMarco() {
  const { transporte } = useRobot()
  const mensaje = useTopic(transporte, '/battery_state')
  useLatido()

  const v = voltajeDe(mensaje)
  const nivel: NivelBateria = v === null ? 'DESCONOCIDO' : nivelBateria(v)

  /*
    🔴 APILADO Y GRANDE, Y NO ES ESTETICA. Esto era una linea de `text-sm` al
       lado de un boton rojo de 90 px de alto: en la captura la mitad izquierda
       de la franja se leia vacia, con la unica cifra que decide si la practica
       puede seguir puesta en el tamaño de un pie de foto.

       El voltaje ES el signo vital de este robot -y por regla del proyecto, el
       unico valido: el porcentaje dijo 100 % con la bateria a 8,29 V, a 1,29 V
       del umbral de «baja» del propio firmware-. Darle el peso de un dato y no
       el de una etiqueta es decir la verdad sobre lo que significa.
  */
  return (
    <div className="flex flex-col gap-1">
      <span className="microetiqueta">Batería</span>
      <span className="flex items-baseline gap-2.5">
        {/*
          🔴 LA AUSENCIA NO SE PINTA CON EL PESO DEL DATO, y aqui se habia
             colado: al subir el voltaje a signo vital, «no se sabe» heredo la
             monoespaciada de 24 px. Con el robot apagado —el estado mas
             frecuente del laboratorio— la franja de las seis pestañas gritaba
             una ausencia con el tamaño de una medida.
             Es exactamente la regla que `Dato` ya hace cumplir con `.hueco`, y
             se aplica igual: raya pequeña y apagada, con la frase en `title`.
        */}
        {v === null ? (
          <span className="hueco text-lg leading-none" title={SIN_DATO}>—</span>
        ) : (
          <span className="cifra-menor text-foreground">{voltios(v)}</span>
        )}
        {nivel !== 'DESCONOCIDO' && <Insignia tono={TONO[nivel]}>{nivel}</Insignia>}
      </span>
    </div>
  )
}

export function Bateria() {
  const { transporte } = useRobot()
  /*
    🔴 `useTopicFechado` Y NO `useTopic`, Y ES LA TARJETA QUE MÁS LO NECESITA.
       `/battery_state` llega cada 30,0 s exactos, y `useTopic` vuelve a `null`
       al montar: cambiar de pestaña y volver dejaba esta tarjeta **medio minuto
       en rayas** con el robot perfectamente vivo y un voltaje leído hace un
       segundo. Ahora se siembra del recuerdo del transporte.

    ⚠️ Lo que hace honesto el préstamo es que la ANTIGÜEDAD ya se pintaba aquí
       —`desde`, con `useLatido()` para que envejezca en pantalla—. El valor
       nunca aparece sin su edad al lado, que es la condición del hook.

    ⚠️ Y el recuerdo muere con el enlace, así que un robot que se cae vuelve a
       «todavía no ha llegado ninguno» en vez de congelar su último voltaje.
  */
  const fechado = useTopicFechado(transporte, '/battery_state')
  const mensaje = fechado?.valor ?? null
  // El muestreo del latido: la antiguedad envejece sin que llegue nada nuevo, y
  // sin un re-render periodico se quedaria congelada en la pantalla.
  useLatido()

  const v = voltajeDe(mensaje)
  const nivel: NivelBateria = v === null ? 'DESCONOCIDO' : nivelBateria(v)
  const pct = porcentajeDe(mensaje)
  const desde = transporte.msDesdeUltimo('/battery_state')
  // La misma particion que hace `Dato`: el numero manda y la unidad acompaña.
  const { numero: cifra, unidad } = partirUnidad(voltios(v))

  return (
    <Tarjeta
      titulo="Batería"
      /*
        📝 El subtitulo dice la REGLA y nada mas. Antes traia la evidencia entera
           —«el porcentaje del firmware dijo 100 % con la bateria a 8,29 V»— y
           ocupaba dos lineas para dejar «V.» huerfano en la segunda, ademas de
           repetir literalmente una frase que el «Por qué» de abajo ya da con su
           contexto. La regla arriba, el aviso pegado al numero que se puede leer
           mal, y la evidencia en el desplegable: tres sitios, tres funciones.
      */
      subtitulo="Se decide por voltios, nunca por el porcentaje del firmware."
      /*
        🔴 LA PROSA DE CIERRE VA AL PIE, QUE ES PARA LO QUE `Tarjeta` LO TIENE.
           Colgaba del cuerpo como dos parrafos sueltos, sin regla que los
           separase de los datos, asi que se leian como una fila mas de la
           tarjeta. El pie trae su propia linea y su propio relleno.
      */
      pie={
        (v === null && mensaje !== null) || mensaje === null ? (
          <>
            {v === null && mensaje !== null && (
              <p>
                Ha llegado un <code>/battery_state</code> sin un voltaje válido. El driver publica{' '}
                <code>NaN</code> a propósito cuando la lectura falla —con el RVR apagado y la
                Raspberry Pi viva, por ejemplo— porque 0,00 V sería un dato y esto es un hueco.
              </p>
            )}
            {mensaje === null && (
              <p>
                Todavía no ha llegado ningún <code>/battery_state</code>. Llega cada 30,0 s, así que
                puede tardar medio minuto en aparecer aunque el robot esté perfectamente.
              </p>
            )}
          </>
        ) : undefined
      }
    >
      {/*
        🔴🔴 LA FILA HERO, Y POR QUE ESTA TARJETA ES LA UNICA DE LA PANTALLA QUE
             LA TIENE.

        Esto eran CUATRO lineas sueltas apiladas sin rejilla —rotulo, raya,
        «no se sabe», rotulo, raya— donde «Voltaje» y «Porcentaje que reporta el
        firmware (no decide nada)» pesaban lo mismo. Y el rotulo del que NO
        decide nada era cuatro veces mas largo, asi que en `.microetiqueta`
        -monoespaciada y espaciada- dominaba la tarjeta entera: el ojo aterrizaba
        en el dato desautorizado.

        El voltaje es el signo vital de este robot y el unico valido por regla del
        proyecto, asi que se pinta con `.cifra-hero` (~56 px), y todo lo
        subordinado —el porcentaje que no decide nada y los umbrales del
        firmware— se va al rail de la derecha.

        🔴 DOS COLUMNAS, Y NO DOS FILAS. Apilados, el porcentaje ocupaba una fila
           entera de la tarjeta a la misma anchura que el voltaje: dos bloques de
           ancho completo se leen como dos datos del mismo rango, que es
           exactamente lo que aqui NO son. Al lado y en una columna estrecha, la
           jerarquia se ve sin leer ninguno de los dos.

        📝 Va a mano y no con `<Dato grande>` por una sola razon: `Dato` pone la
           antiguedad DEBAJO del valor y no tiene sitio para la insignia. Aqui las
           dos comparten la linea base de la cifra, que es lo que hace que se lean
           como un solo enunciado —«8,23 V, correcto, de hace 12 s»— en vez de
           como tres cosas. El `<data value>` se emite igual: es la regla del
           proyecto y no se pierde por escribir el bloque a mano.

        ⚠️ LA ANTIGUEDAD SE QUEDA EN LA LINEA BASE DEL VOLTAJE, y no baja al
           rail. Es regla del proyecto —`/battery_state` llega cada 30,0 s, asi
           que su antiguedad va SIEMPRE al lado del voltaje— y ademas es lo que
           hace que las tres piezas se lean como una sola frase. Separarlas 300 px
           las convierte en dos datos.
      */}
      <div className="rejilla lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="px-5 pb-5 pt-4">
          <div className="microetiqueta">Voltaje</div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {/* La ausencia sigue siendo una raya pequeña: si creciera con la
                cifra hero, un robot apagado —el estado mas frecuente— pintaria
                un hueco de 56 px como si fuera una medida. */}
            {v === null ? (
              <span className="hueco text-2xl leading-none" title={SIN_DATO}>—</span>
            ) : (
              <data value={String(v)} className="cifra-hero">
                {cifra}
                {unidad !== null && <span className="unidad">{unidad}</span>}
              </data>
            )}
            {nivel !== 'DESCONOCIDO' && <Insignia tono={TONO[nivel]}>{nivel}</Insignia>}
            {v !== null && desde !== null && (
              <span className="text-[11px] leading-tight text-muted-foreground">
                hace {milisegundos(desde)}
              </span>
            )}
          </div>
          {/*
            🔴 EL VEREDICTO NO SE PINTA CUANDO NO HAY NIVEL. Con `DESCONOCIDO`
               el texto era «no se sabe», justo debajo de la raya que ya dice eso
               mismo: la ausencia repetida dos veces, en prosa y en simbolo.
          */}
          {nivel !== 'DESCONOCIDO' && (
            <p className="mt-2 max-w-prose text-[11px] leading-snug text-muted-foreground/80">
              {TEXTO[nivel]}
            </p>
          )}

          {/*
            ═══════════════════════════════════════════════════════════════════
            🔴 LA ESCALA IMPRESA, y es lo que contesta la pregunta de verdad
            ═══════════════════════════════════════════════════════════════════
            «7,80 V» no dice si el robot está bien. Lo dice **dónde cae 7,80
            entre 6,0 y 8,4, con *baja* en 7,0 y *crítica* en 6,5** — que es
            justo lo que un frontal de banco lleva serigrafiado al lado del
            conector desde que sale de fábrica.

            Hasta hoy esos dos umbrales vivían en una celda aparte del raíl, con
            su propio rótulo `UMBRALES`, a 300 px del valor al que se refieren.
            Estaban en pantalla y había que **componerlos mentalmente** con el
            voltaje: tres números sueltos y una resta.

            🔴 EL TOPE ES 8,4 V Y NO ES INVENTADO: el proyecto midió **8,29 V al
               «100 %»** del firmware, y 8,4 es el nominal de dos celdas de
               Li-ion en serie a plena carga. El suelo es 6,0 y sí es una
               elección: 0,5 V por debajo de «crítica», lo justo para que el
               umbral no quede pegado al canto.
               ⚠️ Anotado como elección, no como medida.

            📝 Y se dibuja también con el robot apagado: la regla es serigrafía,
               no dato. Con el RVR fuera esta tarjeta pasaba de tener cero cifras
               a tener dos; ahora tiene la escala entera.
          */}
          <EscalaImpresa
            valor={v}
            escala={ESCALA_BATERIA}
            formato={voltios}
            tono={TONO_BARRA[nivel]}
          />
        </div>

        {/*
          EL RAIL DE LO SUBORDINADO. Una sola celda de la rejilla, con las dos
          cosas que acompañan al voltaje sin competir con el.
        */}
        {/* 🔴 LOS DOS EN FILA, NO APILADOS. Apilados —y aún más repartidos con
            `justify-between`— el raíl medía 150 px de alto y **era él quien fijaba
            la altura de la fila**: con el robot apagado, cuando el voltaje es una
            raya de 24 px, la celda del hero quedaba con 120 px de papel debajo.
            Uno al lado del otro el raíl mide lo que mide una etiqueta y su cifra,
            y la fila deja de estar gobernada por lo subordinado. */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-5 pb-4 pt-4">
          {/* 🔴 EL ROTULO, ACORTADO. «Porcentaje que reporta el firmware (no
              decide nada)» son 51 caracteres en versalitas espaciadas; el matiz
              baja a la nota. Y aqui la escala es `.cifra-menor` a mano y no
              `Dato`: `Dato` pinta en `.cifra` —28-36 px—, que al lado de la
              cifra hero volveria a empatar el dato desautorizado con el bueno. */}
          <div>
            {/* ⚠️ «Porcentaje del firmware» son 23 caracteres en versalitas
                espaciadas: en esta columna partia en dos renglones y el rotulo
                acababa siendo mas alto que su propia cifra. El matiz baja a la
                nota, que es donde `Dato` documenta que va lo que el numero no
                dice por si mismo. */}
            <div className="microetiqueta">Porcentaje</div>
            <div className="mt-1">
              {pct === null ? (
                <span className="hueco text-lg leading-none" title={SIN_DATO}>—</span>
              ) : (
                <data value={String(pct)} className="cifra-menor text-muted-foreground">
                  {numero(pct, 0)}
                  <span className="unidad">%</span>
                </data>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
              Del firmware. No decide nada: es una estimación gruesa.
            </p>
          </div>

          {/*
            ═══════════════════════════════════════════════════════════════════
            🔴 AQUÍ VIVÍA LA CELDA `UMBRALES`, Y BAJÓ A LA ESCALA (2026-08-16)
            ═══════════════════════════════════════════════════════════════════
            Pintaba `7,00 baja` y `6,50 crítica` en `.cifra-menor`, en el raíl
            de lo subordinado. Su comentario decía —y tenía razón— que son *«el
            patrón contra el que se lee el voltaje, NUNCA la escala del valor»*.

            Y esa frase era el diagnóstico del defecto: un patrón contra el que
            se lee un valor, puesto **a 300 px de ese valor**, obliga a
            componerlo mentalmente. Tres números sueltos y una resta, cada vez.

            Ahora los dos umbrales están **dibujados sobre la misma regla que el
            voltaje**, o sea que la comparación ya no hay que hacerla. Y la
            histéresis, que era el matiz de esta celda, se queda donde estaba en
            el «Por qué»: es un detalle del firmware, no algo que se mire.

            📌 La celda no se sustituye por otra cosa: el raíl pasa a tener una
               sola columna. Rellenar el hueco con algo «para que no quede vacío»
               es cómo se llega a una pantalla con quince datos y ninguno que
               mande.
          */}
        </div>
      </div>

      <Contexto>
        <p>
          El porcentaje llega como fracción 0-1 y aquí ya va multiplicado por 100. Es una
          estimación gruesa del firmware: marcó <strong>100 % con la batería a 8,29 V</strong>, a
          1,29 V del umbral de «baja». Por eso esta pantalla decide por voltios y el porcentaje
          se enseña sin que decida nada.
        </p>
      </Contexto>
    </Tarjeta>
  )
}
