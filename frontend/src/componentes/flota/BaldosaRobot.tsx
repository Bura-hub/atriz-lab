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
        className="vidrio pulsable focus-ring flex h-full flex-col justify-between rounded-ficha p-5"
      >
        {/* VIDRIO: no se llega a él, así que no pide nada. Sin color. */}
        <div className="flex items-start justify-between gap-2">
          <span
            className="font-semibold leading-none tracking-tight text-muted-foreground"
            style={{ fontSize: 'clamp(1.35rem, 2.5vw, 2rem)' }}
          >
            {etiqueta}
          </span>
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
            no llego
          </span>
        </div>
        <div className="mt-6">
          {/* Una raya, no la frase: se distingue de un cero al instante. */}
          <span className="font-mono text-xl text-muted-foreground" title={SIN_DATO}>—</span>
          <span className="mt-2 block text-[11.5px] text-muted-foreground">
            último dato: nunca
          </span>
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
        ── LA DISTANCIA LARGA ──────────────────────────────────────────────
        Lo que tiene que leerse a tres metros: QUE robot y CUANTA bateria.
      */}
      <div className="flex items-start justify-between gap-2">
        <span
          // 🔴 NO monoespaciado. `craft-floor.md`: «Monospace as a costume for
          //    "technical" rather than for code, data, o measurement». Esto es un
          //    NOMBRE, no una medida.
          className="font-bold leading-none tracking-tight"
          style={{ fontSize: 'clamp(1.5rem, 3.2vw, 2.4rem)' }}
        >
          {etiqueta}
        </span>
        <span className="shrink-0 rounded-full border-[1.5px] border-current px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider opacity-90">
          {baldosa.atencion === 'NINGUNA'
            ? TEXTO_ESTADO[baldosa.estado]
            : TEXTO_ATENCION[baldosa.atencion]}
        </span>
      </div>

      <div className="mt-auto flex items-baseline gap-2 pt-6">
        <span
          className={`font-mono font-bold leading-none tracking-tighter ${
            baldosa.voltios === null ? 'text-xl opacity-70' : 'text-[2.4rem]'
          } ${baldosa.datosVigentes ? '' : 'opacity-60'}`}
        >
          {voltios(baldosa.voltios)}
        </span>
        {baldosa.bateria !== 'OK' && (
          <span className="text-xs opacity-80">
            {baldosa.bateria === 'DESCONOCIDO' ? SIN_DATO : baldosa.bateria.toLowerCase()}
          </span>
        )}
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
