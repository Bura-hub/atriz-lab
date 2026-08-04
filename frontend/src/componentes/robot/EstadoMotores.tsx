'use client'

/**
 * La salud de los motores, con LA ANTIGUEDAD AL LADO DE CADA VALOR.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 POR QUE CADA CAMPO LLEVA SU PROPIA ANTIGUEDAD, Y NO UNA COMUN
 * ═══════════════════════════════════════════════════════════════════════════
 * Las tres señales de este mensaje llegan por caminos DISTINTOS, y el `.msg` del
 * robot cuenta que una sola antiguedad para las tres ya dio, en su primera
 * version, un `antiguedad_atasco_s = 0.0` -o sea «recien comprobado»- cuando el
 * atasco **no se comprueba nunca**: lo refrescaba el sondeo del fallo. Falsa
 * tranquilidad, que es peor que no publicar el campo.
 *
 *   fallo y termica -> se SONDEAN cada 30 s: su antiguedad es real
 *   atasco          -> solo existe por NOTIFICACION del firmware (el SDK no
 *                      tiene `get_motor_stall_state`), y **-1.0 significa
 *                      "nunca se ha sabido nada"**, no "no hay atasco"
 *
 * 🔴 Y una temperatura PLANA no es una temperatura estable: por encima de ~35 s
 * es el MISMO dato repetido, porque el sondeo va cada 30. Por eso la antiguedad
 * no es opcional aqui.
 *
 * ⚠️ `estado_termico_*` se pinta EN CRUDO. 0 es normal; el resto de valores los
 * define el RVR y este proyecto **no los ha caracterizado**. Traducirlos seria
 * inventarles un significado.
 */

import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { useLatido } from '@/hooks/useTransporte'
import { Frescura, interpretarAntiguedad } from '@/lib/rosbridge/contrato'
import { SIN_DATO, antiguedad, celsius, milisegundos, numero } from '@/lib/interfaz/formato'
import { atascoDe, falloDe } from '@/lib/interfaz/lecturas'
import { Dato } from '@/componentes/ui/Dato'
import { Insignia, TonoInsignia } from '@/componentes/ui/Insignia'
import { Contexto } from '@/componentes/ui/Contexto'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/** `true` -> hay un hecho positivo. `false` -> se comprobo. `null` -> no se sabe. */
function insigniaDeHecho(v: boolean | null, siHay: string, siNo: string) {
  const tono: TonoInsignia = v === true ? 'GRAVE' : v === false ? 'BIEN' : 'NEUTRO'
  return <Insignia tono={tono}>{v === true ? siHay : v === false ? siNo : SIN_DATO}</Insignia>
}

/**
 * Un hecho con su insignia y, SOLO SI SE SABE, su antiguedad.
 *
 * 🔴 Sin esta condicion la pantalla decia la misma frase dos veces seguidas:
 *
 *      Atasco  [no se sabe]  no se sabe
 *
 * porque la insignia pinta «no se sabe» cuando el hecho es `null` y
 * `antiguedad()` pinta «no se sabe» cuando la antiguedad vale -1 — y en el
 * atasco **las dos cosas son ciertas a la vez y siempre**, porque -1 es su
 * valor normal.
 *
 * Es la regla que `Dato.tsx` ya aplicaba y que aqui no se aplico: **si el valor
 * es un hueco, la antiguedad DE ESE VALOR tampoco existe**. Se vio en una
 * captura de pantalla; ninguna de las 337 pruebas la miraba, porque el texto
 * duplicado esta repartido entre DOS elementos y los detectores de
 * `repeticion.ts` trabajan sobre el texto de uno solo.
 */
function hechoConAntiguedad(
  etiqueta: string,
  v: boolean | null,
  siHay: string,
  siNo: string,
  f: Frescura,
) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      {insigniaDeHecho(v, siHay, siNo)}
      {v !== null && f.conocido && (
        <span className="text-[11px] text-muted-foreground">{antiguedad(f)}</span>
      )}
    </div>
  )
}

export function EstadoMotores() {
  const { transporte } = useRobot()
  const m = useTopic(transporte, '/motor_status')
  useLatido()

  const atascado = atascoDe(m)
  const fallo = falloDe(m)
  const fAtasco = interpretarAntiguedad(m?.antiguedad_atasco_s ?? -1)
  const fFallo = interpretarAntiguedad(m?.antiguedad_fallo_s ?? -1)
  const fTermico = interpretarAntiguedad(m?.antiguedad_termico_s ?? -1)
  const desde = transporte.msDesdeUltimo('/motor_status')

  return (
    <Tarjeta
      titulo="Motores"
      subtitulo="Cada valor con la antigüedad de SU fuente: llegan por caminos distintos y refrescan a ritmos distintos."
      // Misma regla que en Bateria: si no se sabe, los valores de dentro ya son
      // rayas y la insignia no añade nada. `null` es «no se sabe».
      extremo={atascado === null ? undefined : insigniaDeHecho(atascado, 'atasco', 'sin atasco')}
    >
      <div className="rejilla sm:grid-cols-2">
        <Dato
          etiqueta="Temperatura oruga izquierda"
          valor={celsius(m?.temperatura_izquierdo)}
          crudo={m?.temperatura_izquierdo}
          antiguedad={antiguedad(fTermico)}
          referencia="27,5 °C en reposo"
        />
        <Dato
          etiqueta="Temperatura oruga derecha"
          valor={celsius(m?.temperatura_derecho)}
          crudo={m?.temperatura_derecho}
          antiguedad={antiguedad(fTermico)}
          referencia="28,3 °C en reposo"
        />
        <Dato
          etiqueta="Estado térmico izquierdo (en crudo)"
          valor={numero(m?.estado_termico_izquierdo, 0)}
          crudo={m?.estado_termico_izquierdo}
          nota="0 es normal. Los demás valores los define el RVR y este proyecto no los ha caracterizado: se enseñan sin traducir."
        />
        <Dato
          etiqueta="Estado térmico derecho (en crudo)"
          valor={numero(m?.estado_termico_derecho, 0)}
          crudo={m?.estado_termico_derecho}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
        {hechoConAntiguedad('Atasco', atascado, 'oruga trabada', 'sin atasco', fAtasco)}
        {hechoConAntiguedad('Fallo eléctrico', fallo, 'hay fallo', 'sin fallo', fFallo)}
      </div>

      {atascado === true && (
        <p className="text-sm mt-3 max-w-prose">
          {m?.atascado_izquierdo === true && m?.atascado_derecho === true
            ? 'Las dos orugas están trabadas: suele ser el robot encallado o sobre un desnivel.'
            : m?.atascado_izquierdo === true
              ? 'La oruga izquierda está trabada.'
              : 'La oruga derecha está trabada.'}{' '}
          Lo detecta el firmware del RVR: ve corriente en el motor y no ve giro. Durante un atasco el
          propio robot enciende LEDs amarillos y rojos, así que se puede comprobar mirándolo.
        </p>
      )}

      {!fAtasco.conocido && (
        <Contexto><p>
          La antigüedad del atasco vale <code>-1.0</code>, que significa <em>nunca se ha sabido nada
          de eso</em>: no ha llegado ninguna notificación desde que arrancó el driver. Las banderas
          que hay debajo valen <code>false</code> porque es su valor inicial, no porque nadie haya
          comprobado nada — por eso aquí pone «{SIN_DATO}» y no «sin atasco».
        </p></Contexto>
      )}

      {fTermico.conocido && fTermico.antiguedadS > 35 && (
        <p className="text-xs text-muted-foreground mt-2 max-w-prose">
          La temperatura tiene {numero(fTermico.antiguedadS, 0)} s. El sondeo va cada 30 s, así que
          por encima de 35 s lo que se ve es el <strong>mismo dato repetido</strong>, no una
          temperatura que se mantenga.
        </p>
      )}

      {m === null && (
        <p className="text-xs text-muted-foreground mt-3 max-w-prose">
          Todavía no ha llegado ningún <code>/motor_status</code>. El driver lo republica a 1 Hz
          desde su estado cacheado, así que debería aparecer en un segundo si hay enlace.
        </p>
      )}
      {m !== null && (
        <p className="text-xs text-muted-foreground mt-2">
          Último <code>/motor_status</code> hace {desde === null ? SIN_DATO : milisegundos(desde)}.
        </p>
      )}
    </Tarjeta>
  )
}
