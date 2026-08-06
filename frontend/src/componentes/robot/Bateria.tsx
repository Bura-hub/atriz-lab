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
import { useTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { NivelBateria, V_BAJA, V_CRITICA, nivelBateria } from '@/lib/rosbridge/contrato'
import { SIN_DATO, milisegundos, numero, partirUnidad, voltios } from '@/lib/interfaz/formato'
import { porcentajeDe, voltajeDe } from '@/lib/interfaz/lecturas'
import { Dato } from '@/componentes/ui/Dato'
import { Insignia, TonoInsignia } from '@/componentes/ui/Insignia'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const TONO: Readonly<Record<NivelBateria, TonoInsignia>> = {
  OK: 'BIEN',
  BAJA: 'ATENCION',
  CRITICA: 'GRAVE',
  // 🔴 DESCONOCIDO NO se pinta como OK. Son cosas distintas, y colapsarlas es lo
  //    que hacia `nivelBateria(NaN)` antes de arreglarse.
  DESCONOCIDO: 'NEUTRO',
}

const TEXTO: Readonly<Record<NivelBateria, string>> = {
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
  const mensaje = useTopic(transporte, '/battery_state')
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
        proyecto, asi que se pinta con `.cifra-hero` (~56 px) a ancho completo,
        con su veredicto y su antiguedad al lado, y el porcentaje baja a una fila
        secundaria de la misma rejilla.

        📝 Va a mano y no con `<Dato grande>` por una sola razon: `Dato` pone la
           antiguedad DEBAJO del valor y no tiene sitio para la insignia. Aqui las
           dos comparten la linea base de la cifra, que es lo que hace que se lean
           como un solo enunciado —«8,23 V, correcto, de hace 12 s»— en vez de
           como tres cosas. El `<data value>` se emite igual: es la regla del
           proyecto y no se pierde por escribir el bloque a mano.
      */}
      <div className="rejilla">
        <div className="px-5 pb-4 pt-4">
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
        </div>

        {/* 🔴 EL ROTULO, ACORTADO. «Porcentaje que reporta el firmware (no decide
            nada)» son 51 caracteres en versalitas espaciadas; el matiz baja a la
            nota, que es donde `Dato` documenta que va lo que el numero no dice. */}
        <Dato
          etiqueta="Porcentaje del firmware"
          valor={pct === null ? SIN_DATO : `${numero(pct, 0)} %`}
          crudo={pct ?? undefined}
          nota="No decide nada: es una estimación gruesa. Se enseña para que nadie lo busque en otro sitio."
        />
      </div>

      <Contexto>
        <p>
          Umbrales del firmware: <strong>baja</strong> por debajo de {voltios(V_BAJA)} y{' '}
          <strong>crítica</strong> por debajo de {voltios(V_CRITICA)}, con 0,2 V de histéresis.
        </p>
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
