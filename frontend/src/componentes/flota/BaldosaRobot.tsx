/**
 * Una baldosa del muro del profesor. **Solo dibuja.**
 *
 * 🔴 LA DECISION DE QUE DECIR NO ES DE ESTE COMPONENTE: es de `resumirBaldosa()`
 * en `lib/flota/resumen.ts`, que es puro y tiene 28 pruebas detras -incluida una
 * que afirma el literal «sin señal de vida», porque una mutacion que lo cambiaba
 * por «robot averiado» pasaba desapercibida cuando las pruebas comparaban contra
 * la constante en vez de contra la cadena. Aqui se pinta lo que aquella decide, y
 * no se re-interpreta nada.
 *
 * 🔴 EL ROJO SOLO SALE DE `atencion === 'IR'`, que a su vez solo puede salir de un
 * HECHO POSITIVO Y ACTUAL: atasco confirmado por el firmware, o bateria por
 * debajo de 6,5 V, y ademas con latido. **Nunca de un hueco.** Con 16 robots
 * cargando a la vez -RVR apagado y Raspberry Pi viva, el estado cotidiano-,
 * pintar el hueco de rojo saca la flota entera en rojo, y un muro siempre rojo se
 * ignora.
 */

import { ReactNode } from 'react'
import Link from 'next/link'
import { Baldosa } from '@/lib/flota/resumen'
import { EstadoRobot } from '@/lib/rosbridge/salud'
import { SIN_DATO, voltios } from '@/lib/interfaz/formato'

/*
 * ⚠️ Aquí ya no se usa `Insignia`. Sus tonos están calculados sobre el pozo
 *    oscuro y sobre un bloque de color saturado no se leen. En una ficha el
 *    estado lo dice la píldora de borde, que hereda el color del texto del
 *    bloque y por tanto contrasta siempre.
 */
const TEXTO_ESTADO: Readonly<Record<EstadoRobot, string>> = {
  SIN_CONEXION: 'no llego',
  EN_LINEA: 'en línea',
  SIN_DATOS: 'sin telemetría',
}

/**
 * 🔴 LA ATENCION NO DEPENDE SOLO DEL COLOR: depende del GROSOR.
 *
 * El muro se mira desde el otro lado del aula y a veces proyectado. Un proyector
 * desatura, y una de cada doce personas no distingue rojo de ambar. Con la
 * franja, «hay que ir» se lee **por su grosor** aunque el color no llegue.
 *
 * `critique.md:718` de `impeccable` lo lista como defecto de accesibilidad con
 * estas palabras: «Meaning conveyed by color alone».
 */
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 VIDRIO O BLOQUE: LA DIFERENCIA **ES** EL IDIOMA DE ESTA PANTALLA
 * ═══════════════════════════════════════════════════════════════════════════
 *   VIDRIO  →  sin novedad, o no se llega al robot. No pide nada.
 *   BLOQUE  →  color a plena saturación. **Este robot pide algo.**
 *
 * El color saturado se lo gana el ESTADO, no la decoración. Con trece fichas de
 * vidrio y tres bloques, el ojo del profesor va solo. Si todas fueran de color
 * la pantalla gritaría entera y no diría nada; si todas fueran de vidrio, el que
 * importa se perdería entre los quince que no.
 *
 * ⚠️ Y el color NUNCA va solo: cada bloque lleva su PALABRA. Una de cada doce
 *    personas no distingue el lima del coral, y este muro se proyecta.
 */
const BLOQUE: Readonly<Record<Baldosa['atencion'], string>> = {
  // En línea y sin nada que mirar: cobalto. Es un bloque igual, porque «este
  // robot está vivo» ya es algo que decir cuando quince no lo están.
  NINGUNA: 'bg-bloque-vivo text-white shadow-bloque',
  MIRAR: 'bg-bloque-mirar text-[rgb(16,18,6)] shadow-bloque',
  IR: 'bg-bloque-ir text-white shadow-bloque',
}
const TEXTO_ATENCION: Readonly<Record<Baldosa['atencion'], string>> = {
  NINGUNA: '',
  MIRAR: 'mirar',
  IR: 'hay que ir',
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LA JERARQUÍA DE LA BALDOSA, Y POR QUÉ ESTABA DEL REVÉS
 * ═══════════════════════════════════════════════════════════════════════════
 * Hasta el 2026-08-05 el NOMBRE iba a 32 px en tinta fuerte y el VOLTAJE a 20
 * en gris. O sea: lo único legible a tres metros era lo único que ya se sabe
 * -qué robot es lo dice su POSICIÓN en la rejilla 4x4, que no se mueve-.
 *
 * La maqueta acordada (`muro_de_flota_laboratorio_atriz/screen.png`) lo compone
 * al revés: rótulo `VOLTAJE` en microetiqueta, el voltaje a ~40 px, y el nombre
 * pequeño encima. Es lo que hace este bloque.
 */
/** El nombre del robot: presente, y por debajo del dato. */
const TAMANO_NOMBRE = 'clamp(1.1rem, 1.8vw, 1.35rem)'

/**
 * 🔴 Y MAS PEQUEÑO TODAVIA CUANDO NO SE LLEGA AL ROBOT.
 *
 * En una ficha inalcanzable el nombre es **lo unico que queda escrito**, asi que
 * al tamaño de la ficha viva se convierte en el contenido de la baldosa — y con
 * los dieciseis apagados, en el contenido del muro entero. Lo que ese nombre dice
 * ya lo dice la POSICION en la rejilla 4x4, que no se mueve.
 *
 * ⚠️ La ficha NO cambia de forma al conectarse el robot: la fila de arriba la
 *    gobierna la altura de la pildora de estado (~26 px), que es mayor que
 *    cualquiera de los dos nombres. El hueco del dato ya estaba igualado con
 *    `ALTO_DEL_DATO`.
 */
const TAMANO_NOMBRE_SIN_CONEXION = 'clamp(0.95rem, 1.4vw, 1.1rem)'

/*
 * 🔴 EL HUECO DEL DATO MIDE LO MISMO EN LOS DOS ESTADOS, Y ESO ES EL PUNTO.
 *
 * Antes el voltaje iba a `text-xl` (20 px) en la baldosa de vidrio y a 2,4rem
 * (38,4) en la de bloque: la ficha **cambiaba de forma al conectarse**, así que
 * bastaba con que un robot apareciera para que el muro entero se recompusiera
 * -y el muro se mira mientras alguien camina hacia un robot-.
 *
 * El valor es `.cifra` con `line-height: 1`, así que su caja mide exactamente
 * su tamaño de fuente: reservar ese mismo `min-height` deja el hueco idéntico
 * aunque dentro solo haya una raya.
 *
 * ⚠️ Y la AUSENCIA sigue pintándose pequeña y apagada (`.hueco`): lo que se
 *    iguala es el SITIO, no el peso. Una raya de 36 px repetida dieciséis veces
 *    convierte el hueco en el contenido, que es la regla de `.hueco` entera.
 */
const ALTO_DEL_DATO = 'clamp(1.75rem, 2.6vw, 2.25rem)'

/**
 * El voltaje de una baldosa, con su rótulo. **La misma pieza en los dos
 * estados** — de eso va: si vidrio y bloque la componen distinto, el muro se
 * recoloca solo.
 *
 * `sobreBloque` no cambia la estructura, solo el color: `.microetiqueta` y
 * `.hueco` tiñen con `--muted-foreground`, que es un gris calculado sobre el
 * papel y sobre un bloque saturado no se lee. Ahí el color lo pone el propio
 * bloque (`currentColor`), que contrasta por construcción.
 */
function VoltajeDeBaldosa({ v, sobreBloque, atenuado, anclarAbajo = false, children }: {
  v: number | null
  sobreBloque: boolean
  /** Sin latido, lo de arriba es «lo último que se supo»: se atenúa entero. */
  atenuado: boolean
  /**
   * 🔴 LA RAYA AL FONDO DEL HUECO RESERVADO, Y SOLO DONDE NO HAY NADA DEBAJO.
   *
   * Medido el 2026-08-06 con los DIECISEIS apagados —el estado mas frecuente
   * del laboratorio—: la ficha media 147 px y la raya del voltaje moria a ~38
   * del canto inferior, contra los 20 del relleno. O sea que el tercio bajo de
   * cada ficha era papel muerto, y por dieciseis a la vez el hueco reservado se
   * leia como un error de maquetacion del muro entero, no como la ausencia de
   * un dato.
   *
   * ⚠️ **El alto reservado NO cambia** (`ALTO_DEL_DATO` sigue igual): lo que se
   *    mueve es donde cuelga la raya DENTRO de el, asi que la ficha sigue sin
   *    recomponerse cuando el robot aparece — que es la garantia entera de
   *    reservar ese hueco.
   *
   * 🔴 Y NO se aplica en la baldosa de bloque, a proposito. Ahi debajo van los
   *    motivos y las frases de aviso: pegar la raya al fondo la separa ~24 px
   *    de su propio `VOLTAJE` y la deja a ~10 de la linea siguiente, o sea
   *    agrupada con lo que NO la nombra. Es el defecto que la ronda anterior
   *    arreglo cambiando `items-end` por `items-baseline`, y no se reabre: en
   *    la baldosa de vidrio no hay nada debajo, asi que la ambigüedad no existe.
   */
  anclarAbajo?: boolean
  /** El nivel de batería, en la misma línea base que la cifra. */
  children?: ReactNode
}) {
  return (
    <div className={atenuado ? 'opacity-60' : undefined}>
      <p className={`microetiqueta ${sobreBloque ? '!text-current opacity-75' : ''}`}>Voltaje</p>
      {/*
        📝 Alineado a la linea base, la raya cuelga de su rotulo **y** la palabra
           de nivel de bateria comparte base con la cifra cuando el robot si
           llega. Con un solo hijo el resultado es el mismo que `items-start`.

        📐 Con valor, `.cifra` mide exactamente `ALTO_DEL_DATO` (`line-height: 1`),
           asi que llena la caja y las tres alineaciones dan el mismo pixel: el
           anclaje de abajo solo tiene efecto sobre la raya.
      */}
      <div
        className={`mt-1.5 flex gap-2 ${anclarAbajo && v === null ? 'items-end' : 'items-baseline'}`}
        style={{ minHeight: ALTO_DEL_DATO }}
      >
        {v === null ? (
          <span
            className={`font-mono text-lg leading-none ${sobreBloque ? 'opacity-60' : 'hueco'}`}
            title={SIN_DATO}
          >
            —
          </span>
        ) : (
          <span className="cifra">{voltios(v)}</span>
        )}
        {children}
      </div>
    </div>
  )
}

export interface PropsBaldosaRobot {
  baldosa: Baldosa
  /** A dónde lleva el clic. La baldosa es la puerta a la ficha del robot. */
  href: string
  etiqueta: string
}

export function BaldosaRobot({ baldosa, href, etiqueta }: PropsBaldosaRobot) {
  /*
   * 🔴 «NO LLEGO AL ROBOT» NO SE PINTA IGUAL QUE «LLEGO Y ESTA EN APUROS».
   *
   * Se veia en la primera captura del muro: con ningun robot conectado, las
   * DIECISEIS baldosas salian con franja ambar y la palabra MIRAR, y cada una
   * repetia cinco veces la misma no-informacion. Ochenta lineas diciendo lo
   * mismo — que es exactamente el falso positivo contra el que este componente
   * lleva un parrafo escrito en su cabecera, cometido en su propio render.
   *
   * La logica NO cambia: `atencion` sigue siendo MIRAR, porque alguien tiene que
   * mirar. Lo que cambia es el PESO VISUAL: una baldosa inalcanzable se dibuja
   * apagada y en una linea, sin franja. Asi, cuando UNO de los dieciseis se cae,
   * salta a la vista; y cuando se caen los dieciseis, se lee como lo que es —un
   * problema de red— en vez de como dieciseis robots en apuros.
   */
  if (baldosa.estado === 'SIN_CONEXION') {
    return (
      <Link
        href={href}
        className="vidrio pulsable focus-ring flex h-full flex-col rounded-ficha p-5"
      >
        {/* VIDRIO: no se llega a él, así que no pide nada. Sin color. */}
        <div className="flex items-start justify-between gap-2">
          <span
            className="font-semibold leading-none tracking-tight text-muted-foreground"
            style={{ fontSize: TAMANO_NOMBRE_SIN_CONEXION }}
          >
            {etiqueta}
          </span>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
            no llego
          </span>
        </div>
        {/*
          El MISMO bloque que la baldosa de bloque, con el mismo hueco: es lo
          que impide que la ficha se recomponga cuando el robot aparece. La
          raya, no la frase — se distingue de un cero al instante.

          🔴 AQUI HABIA UN «ultimo dato: nunca», Y SOBRABA. La pildora de arriba
             ya dice «no llego» y la raya ya dice que no hay valor: eran **tres
             formas del mismo hecho en una casilla**, y por dieciseis fichas, 48
             en el muro. Lo que falta cuando fallan todos no es repetirlo mas
             veces, es decirlo UNA vez arriba — que es lo que hace ahora
             `MuroFlota`.
        */}
        {/*
          📐 `pt-4` Y NO `pt-6`. Con la raya ya anclada al fondo del hueco, los
             24 px de separacion contra el nombre eran el ultimo tramo de papel
             muerto de la ficha: dejandolo en 16 la baldosa cierra con 20 px
             arriba y 20 abajo, que es su propio relleno. Va igual en las dos
             ramas -vidrio y bloque- para que la ficha no cambie de alto al
             conectarse el robot.
        */}
        <div className="mt-auto pt-4">
          <VoltajeDeBaldosa v={null} sobreBloque={false} atenuado={false} anclarAbajo />
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      /*
        🔴 AQUI HABIA `transition-transform duration-[var(--t-hover)]
           ease-[cubic-bezier(0.32,0.72,0,1)]`, Y ERA UN DEFECTO SILENCIOSO.

        Las utilidades de Tailwind viven en `@layer utilities`, que va DESPUES
        de `@layer components`: ese `transition-transform` no se sumaba a la
        transicion de `.pulsable`, la **sustituia entera**. Resultado: la
        pulsacion de las dieciseis baldosas duraba `--t-hover` -entonces 500 ms-
        en vez de los 140 que `.pulsable` fija, y con la curva de cajon de iOS.
        Una ficha que se hunde medio segundo al tocarla no se lee como respuesta.

        No hacia falta para nada mas: nadie declara un `transform` de hover en
        esta baldosa. Lo unico que se mueve aqui es la pulsacion, y de eso ya se
        encarga `.pulsable` con su duracion y su curva.
      */
      className={`pulsable focus-ring relative flex h-full flex-col overflow-hidden rounded-ficha p-5 ${BLOQUE[baldosa.atencion]}`}
    >
      {/*
        LA CIFRA FANTASMA. El número del robot, enorme y recortado por el canto
        del bloque. Refuerza a DÓNDE hay que ir sin añadir una palabra, y solo
        aparece en los bloques: en el vidrio sería adorno.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -right-4 font-mono text-[8.5rem] font-extrabold leading-none tracking-tighter opacity-[0.13]"
      >
        {etiqueta.slice(-2)}
      </span>

      <div className="relative flex flex-1 flex-col">
      {/*
        ── QUÉ ROBOT ES ────────────────────────────────────────────────────
        📝 Y va PEQUEÑO a propósito: a tres metros, «qué robot» ya lo dice su
           POSICIÓN en la rejilla —que no se mueve, por eso el orden por
           defecto es por número—. Lo que no se sabe sin leerlo es el voltaje,
           y por eso manda el de abajo.
      */}
      <div className="flex items-start justify-between gap-2">
        <span
          // 🔴 NO monoespaciado. `craft-floor.md`: «Monospace as a costume for
          //    "technical" rather than for code, data, o measurement». Esto es un
          //    NOMBRE, no una medida.
          className="font-bold leading-none tracking-tight"
          style={{ fontSize: TAMANO_NOMBRE }}
        >
          {etiqueta}
        </span>
        <span className="shrink-0 rounded-full border-[1.5px] border-current px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-90">
          {baldosa.atencion === 'NINGUNA'
            ? TEXTO_ESTADO[baldosa.estado]
            : TEXTO_ATENCION[baldosa.atencion]}
        </span>
      </div>

      {/*
        ── LA DISTANCIA LARGA ──────────────────────────────────────────────
        Lo que tiene que leerse a tres metros: CUÁNTA batería. Y se compone
        con la misma pieza que la baldosa de vidrio, para que el muro no se
        recomponga cuando este robot aparezca.
      */}
      {/* `pt-4`, el mismo que la rama de vidrio: ver el comentario de alla. */}
      <div className="mt-auto pt-4">
        <VoltajeDeBaldosa
          v={baldosa.voltios}
          sobreBloque
          atenuado={!baldosa.datosVigentes}
        >
          {/*
            🔴 `DESCONOCIDO` NO PONE PALABRA, Y NO ES QUE SE ESCONDA: la raya de
               arriba YA es «no se sabe» -lo lleva en su `title`-, así que
               escribirlo al lado pinta el mismo hueco dos veces. Antes salía
               «no se sabe no se sabe», porque el valor tambien lo imprimía.

            ⚠️ Y sigue sin pintarse como `OK`, que es la regla: un hueco se ve
               como hueco, no como una batería sana.
          */}
          {baldosa.bateria !== 'OK' && baldosa.bateria !== 'DESCONOCIDO' && (
            <span className="pb-0.5 text-xs leading-none opacity-80">
              {baldosa.bateria.toLowerCase()}
            </span>
          )}
        </VoltajeDeBaldosa>
      </div>

      {/*
        ── LA DISTANCIA CORTA ──────────────────────────────────────────────
        Pequeño, presente, y **nunca escondido**: `CLAUDE.md` prohibe tapar los
        motivos tras un desplegable porque «el motivo ES la accion».

        🔴 Se pintan las ETIQUETAS, no las frases. Medido el 2026-08-04: el peor
           caso real da SEIS motivos y el mas largo mide 155 caracteres — seis
           frases asi en una casilla de un 4x4 la hacen ilegible y desigualan las
           alturas de la rejilla. Estan TODAS; la frase entera vive un clic mas
           alla, en la ficha del robot, que es a donde lleva esta baldosa.
      */}
      {/*
        ⚠️ Sobre un bloque de color, la `Insignia` de papel no se lee: sus tonos
           están calculados sobre el pozo oscuro. Aquí el estado ya lo dice la
           píldora de arriba, así que la insignia sobra — y quitarla es lo que
           deja sitio a que los motivos se lean.
      */}
      {baldosa.etiquetas.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
          {baldosa.etiquetas.map((e) => (
            <li key={e} className="text-[11.5px] leading-snug opacity-85">
              · {e}
            </li>
          ))}
        </ul>
      )}

      {/*
        ⚠️ Solo si de verdad HAY algo arriba. Antes salia siempre que faltaba el
           latido — incluso con todos los campos vacios, donde «lo de arriba» no
           existe y la frase no significaba nada.
      */}
      {!baldosa.datosVigentes && baldosa.voltios !== null && (
        <p className="mt-1.5 text-[11.5px] italic opacity-80">
          Lo de arriba es lo último que se supo, de antigüedad desconocida.
        </p>
      )}

      {baldosa.termicoRancio && (
        <p className="mt-1.5 text-[11.5px] opacity-80">
          La temperatura publicada es el mismo dato repetido: el sondeo va cada 30 s.
        </p>
      )}
      </div>
    </Link>
  )
}
