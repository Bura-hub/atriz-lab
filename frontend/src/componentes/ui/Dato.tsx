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
import { SIN_DATO, partirUnidad } from '@/lib/interfaz/formato'

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

/**
 * El valor MEDIDO EN EL LABORATORIO con el que se compara, con su cifra un
 * escalon por encima del texto y su coletilla debajo del todo.
 *
 * ⚠️ Un escalon, NO dos. Es el patron de comparacion, no la medida: si empatara
 *    con el valor que llega del robot, un dia alguien leeria la constante
 *    creyendo que es la lectura. Por eso va en `.cifra-menor` y en tinta
 *    secundaria, mientras el valor va en `.cifra` o `.cifra-hero` y en tinta
 *    plena.
 *
 * 📝 Si la referencia no empieza por un numero -«en reposo», por ejemplo- se
 *    pinta entera como texto: `partirUnidad` no fuerza nada.
 */
function Referencia({ texto, hayValor }: { texto: string; hayValor: boolean }) {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 EL PATRON NUNCA PESA MAS QUE LA RANURA DE SU MEDIDA
   * ═══════════════════════════════════════════════════════════════════════════
   * La ronda anterior subio la referencia a `.cifra-menor` para que la pantalla
   * apagada tuviera alguna cifra que leer. Se paso: con el robot apagado el
   * escalon quedaba **invertido** — la medida real caia a raya de 18 px al 55 %
   * de tinta y el patron se quedaba a 22 px en tinta casi negra. En Motores se
   * leia, de arriba abajo:
   *
   *     —
   *     27,5 °C en reposo
   *
   * o sea la pantalla **afirmando una temperatura que no tiene**, que es
   * exactamente lo que este proyecto lleva meses evitando. Y en la tabla del
   * diagnostico lo mas grande y oscuro de la pantalla era un numero que no se
   * esta midiendo.
   *
   * → La regla, y es comprobable: **el patron solo sube cuando hay una medida
   *   encima de la que ser subordinado.** Sin valor baja con el, y la referencia
   *   sigue viendose —que era el objetivo de la ronda anterior— pero como lo que
   *   es: contexto, no lectura.
   */
  if (!hayValor) {
    return <span className="opacity-80">{texto}</span>
  }
  /*
   * 🔴 UN SOLO NUMERO SUELTO, Y NADA MAS. La primera version aceptaba cualquier
   *    racimo de digitos y signos, asi que «99-102 % de lo que se le pide» sacaba
   *    «99-102» a 22 px partido en dos renglones — una referencia que es un
   *    RANGO no tiene una cifra que destacar, y agrandar media la desfiguraba.
   *    Lo vio un agente al mirar la captura, no leyendo el codigo.
   *
   * → Se exige un numero con separador decimal opcional **seguido de un
   *   espacio**. Con eso «0,199 m/s» sube y «99-102 %» se queda como texto, que
   *   es lo correcto: si no hay una cifra unica, no hay nada que destacar.
   */
  const m = /^([+-]?\d+(?:[.,]\d+)?)\s+(.*)$/.exec(texto.trim())
  if (m === null) return <span>{texto}</span>
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="cifra-menor text-muted-foreground">{m[1]}</span>
      {m[2] !== '' && <span>{m[2]}</span>}
    </span>
  )
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
  /*
   * 🔴 EL VALOR PASA A LA ESCALA DE CIFRAS, Y ANTES ERA 20 px.
   *
   * Esto pintaba `text-xl` (20) para un valor normal y `text-3xl` (30) para el
   * modo «grande». Las maquetas de Stitch pintan los valores de odometria y
   * temperatura a 40-48 px con la etiqueta en monoespaciada de 11 — y el dato
   * medido ES el contenido de esta aplicacion. Un instrumento cuyo numero pesa
   * lo mismo que el parrafo de al lado obliga a buscarlo, y aqui se busca con el
   * robot moviendose delante.
   *
   * ⚠️ El HUECO no crece con el valor, y es deliberado: sigue siendo una raya
   *    pequeña y apagada. Si la ausencia creciera igual que el dato, una pantalla
   *    sin conexion —el estado mas frecuente del laboratorio— saldria llena de
   *    rayas enormes, que es justo el falso peso que `Dato` existe para evitar.
   */
  const clases = desconocido
    ? 'hueco text-lg leading-none'
    : (grande === true ? 'cifra-hero' : 'cifra')

  // 🔴 El numero manda, la unidad acompaña. Ver `partirUnidad()`: es informacion,
  //    no adorno — un multimetro no pinta «8,23» y «V» al mismo peso.
  const { numero: cifra, unidad } = partirUnidad(valor)

  return (
    // Ritmo: apretado DENTRO del dato (etiqueta pegada al valor), generoso
    // ENTRE datos. `craft-floor`: «tight groups, generous separation».
    /* `px-5`, el mismo que la cabecera de `Tarjeta`: con `px-4` la columna de
       etiquetas caia 4 px a la izquierda de la columna del titulo, y en una
       rejilla de cuatro celdas eso son cuatro desalineaciones visibles. */
    <div className="px-5 py-3.5">
      {/*
        La microetiqueta sobre el valor. `craft-floor.md:26` de la skill
        `impeccable` prohibe esto sin excepciones -«This one is a ban, not a
        default: no brief earns it back»-, y aqui tiene EXENCION ESCRITA
        (CLAUDE.md): en un instrumento la microetiqueta ES la unidad y el
        contexto del numero, no un adorno de marketing.
      */}
      {/*
        🔴 EN `.microetiqueta`, QUE ES LA CLASE QUE EXISTE PARA ESTO. Iba en el
           mismo `text-[11px]` que la antiguedad y la nota de abajo, asi que los
           TRES niveles de una medida —rotulo, valor, subordinadas— se leian como
           dos. En monoespaciada, espaciada y en versalitas, el ojo distingue una
           LECTURA DEL ROBOT de algo que escribio una persona sin leer ninguna.
      */}
      <div className="microetiqueta">{etiqueta}</div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {desconocido || crudo === undefined || !Number.isFinite(crudo) ? (
          // Una raya, no la frase. `title` deja la frase a un paso para quien la
          // necesite, sin que ocupe la pantalla de quien no.
          <span className={clases} title={desconocido ? 'no se sabe' : undefined}>
            {desconocido ? '—' : valor}
          </span>
        ) : (
          <data value={String(crudo)} className={clases}>
            {cifra}
            {/* `.unidad` escala sola con los tres niveles de cifra: 0,42 em. */}
            {unidad !== null && <span className="unidad">{unidad}</span>}
          </data>
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
      {/*
        🔴🔴 LA REFERENCIA SE PINTA SIEMPRE, TAMBIEN SIN DATO — Y ANTES NO.

        Estaba atada a `!desconocido`, o sea que solo salia cuando ya habia un
        valor con el que compararla. Pero la referencia **no es un dato del
        enlace**: es una constante medida en el laboratorio y escrita en el
        codigo -«27,5 °C en reposo», «meseta real 0,199 m/s pidiendo 0,20»-. Con
        el robot apagado, que es el estado mas frecuente, la pantalla se quedaba
        con trece rayas y ni una cifra, teniendo esos numeros ahi mismo sin
        pintar.

        La tabla del diagnostico ya demostraba lo contrario: su columna «medido
        en el robot» sigue diciendo 16,53 Hz con el robot apagado, y es lo unico
        que se puede leer en esa pantalla.

        ⚠️ La ANTIGUEDAD si sigue oculta sin dato, y eso no cambia: fecha una
           llegada, asi que sin llegada no existe. Son dos cosas distintas y por
           eso dejan de compartir condicion.
      */}
      {((antiguedad !== undefined && !desconocido && antiguedad !== SIN_DATO)
        || referencia !== undefined) && (
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
          {/*
            🔴 LA REFERENCIA TIENE SU PROPIO ESCALON, Y NO ES CAPRICHO.

            Con el robot apagado -que es el estado a diseñar- la escala de tres
            niveles que se construyo **no se renderiza nunca**: todos los valores
            colapsan en una raya de 18 px. Y los unicos numeros de verdad que
            quedan en pantalla -«27,5 °C en reposo», «meseta real 0,199 m/s»,
            «7792 ticks/m»- eran el texto MAS PEQUEÑO que habia, 11 px grises.
            Una pantalla de instrumento apagada se quedaba sin ninguna ancla
            legible: quince rayas iguales.

            Ahora el numero de la referencia se parte y se pinta a `.cifra-menor`
            en tinta secundaria, con la coletilla en 11. Sube un escalon, no dos:
            **sigue siendo el patron de comparacion, no la medida**. Cuando
            llegue un dato de verdad, el valor esta dos niveles por encima.
          */}
          {referencia !== undefined && (
            <Referencia texto={referencia} hayValor={!desconocido} />
          )}
        </div>
      )}

      {nota !== undefined && (
        <p className="mt-2 max-w-prose text-[11px] leading-snug text-muted-foreground/80">{nota}</p>
      )}
    </div>
  )
}
