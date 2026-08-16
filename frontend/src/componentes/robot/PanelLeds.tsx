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
import {
  GRUPOS, LED_BAJOS, PRESETS, describirSeleccion, peticionApagarTodo, peticionPara,
} from '@/lib/robot/grupos_led'
import { conMemoria } from '@/lib/interfaz/selector_color'

/*
 * 🔴 AQUÍ VIVÍAN `SERVICIO = '/set_led_rgb'` Y `TODAS_LAS_LUCES = 11`, Y SE VAN.
 *
 * Este componente ya no elige el servicio ni el `led_id`: los decide
 * `peticionPara()` a partir de lo que haya marcado, y eso es lógica pura CON
 * PRUEBAS. Dejar aquí las constantes sería una segunda fuente de verdad sobre lo
 * que sale por el cable — que es la forma exacta del defecto que este mismo
 * repositorio acaba de cerrar en el teclado de conducir.
 */

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
  { nombre: 'Apagar todo', rojo: 0, verde: 0, azul: 0, muestra: 'bg-muted' },
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

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * 👤 QUÉ GRUPOS SE PINTAN (2026-08-16, pedido por el usuario)
   * ═══════════════════════════════════════════════════════════════════════════
   * *«dale un selector para elegir LEDs puntuales, o dos o tres… o todos»*.
   *
   * 🔴 Hasta hoy esta pantalla mandaba **siempre** a `all_lights`: ofrecía uno de
   *    doce grupos, y los diez normales —faros, luces de freno, indicadores,
   *    puerta de la batería, botón de encendido— existían en el robot, estaban en
   *    la lista blanca y no había forma de llegar a ellos.
   *
   * 📌 Arranca con los diez marcados: quien no toque el selector se encuentra
   *    exactamente el comportamiento de antes.
   *
   * 🔴 Y los presets NO son un estado aparte: fijan esta lista, que sigue siendo
   *    la única fuente de verdad. Así «Faros» y luego destildar uno es un gesto
   *    natural y no un modo del que haya que salir.
   */
  const [seleccion, setSeleccion] = useState<number[]>(() => GRUPOS.map((g) => g.id))
  const alternar = (id: number) => setSeleccion(
    (s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]),
  )

  /**
   * Pone un color conservando el tono cuando el nuevo no tiene ninguno.
   *
   * `aHSV` de un gris o un negro devuelve tono 0 —no hay otro que devolver, un
   * gris no tiene angulo— y aceptarlo moveria el marcador al rojo sin que nadie
   * tocara la rueda. `RGB -> HSV` no es inyectiva, y aqui es donde se nota.
   */
  /*
   * 🔴🔴 CONSERVABA EL TONO Y **NO LA SATURACIÓN**, y eso era un defecto
   *      reproducido: pulsar «Apagar» hacía saltar el marcador del plano de
   *      derecha a izquierda solo, y después el teclado únicamente producía
   *      grises hasta que alguien tocara el eje X. El mismo fallo que este
   *      componente dice existir para evitar, cometido en el otro eje.
   *      La regla vive ahora en `conMemoria`, con su prueba.
   */
  const ponerColor = (c: RGB) => setHsv((antes) => conMemoria(antes, aHSV(c)))

  const enviarColor = async (c: RGB, nombre: string, todos = false) => {
    setEnviando(true)
    const hora = horaCorta(Date.now())
    try {
      /*
       * 🔴 EL SERVICIO LO DECIDE `peticionPara`, no este componente: un grupo va
       *    por `/set_led_rgb`, los diez COLAPSAN a `all_lights` —una llamada en
       *    vez de diez idas y vueltas al puerto serie— y lo de en medio va por
       *    `/set_multiple_leds`. Esa decisión es lógica pura y está probada;
       *    aquí solo se ejecuta.
       */
      const peticion = todos ? peticionApagarTodo() : peticionPara(seleccion, c)
      if (peticion === null) {
        setResultado({
          hora,
          cabecera: 'no hay ningún grupo elegido',
          detalle: 'Marca al menos un grupo de luces, o usa «Apagar todo».',
          malo: true,
        })
        return
      }
      const bruta = await transporte.llamar(peticion.servicio, peticion.cuerpo)
      const { success, message } = leerRespuestaServicio(bruta)
      setResultado(
        success === false
          ? { hora, cabecera: SERVICIO_FALLO, detalle: message ?? 'sin mensaje', malo: true }
          : {
              hora,
              cabecera: `${ORDEN_ENVIADA}: ${nombre}`,
              detalle: `${textoDeConfirmacion(peticion.servicio)} ${describirSeleccion(todos ? GRUPOS.map((g) => g.id) : seleccion)}.${message === null ? '' : ` El robot añadió: «${message}».`}`,
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
      /*
        🔴 ESTE PIE DECÍA «estas órdenes van a `all_lights`», y desde que hay
           selector es falso: van a un grupo, a una lista o a `all_lights` según
           lo que esté marcado. Y lo del LED de los bajos se mudó a la fila
           desactivada del selector, que es donde se nota su ausencia.
      */
      pie={
        <p>
          Esta pantalla nunca dice más que «{ORDEN_ENVIADA}», y ese es el techo de lo que puede
          saber: el servicio confirma que no lanzó, no que la luz se encendiera. El único testigo
          es tu ojo, mirando el robot.
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
              /*
               * 🔴 «APAGAR TODO» IGNORA LA SELECCIÓN, y es deliberado. Su caso de
               *    uso número uno es apagar de golpe un robot que estorba —está
               *    medido que una luz olvidada aguanta 14 min 38 s encendida—, y
               *    con selección apagaría solo lo marcado: quien acabe de elegir
               *    dos faros se quedaría con ocho encendidos creyendo que apagó.
               *    Apagar es una salida de emergencia, no una operación sobre la
               *    selección actual.
               */
              void enviarColor(c, o.nombre.toLowerCase(), o.nombre === 'Apagar todo')
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

      {/* ── QUÉ LUCES ─────────────────────────────────────────────────────── */}
      <div className="mt-5 border-t border-[rgb(var(--filo)/0.09)] px-5 pt-4">
        <p className="microetiqueta">Qué luces</p>

        {/*
          Los presets fijan la selección; no son un modo. Por eso no llevan
          `aria-pressed`: no hay un estado «preset activo» que mantener, solo un
          atajo para marcar casillas.
        */}
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((pr) => (
            <button
              key={pr.nombre}
              type="button"
              disabled={!conectado || enviando}
              onClick={() => setSeleccion([...pr.ids])}
              className="pulsable focus-ring rounded-md border border-[rgb(var(--filo)/0.2)] px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {pr.nombre}
            </button>
          ))}
        </div>

        {/*
          🔴 DOS COLUMNAS Y NO TRES, y no es gusto: son DIEZ grupos en cinco
             parejas físicas. Con tres columnas sobran dos celdas y `.rejilla`
             —que dibuja separadores entre celdas— las pintaba como **dos bloques
             grises vacíos** al final de la lista. Se vio en la captura.
             Con dos, cada fila es una pareja: izquierdo/derecho o delante/detrás.
        */}
        <div className="rejilla mt-3 sm:grid-cols-2">
          {GRUPOS.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 text-[13px]"
            >
              <input
                type="checkbox"
                checked={seleccion.includes(g.id)}
                disabled={!conectado || enviando}
                onChange={() => alternar(g.id)}
                className="focus-ring h-4 w-4 shrink-0 accent-foreground"
              />
              <span>
                {g.nombre}
                {g.lado !== null && <span className="text-muted-foreground"> · {g.lado}</span>}
              </span>
            </label>
          ))}
        </div>

        {/*
          ═══════════════════════════════════════════════════════════════════
          🔴 EL LED DE LOS BAJOS SE ENSEÑA DESACTIVADO, Y NO ES UN CONTROL
          ═══════════════════════════════════════════════════════════════════
          Es el ÚNICO camino de esta interfaz que produce un `success = true`
          MEDIDO sin efecto: el testigo de luz dio 0,0 contra 2,497 con los
          demás. Ofrecerlo activo sería regalar el fallo.

          Y esconderlo tampoco vale ya: con un selector delante, quien haya
          leído la tabla del SDK contará once y buscará el que falta. El pie de
          la tarjeta lo explicaba, pero **explicaba una ausencia lejos de donde
          se nota**. Aquí la explicación vive donde está la trampa.

          ⚠️ La objeción es buena y conviene decirla: un control permanentemente
             desactivado se parece a «configuración que existe y no hace nada»,
             que es un patrón que este proyecto persigue. La diferencia es que
             esto **no es un control, es una ausencia rotulada** — no se puede
             pulsar, así que no se puede provocar el `success` vacío.
        */}
        <div className="mt-2 flex items-start gap-2.5 px-4 text-[13px] text-muted-foreground">
          <span aria-hidden="true" className="mt-[3px]">⊘</span>
          <p className="max-w-prose">
            <strong>Luz blanca de los bajos</strong> (<code>led_id {LED_BAJOS}</code>) — desde aquí
            no se enciende. Está medido que responde <code>success</code> y deja el LED apagado:
            no lo controla este grupo sino <code>enable_color_detection</code>, que es el
            interruptor de modo del <strong>sensor de color</strong>, en la pestaña Medidas.
          </p>
        </div>

        <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-muted-foreground">
          Se enviará a <strong>{describirSeleccion(seleccion)}</strong>. Marcar los diez y marcar
          «Todas» es lo mismo para el robot: se manda en una sola llamada en vez de diez.
        </p>
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

      {/*
        ═══════════════════════════════════════════════════════════════════════
        🔴 `aria-live` Y EL CONTENEDOR SIEMPRE MONTADO
        ═══════════════════════════════════════════════════════════════════════
        El resultado es **el único retorno** de esta acción: el efecto es físico y
        está al otro lado de la sala. `Aviso` solo pone `role="alert"` cuando el
        nivel es `ERROR`, y el éxito va como `ATENCION` — o sea sin rol. Peor: el
        contenedor se montaba con el resultado, y **una región viva tiene que
        existir ANTES de que llegue el contenido** o el lector no la anuncia.
        Así que ahora está siempre, vacía mientras no haya nada que decir.
      */}
      <div className="mt-3 px-5 pb-4 empty:hidden" role="status" aria-live="polite">
        {resultado !== null && (
          <Aviso nivel={resultado.malo ? 'ERROR' : 'ATENCION'} titulo={`${resultado.cabecera} · ${resultado.hora}`}>
            {resultado.detalle}
          </Aviso>
        )}
      </div>
    </Tarjeta>
  )
}
