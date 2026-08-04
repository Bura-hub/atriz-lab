/**
 * Un valor con su etiqueta, y -si hace falta- su ANTIGUEDAD al lado.
 *
 * 🔴 LA REGLA QUE ESTE COMPONENTE HACE CUMPLIR: **una temperatura sin su
 * antiguedad no se pinta**. El sondeo termico del driver va cada 30 s, asi que
 * una temperatura que no cambia puede ser el MISMO dato repetido en vez de una
 * temperatura estable. Por eso `antiguedad` es una prop y no un adorno opcional
 * que se olvida.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 «NO SE SABE» ES LA AUSENCIA DE `<data>`, NO UN `<data value="">`
 * ═══════════════════════════════════════════════════════════════════════════
 * Esta es la parte que hace que este componente no sea cosmetica.
 *
 * Cuando hay valor se emite `<data value="7.42">`, el elemento que HTML define
 * para «una representacion legible por una persona con su equivalente legible
 * por una maquina». Cuando no lo hay, **no se emite el elemento**: se emite un
 * `<span>` con el texto de «no se sabe».
 *
 * Con eso, la regla central del proyecto —la pantalla nunca afirma lo que no
 * sabe— deja de ser un estilo en gris y cursiva y pasa a ser **estructura del
 * DOM**:
 *
 *   · se puede comprobar por script sobre el HTML servido, sin renderizar nada
 *   · un lector de pantalla distingue las dos cosas
 *   · y es imposible romperlo por accidente retocando clases de Tailwind
 *
 * ⚠️ Un `<data value="">` seria lo PEOR de las dos opciones: afirma que hay un
 *    valor legible por maquina, y no lo hay. Por eso el elemento desaparece
 *    entero en vez de quedarse vacio.
 *
 * ⚠️ Y `crudo` es OPCIONAL a proposito. `Dato` recibe el valor ya formateado
 *    («7,42 V»), asi que enhebrar el numero sin formatear hasta aqui cuesta
 *    tocar todas las llamadas. Se hace donde hay numero -bateria, temperaturas,
 *    odometria, encoders- y **no se inventa un `value` donde no lo hay solo para
 *    que la estructura quede simetrica**.
 */

import { ReactNode } from 'react'
import { SIN_DATO } from '@/lib/interfaz/formato'

export interface PropsDato {
  etiqueta: string
  /** Ya formateado. Si vale `SIN_DATO` se pinta atenuado y SIN `<data>`. */
  valor: string
  /**
   * El numero sin formatear, para el atributo `value` de `<data>`. Opcional:
   * ver la cabecera. **No lo rellenes con un 0 ni con una cadena vacia** — si no
   * hay numero crudo, se omite y no pasa nada.
   */
  crudo?: number
  /** «hace 12,4 s» o «no se sabe». Se pinta pegado al valor, nunca lejos. */
  antiguedad?: string
  /** El valor MEDIDO en el robot con el que comparar, si lo hay. */
  referencia?: string
  /** Una nota corta. Para lo que el numero no dice por si mismo. */
  nota?: ReactNode
  /** Numeros grandes para mirar de lejos (el muro del profesor). */
  grande?: boolean
}

export function Dato({
  etiqueta, valor, crudo, antiguedad, referencia, nota, grande,
}: PropsDato) {
  const desconocido = valor === SIN_DATO
  /*
   * 🔴 LA AUSENCIA NO SE PINTA COMO UN DATO.
   *
   * Antes «no se sabe» salia en monoespaciada y del MISMO tamaño que un valor.
   * Quince veces en la pantalla de telemetria, el hueco se convertia en el
   * contenido: lo primero que veia el ojo era una columna de ausencias.
   *
   * Ahora la ausencia es una raya, mas pequeña y apagada. Se distingue de un
   * cero al instante —que es la regla— pero deja el peso visual para lo que SI
   * llego. La explicacion de POR QUE no se sabe va una vez por tarjeta, no una
   * vez por campo.
   */
  const clases = desconocido
    ? 'hueco text-lg leading-none'
    : `font-mono tracking-tight ${grande === true ? 'text-3xl font-semibold' : 'text-lg'}`

  return (
    // Ritmo: apretado DENTRO del dato (etiqueta pegada al valor), generoso
    // ENTRE datos. `craft-floor`: «tight groups, generous separation».
    <div className="px-4 py-3">
      {/*
        La microetiqueta sobre el valor. `craft-floor.md:26` de la skill
        `impeccable` prohibe esto sin excepciones -«This one is a ban, not a
        default: no brief earns it back»-, y aqui tiene EXENCION ESCRITA
        (CLAUDE.md): en un instrumento la microetiqueta ES la unidad y el
        contexto del numero, no un adorno de marketing.
      */}
      <div className="text-[11px] leading-tight text-muted-foreground">{etiqueta}</div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {desconocido || crudo === undefined || !Number.isFinite(crudo) ? (
          // Una raya, no la frase. `title` deja la frase a un paso para quien la
          // necesite, sin que ocupe la pantalla de quien no.
          <span className={clases} title={desconocido ? 'no se sabe' : undefined}>
            {desconocido ? '—' : valor}
          </span>
        ) : (
          <data value={String(crudo)} className={clases}>{valor}</data>
        )}
        {/*
          🔴 «· dato de no se sabe» era ilegible, y ademas no significaba nada:
             si el VALOR es un hueco, la antiguedad DE ESE VALOR tampoco existe.
             Se pinta solo cuando hay algo que fechar.
        */}
      </div>

      {/*
        🔴 La antiguedad y la referencia BAJAN DE LINEA. Compartiendo linea base
           con el valor competian con el: el ojo leia «8,23 V · dato de hace
           8,5 s» como una sola cosa de dos partes iguales. Son subordinadas del
           valor, y ahora se ven asi.
      */}
      {((antiguedad !== undefined && !desconocido && antiguedad !== SIN_DATO)
        || (referencia !== undefined && !desconocido)) && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] leading-tight text-muted-foreground">
          {/*
            🔴 Sin prefijos. Los llamantes YA traen la palabra —`hace 7,9 s`,
               `27,5 °C en reposo`— y añadirla aqui producia «hace hace 7,9 s» y
               «en reposo: 27,5 °C en reposo». Se vio en la captura, no en las
               pruebas: ninguna comprueba texto renderizado.
          */}
          {antiguedad !== undefined && !desconocido && antiguedad !== SIN_DATO && (
            <span>{antiguedad}</span>
          )}
          {referencia !== undefined && !desconocido && (
            <span>{referencia}</span>
          )}
        </div>
      )}

      {nota !== undefined && (
        <p className="mt-2 max-w-prose text-[11px] leading-snug text-muted-foreground/80">{nota}</p>
      )}
    </div>
  )
}
