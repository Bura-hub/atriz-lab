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
import { SIN_DATO, milisegundos, numero, voltios } from '@/lib/interfaz/formato'
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

  return (
    <Tarjeta
      titulo="Batería"
      subtitulo="Se decide por voltios. El porcentaje del firmware dijo 100 % con la batería a 8,29 V."
      // 🔴 La insignia solo sale cuando DICE algo. Con la tarjeta sin datos, sus
      //    valores ya son rayas: repetir «no se sabe» arriba a la derecha era
      //    decir dos veces lo mismo, y en la captura del muro esa repeticion era
      //    justo lo que convertia el hueco en el contenido de la pantalla.
      extremo={nivel === 'DESCONOCIDO' ? undefined : <Insignia tono={TONO[nivel]}>{nivel}</Insignia>}
    >
      <Dato
        etiqueta="Voltaje"
        valor={voltios(v)}
        crudo={v ?? undefined}
        antiguedad={desde === null ? SIN_DATO : `hace ${milisegundos(desde)}`}
        grande
        // 🔴 Solo el VEREDICTO va pegado al valor: cambia con lo que llega y
        //    por tanto es estado. Los umbrales del firmware son constantes y
        //    bajan al desplegable — antes ocupaban dos lineas bajo cada numero
        //    y el ojo iba valor, parrafo, valor, parrafo.
        nota={TEXTO[nivel]}
      />
      <Dato
        etiqueta="Porcentaje que reporta el firmware (no decide nada)"
        valor={pct === null ? SIN_DATO : `${numero(pct, 0)} %`}
        crudo={pct ?? undefined}

      />
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

      {v === null && mensaje !== null && (
        <p className="text-xs text-muted-foreground mt-2 max-w-prose">
          Ha llegado un <code>/battery_state</code> sin un voltaje válido. El driver publica{' '}
          <code>NaN</code> a propósito cuando la lectura falla —con el RVR apagado y la Raspberry Pi
          viva, por ejemplo— porque 0,00 V sería un dato y esto es un hueco.
        </p>
      )}
      {mensaje === null && (
        <p className="text-xs text-muted-foreground mt-2 max-w-prose">
          Todavía no ha llegado ningún <code>/battery_state</code>. Llega cada 30,0 s, así que puede
          tardar medio minuto en aparecer aunque el robot esté perfectamente.
        </p>
      )}
    </Tarjeta>
  )
}
