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
import {
  ORDEN_ENVIADA, SERVICIO_FALLO, SOBRE_EL_COLOR_DEL_LED, textoDeConfirmacion,
} from '@/lib/interfaz/lenguaje'
import { horaCorta } from '@/lib/interfaz/formato'
import { leerRespuestaServicio } from '@/lib/interfaz/lecturas'
import {
  aHSV, aHex, aRGB, desdeHex, limitar, nombreAproximado, type HSV, type RGB,
} from '@/lib/robot/color_led'
import { Aviso } from '@/componentes/ui/Aviso'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { MuestraDeColor } from '@/componentes/robot/MuestraDeColor'
import { RuedaColor } from '@/componentes/robot/RuedaColor'

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

/**
 * Un canal suelto, 0..255. Se separa porque son tres iguales.
 *
 * 🔴 UN CAMPO VACIO DA `NaN`, Y NO SE ENVIA. `limitar(NaN)` devuelve 0 —es un
 *    suelo, no una respuesta—, asi que aplicarlo mientras alguien borra «255»
 *    para escribir «120» pondria el canal a cero en mitad del gesto y el color
 *    saltaria. Se ignora hasta que hay numero.
 */
function CampoCanal(
  { etiqueta, canal, valor, alCambiar, desactivado }: {
    etiqueta: string
    canal: string
    valor: number
    alCambiar: (n: number) => void
    desactivado: boolean
  },
) {
  const id = `canal-led-${etiqueta.toLowerCase()}`
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[12px] text-muted-foreground" htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        type="number"
        min={0}
        max={255}
        step={1}
        inputMode="numeric"
        disabled={desactivado}
        aria-label={`Canal ${canal}, de 0 a 255`}
        value={valor}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (e.target.value === '' || Number.isNaN(n)) return
          alCambiar(limitar(n))
        }}
        className="w-16 rounded-md border border-border bg-input px-2 py-1 font-mono text-[13px] focus-ring disabled:opacity-40"
      />
    </div>
  )
}

export function PanelLeds() {
  const { transporte, conectado } = useRobot()
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  /**
   * 🔴 EL COLOR SE GUARDA EN HSV, NO EN RGB — y el motivo esta en `RuedaColor`:
   *    `RGB -> HSV` no es inyectiva, asi que con RGB de por medio bajar el brillo
   *    a cero perderia el tono y el marcador saltaria al rojo delante del usuario.
   *
   * 🔴 Y EL VALOR INICIAL ES UN LITERAL, que es lo que cierra la hidratacion por
   *    si solo: servidor y cliente pintan exactamente el mismo HTML. El color solo
   *    se vuelve dinamico tras un gesto, o sea mucho despues de hidratar, y una
   *    discrepancia de hidratacion solo puede ocurrir en el primer pintado.
   */
  const [hsv, setHsv] = useState<HSV>({ tono: 0, saturacion: 1, valor: 1 })
  const color = aRGB(hsv)
  /**
   * Lo ESCRITO en el campo hexadecimal, que no es lo mismo que el color.
   *
   * 🔴 Mientras alguien teclea `#`, `#f`, `#ff`… el texto no es un color. Si el
   *    campo se pintara desde el color, cada tecla lo reescribiria y seria
   *    imposible escribir nada. `null` = «no lo esta editando nadie, enseña el
   *    color». Es la razon de que `desdeHex` devuelva `null` en vez de lanzar.
   */
  const [hexEscrito, setHexEscrito] = useState<string | null>(null)

  /**
   * Pone un color conservando el tono cuando el nuevo no tiene ninguno.
   *
   * `aHSV` de un gris o un negro devuelve tono 0 —no hay otro que devolver, un
   * gris no tiene angulo— y aceptarlo moveria el marcador al rojo sin que nadie
   * tocara la rueda. `RGB -> HSV` no es inyectiva, y aqui es donde se nota.
   */
  const ponerColor = (c: RGB) => {
    const nuevo = aHSV(c)
    setHsv({ ...nuevo, tono: nuevo.saturacion === 0 ? hsv.tono : nuevo.tono })
  }

  const enviarColor = async (c: RGB, nombre: string) => {
    setEnviando(true)
    const hora = horaCorta(Date.now())
    try {
      const bruta = await transporte.llamar(SERVICIO, {
        led_id: TODAS_LAS_LUCES, red: c.rojo, green: c.verde, blue: c.azul,
      })
      const { success, message } = leerRespuestaServicio(bruta)
      setResultado(
        success === false
          ? { hora, cabecera: SERVICIO_FALLO, detalle: message ?? 'sin mensaje', malo: true }
          : {
              hora,
              cabecera: `${ORDEN_ENVIADA}: ${nombre}`,
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
      /*
        🔴 LA PROSA DE CIERRE, AL PIE. Colgaba del cuerpo sin ninguna regla que
           la separase de los botones, asi que se leia como una fila mas del
           control. `Tarjeta.pie` le da su propia linea y el relleno de la
           columna del titulo — que es para lo que existe ese slot.
      */
      pie={
        <p>
          Estas órdenes van a <code>all_lights</code>. Aquí no aparece el LED blanco de los bajos
          (<code>led_id 10</code>) aunque el robot lo acepte: se midió que responde igual que los
          demás y no se enciende —lo controla <code>enable_color_detection</code>, que es otro
          comando—. Es el motivo de que esta pantalla nunca diga más que «{ORDEN_ENVIADA}».
        </p>
      }
    >
      {/* `px-5 pt-4`: el cuerpo de `Tarjeta` va a sangre para que las rejillas
          lleguen al canto, asi que lo que no es rejilla pone su relleno. */}
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {ORDENES.map((o) => (
          <button
            key={o.nombre}
            type="button"
            disabled={!conectado || enviando}
            /*
              🔴 EL ATAJO SIGUE ENVIANDO DE UN CLIC, y ademas carga el color en la
                 rueda. Convertirlo en «carga y luego pulsa enviar» habria costado
                 un clic mas en el caso que mas se usa —apagar las luces de un
                 robot que estorba— para ganar nada: la rueda ya tiene su propio
                 boton. Un selector nuevo no puede empeorar lo que ya funcionaba.
            */
            onClick={() => {
              const c = { rojo: o.rojo, verde: o.verde, azul: o.azul }
              // `ponerColor` conserva el tono si el atajo no tiene ninguno
              // (apagar, blanco): moverlo al rojo sin que nadie toque la rueda
              // seria un salto sin causa.
              setHexEscrito(null)
              ponerColor(c)
              void enviarColor(c, o.nombre.toLowerCase())
            }}
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

      {/* ── CUALQUIER OTRO COLOR ──────────────────────────────────────────── */}
      <div className="mt-5 border-t border-[rgb(var(--filo)/0.09)] px-5 pt-4">
        <p className="microetiqueta">Cualquier otro color</p>

        <div className="mt-3 flex flex-wrap items-start gap-4">
          <div className="flex flex-col items-center gap-1.5">
            <MuestraDeColor
              color={color}
              className="h-20 w-20 shrink-0 rounded-md border border-border"
            />
            {/*
              Nombrado y no solo en cifras: «#FF6B35» no se lee en voz alta. Y
              dice «aproximadamente»: nombrar un color es convencion, no medida.
            */}
            <span className="text-[12px] text-muted-foreground">
              aprox. {nombreAproximado(color)}
            </span>
          </div>

          <RuedaColor
            color={color}
            alCambiar={ponerColor}
            desactivada={!conectado || enviando}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-[12px] text-muted-foreground" htmlFor="hex-led">Hex</label>
            <input
              id="hex-led"
              type="text"
              spellCheck={false}
              maxLength={7}
              disabled={!conectado || enviando}
              value={hexEscrito ?? aHex(color)}
              onChange={(e) => {
                setHexEscrito(e.target.value)
                const leido = desdeHex(e.target.value)
                // Solo se aplica cuando de verdad es un color.
                if (leido !== null) ponerColor(leido)
              }}
              // Al salir del campo se vuelve a enseñar el color: si lo escrito
              // era basura, el campo no puede quedarse mintiendo sobre lo que hay.
              onBlur={() => setHexEscrito(null)}
              className="w-24 rounded-md border border-border bg-input px-2 py-1 font-mono text-[13px] focus-ring disabled:opacity-40"
            />
          </div>
          <CampoCanal
            etiqueta="R" canal="rojo" valor={color.rojo} desactivado={!conectado || enviando}
            alCambiar={(n) => { setHexEscrito(null); ponerColor({ ...color, rojo: n }) }}
          />
          <CampoCanal
            etiqueta="G" canal="verde" valor={color.verde} desactivado={!conectado || enviando}
            alCambiar={(n) => { setHexEscrito(null); ponerColor({ ...color, verde: n }) }}
          />
          <CampoCanal
            etiqueta="B" canal="azul" valor={color.azul} desactivado={!conectado || enviando}
            alCambiar={(n) => { setHexEscrito(null); ponerColor({ ...color, azul: n }) }}
          />
          <button
            type="button"
            disabled={!conectado || enviando}
            onClick={() => void enviarColor(color, aHex(color))}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground focus-ring hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-150 active:scale-[0.97]"
          >
            Enviar este color
          </button>
        </div>

        <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-muted-foreground">
          {SOBRE_EL_COLOR_DEL_LED}
        </p>
      </div>

      {!conectado && (
        <p className="mt-2 px-5 pb-4 text-xs text-muted-foreground">
          Sin enlace no se puede llamar a ningún servicio, así que los botones están desactivados.
        </p>
      )}

      {resultado !== null && (
        <div className="mt-3 px-5 pb-4">
          <Aviso nivel={resultado.malo ? 'ERROR' : 'ATENCION'} titulo={`${resultado.cabecera} · ${resultado.hora}`}>
            {resultado.detalle}
          </Aviso>
        </div>
      )}
    </Tarjeta>
  )
}
