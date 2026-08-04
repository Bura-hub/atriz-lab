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
import { Insignia, TonoInsignia } from '@/componentes/ui/Insignia'

/** Los tres estados con los colores del diseño: gris · verde · ámbar. */
const TONO_ESTADO: Readonly<Record<EstadoRobot, TonoInsignia>> = {
  SIN_CONEXION: 'NEUTRO',
  EN_LINEA: 'BIEN',
  SIN_DATOS: 'ATENCION',
}

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
const FRANJA: Readonly<Record<Baldosa['atencion'], string>> = {
  NINGUNA: 'border-l-0',
  MIRAR: 'border-l-4 border-l-warning',
  IR: 'border-l-8 border-l-destructive',
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
  return (
    <Link
      href={href}
      className={
        'block bg-card p-3 transition-colors hover:bg-muted/40 focus-ring '
        + FRANJA[baldosa.atencion]
      }
    >
      {/*
        ── LA DISTANCIA LARGA ──────────────────────────────────────────────
        Lo que tiene que leerse a tres metros: QUE robot y CUANTA bateria. El
        `clamp()` es el unico de la aplicacion, y se gana el sitio aqui: esta
        pantalla se proyecta.
      */}
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-mono font-bold leading-none tracking-tight"
          style={{ fontSize: 'clamp(1.75rem, 4.5vw, 3rem)' }}
        >
          {etiqueta}
        </span>
        {baldosa.atencion !== 'NINGUNA' && (
          <span
            className={`text-xs font-bold uppercase tracking-widest ${
              baldosa.atencion === 'IR' ? 'text-destructive' : 'text-warning'
            }`}
          >
            {TEXTO_ATENCION[baldosa.atencion]}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={`font-mono text-2xl leading-none ${
            baldosa.voltios === null ? 'italic text-base text-muted-foreground' : ''
          } ${baldosa.datosVigentes ? '' : 'opacity-50'}`}
        >
          {voltios(baldosa.voltios)}
        </span>
        {baldosa.bateria !== 'OK' && (
          <span className="text-xs text-muted-foreground">
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
      <div className="mt-1.5">
        <Insignia tono={TONO_ESTADO[baldosa.estado]}>{TEXTO_ESTADO[baldosa.estado]}</Insignia>
      </div>

      {baldosa.etiquetas.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
          {baldosa.etiquetas.map((e) => (
            <li key={e} className="text-[11px] leading-snug text-muted-foreground">
              · {e}
            </li>
          ))}
        </ul>
      )}

      {!baldosa.datosVigentes && (
        <p className="mt-1 text-xs text-muted-foreground italic">
          Lo de arriba es lo último que se supo, de antigüedad desconocida.
        </p>
      )}

      {baldosa.termicoRancio && (
        <p className="mt-1 text-xs text-muted-foreground">
          La temperatura publicada es el mismo dato repetido: el sondeo va cada 30 s.
        </p>
      )}
    </Link>
  )
}
