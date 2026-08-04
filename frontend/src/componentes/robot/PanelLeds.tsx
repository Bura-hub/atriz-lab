'use client'

/**
 * Los LEDs del robot. Y el sitio donde esta interfaz demuestra qué es capaz de
 * NO decir.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴 AQUI NO SE ANUNCIA NINGUN EFECTO FISICO
 * ═══════════════════════════════════════════════════════════════════════════
 * `/set_led_rgb` devuelve `bool success`, y en el driver ese booleano sale de:
 *
 *     ok, _, msg = self._pedir(...)   # «Devuelve (ok, resultado, mensaje).
 *     resp.success = ok               #   Nunca lanza». ok = la corrutina no lanzó
 *
 * O sea que `success = true` dice **una** cosa: que la llamada al SDK no lanzó
 * una excepción en 5 s. Y hay un caso medido, alcanzable desde esta misma lista,
 * donde eso y el efecto se separan: **`undercarriage_white` (led_id 10) responde
 * `success=True` y deja el LED apagado** —lo enciende `enable_color_detection`,
 * que es otro comando—. Se comprobó con el sensor de luz como testigo.
 *
 * → Por eso el resultado se escribe con `ORDEN_ENVIADA` y `textoDeConfirmacion()`,
 *   que salen de `contrato.ts`. Este componente no decide qué se puede prometer.
 *
 * ⚠️ ACCION FISICA: encender LEDs gasta batería y se ve en el aula. Y el LED
 * blanco de los bajos, si algún día se enciende de verdad, **no se apaga con
 * `turn_leds_off()`** —no es un grupo de `RvrLedGroups`—, así que quedaría
 * encendido indefinidamente.
 */

import { useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { ORDEN_ENVIADA, SERVICIO_FALLO, textoDeConfirmacion } from '@/lib/interfaz/lenguaje'
import { horaCorta } from '@/lib/interfaz/formato'
import { leerRespuestaServicio } from '@/lib/interfaz/lecturas'
import { Aviso } from '@/componentes/ui/Aviso'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const SERVICIO = '/set_led_rgb'

/**
 * `led_id` 11 es `all_lights`, verificado en la tabla `LEDS` del driver:
 * headlight_left(0) · headlight_right(1) · brakelight_left(2) · brakelight_right(3) ·
 * status_indication_left(4) · status_indication_right(5) · battery_door_front(6) ·
 * battery_door_rear(7) · power_button_front(8) · power_button_rear(9) ·
 * undercarriage_white(10) · all_lights(11).
 *
 * 📝 `all_lights` va el ULTIMO a proposito en el driver, para que el led_id 0 sea
 * una luz concreta y no «todas» -una sorpresa desagradable para quien pruebe.
 */
const TODAS_LAS_LUCES = 11

interface Orden {
  nombre: string
  rojo: number
  verde: number
  azul: number
  /**
   * 🔴 Una CLASE de Tailwind, no un `style` en linea, y por una razon medida: el
   * modo oscuro forzado del navegador -Edge lo trae de serie- **reescribe los
   * atributos `style` antes de que React hidrate**, y eso produce un aviso de
   * hidratacion («some attributes of the server rendered HTML didn't match»)
   * sobre un componente perfectamente sano. Se vio en el navegador, no se supuso:
   * el diff de React señalaba `--darkreader-inline-bgcolor`. Con la clase, el
   * navegador reescribe la HOJA DE ESTILOS y el HTML no cambia.
   */
  muestra: string
}

const ORDENES: readonly Orden[] = [
  { nombre: 'Apagar', rojo: 0, verde: 0, azul: 0, muestra: 'bg-muted' },
  { nombre: 'Rojo', rojo: 255, verde: 0, azul: 0, muestra: 'bg-[#ff0000]' },
  { nombre: 'Verde', rojo: 0, verde: 255, azul: 0, muestra: 'bg-[#00ff00]' },
  { nombre: 'Azul', rojo: 0, verde: 0, azul: 255, muestra: 'bg-[#0000ff]' },
  { nombre: 'Blanco', rojo: 255, verde: 255, azul: 255, muestra: 'bg-[#ffffff]' },
]

interface Resultado {
  hora: string
  cabecera: string
  detalle: string
  malo: boolean
}

export function PanelLeds() {
  const { transporte, conectado } = useRobot()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const enviar = async (o: Orden) => {
    setEnviando(true)
    const hora = horaCorta(Date.now())
    try {
      const bruta = await transporte.llamar(SERVICIO, {
        led_id: TODAS_LAS_LUCES, red: o.rojo, green: o.verde, blue: o.azul,
      })
      const { success, message } = leerRespuestaServicio(bruta)
      setResultado(
        success === false
          ? { hora, cabecera: SERVICIO_FALLO, detalle: message ?? 'sin mensaje', malo: true }
          : {
              hora,
              cabecera: `${ORDEN_ENVIADA}: ${o.nombre.toLowerCase()}`,
              detalle: `${textoDeConfirmacion(SERVICIO)}${message === null ? '' : ` El robot añadió: «${message}».`}`,
              malo: false,
            },
      )
    } catch (error) {
      setResultado({
        hora,
        cabecera: 'la orden NO se ha enviado',
        detalle: error instanceof Error ? error.message : String(error),
        malo: true,
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta
      titulo="LEDs"
      subtitulo="Acción física: enciende luces en el aula y gasta batería del RVR."
    >
      <div className="flex flex-wrap gap-2">
        {ORDENES.map((o) => (
          <button
            key={o.nombre}
            type="button"
            disabled={!conectado || enviando}
            onClick={() => void enviar(o)}
            className="inline-flex items-center gap-2 border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground focus-ring hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
          >
            <span
              className={`h-3.5 w-3.5 rounded-full border border-border ${o.muestra}`}
              aria-hidden="true"
            />
            {o.nombre}
          </button>
        ))}
      </div>

      {!conectado && (
        <p className="text-xs text-muted-foreground mt-2">
          Sin enlace no se puede llamar a ningún servicio, así que los botones están desactivados.
        </p>
      )}

      {resultado !== null && (
        <div className="mt-3">
          <Aviso nivel={resultado.malo ? 'ERROR' : 'ATENCION'} titulo={`${resultado.cabecera} · ${resultado.hora}`}>
            {resultado.detalle}
          </Aviso>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3 max-w-prose">
        Estas órdenes van a <code>all_lights</code>. Aquí no aparece el LED blanco de los bajos
        (<code>led_id 10</code>) aunque el robot lo acepte: se midió que responde igual que los
        demás y no se enciende —lo controla <code>enable_color_detection</code>, que es otro
        comando—. Es el motivo de que esta pantalla nunca diga más que «{ORDEN_ENVIADA}».
      </p>
    </Tarjeta>
  )
}
