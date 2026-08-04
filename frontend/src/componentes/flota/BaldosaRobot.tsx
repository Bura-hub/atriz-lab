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

const BORDE: Readonly<Record<Baldosa['atencion'], string>> = {
  NINGUNA: 'border-border',
  MIRAR: 'border-warning/50',
  IR: 'border-destructive',
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
      className={`block rounded-lg border-2 bg-card p-3 transition-colors hover:bg-muted/40 focus-ring ${BORDE[baldosa.atencion]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{etiqueta}</span>
        <Insignia tono={TONO_ESTADO[baldosa.estado]}>{TEXTO_ESTADO[baldosa.estado]}</Insignia>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`font-mono tabular-nums text-xl ${
            baldosa.voltios === null ? 'italic text-sm text-muted-foreground' : ''
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

      {baldosa.atencion !== 'NINGUNA' && (
        <p
          className={`mt-1 text-xs font-medium uppercase tracking-wide ${
            baldosa.atencion === 'IR' ? 'text-destructive' : 'text-warning'
          }`}
        >
          {TEXTO_ATENCION[baldosa.atencion]}
        </p>
      )}

      {baldosa.motivos.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {baldosa.motivos.map((m) => (
            <li key={m} className="text-xs text-muted-foreground leading-snug">
              {m}
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
