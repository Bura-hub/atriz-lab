'use client'

/**
 * MEDIR UNA SUPERFICIE — los DOS modos del sensor de color.
 *
 * Sale del contrato escrito por el robot en `03_operacion/SENSOR_COLOR.md`
 * (2026-08-08, evidencia 86), medido en rvr-01 y **verificado además por
 * rosbridge**, que es este camino: 8/8 respuestas por modo, mediana 33-43 ms.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE UN INTERRUPTOR DE MODO Y NO UN INTERRUPTOR DE LUZ
 * ═══════════════════════════════════════════════════════════════════════════
 * Es la misma llamada —`/enable_color`— pero la pregunta que se le hace al
 * alumno cambia de «¿enciendo el LED?» a **«¿qué hay debajo?»**, que es lo que
 * de verdad decide. Y decide de una forma que no perdona: sobre una superficie
 * que EMITE luz, medir con el LED encendido **no da un resultado impreciso, da
 * el resultado invertido** — una pantalla roja a tope sale con `R/G = 0,66`, o
 * sea menos roja que verde.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LAS TRES COSAS QUE ESTA PANTALLA TIENE PROHIBIDO HACER
 * ═══════════════════════════════════════════════════════════════════════════
 * Las escribe el contrato del robot, y las tres son formas de mentir:
 *
 * 1. **No presentar `color_activo = false` como «apagado» o «no disponible».**
 *    En modo emisión ese es el estado CORRECTO y el sensor está midiendo.
 * 2. **No tratar `claro = 0` como un fallo.** Es un resultado legítimo —no llega
 *    luz—, y el discriminante es `success`. Medido: doce lecturas de cero
 *    absoluto, las doce con `success=True`.
 * 3. **No pintar un color sin decir de qué modo viene.** Los mismos R/G/B
 *    significan cosas distintas: en reflejo, el color de la superficie; en
 *    emisión, el de la luz que sale.
 */

import { useCallback, useState } from 'react'
import { useRobot } from '@/hooks/ContextoRobot'
import { useTopic } from '@/hooks/useTopic'
import { SIN_DATO, horaCorta, numero } from '@/lib/interfaz/formato'
import {
  LUZ_DE, NOMBRE_MODO, hayLectura, interpretar, luzConcuerda, motivoDeDuda, proporciones,
  type Lectura, type Modo,
} from '@/lib/robot/color'
import { Aviso } from '@/componentes/ui/Aviso'
import { Dato } from '@/componentes/ui/Dato'

const SERVICIO_LUZ = '/enable_color'
const SERVICIO_LEER = '/get_rgbc_sensor_values'

const NOMBRE_VEREDICTO: Record<string, string> = {
  ROJO: 'rojo', VERDE: 'verde', AZUL: 'azul',
}

interface Medida { lectura: Lectura; modo: Modo; hora: string }

export function MedirColor() {
  const { transporte, conectado } = useRobot()
  const estado = useTopic(transporte, '/estado_robot')
  /*
   * 🔴 EMPIEZA SIN MODO, Y NO ES INDECISION: ES QUE NO SE SABE.
   *
   * La primera versión arrancaba en `'REFLEJO'`. Al abrir la pantalla contra un
   * robot en reposo —la luz arranca apagada en los dieciséis— eso producía en el
   * acto **«el robot dice que la luz está al revés de lo que pide este modo»**,
   * o sea una queja antes de que nadie hubiera tocado nada. Se vio conduciendo la
   * pantalla, no leyendo el código.
   *
   * Y elegir el modo por lo que diga la luz del robot sería peor: la luz apagada
   * es el reposo de los dieciséis, así que un alumno midiendo el SUELO entraría
   * en modo emisión sin enterarse y leería oscuridad.
   *
   * → El modo es una afirmación sobre **lo que hay debajo del robot**, y eso la
   *   interfaz no puede saberlo ni deducirlo. Se pregunta.
   */
  const [modo, setModo] = useState<Modo | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [medida, setMedida] = useState<Medida | null>(null)
  const [fallo, setFallo] = useState<{ hora: string; texto: string } | null>(null)

  // `null` mientras no llegue `/estado_robot`: no se inventa un `false`.
  const colorActivo: boolean | null = estado === null ? null : estado.color_activo === true
  const concuerda = modo === null ? null : luzConcuerda(colorActivo, modo)

  const cambiarModo = useCallback(async (nuevo: Modo) => {
    setModo(nuevo)
    setMedida(null)
    setFallo(null)
    setOcupado(true)
    const hora = horaCorta(Date.now())
    try {
      await transporte.llamar(SERVICIO_LUZ, { data: LUZ_DE(nuevo) })
    } catch (e) {
      /*
       * 🔴 SE PINTA, y el texto distingue las dos paredes. El transporte ya
       *    separa el `result` de rosbridge —«¿pude llamar?»— del `success` del
       *    driver —«¿contestó el sensor?»—: un `result:false` llega aquí como
       *    excepción con el motivo REAL dentro, y un timeout como el genérico.
       *    Confundirlos manda a mirar el robot cuando el problema es la lista
       *    blanca, y al revés.
       */
      setFallo({ hora, texto: `No se pudo cambiar la luz: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setOcupado(false)
    }
  }, [transporte])

  const medir = useCallback(async () => {
    setOcupado(true)
    setFallo(null)
    const hora = horaCorta(Date.now())
    try {
      // `modo` no puede ser null aquí: el botón está deshabilitado sin modo.
      if (modo === null) return
      const r = await transporte.llamar(SERVICIO_LEER, {}) as Record<string, unknown>
      const n = (k: string) => (typeof r[k] === 'number' ? r[k] as number : NaN)
      setMedida({
        modo,
        hora,
        lectura: {
          rojo: n('red_channel_value'),
          verde: n('green_channel_value'),
          azul: n('blue_channel_value'),
          claro: n('clear_channel_value'),
          success: r.success === true,
          message: typeof r.message === 'string' ? r.message : '',
        },
      })
    } catch (e) {
      setFallo({ hora, texto: e instanceof Error ? e.message : String(e) })
    } finally {
      setOcupado(false)
    }
  }, [transporte, modo])

  const p = medida === null ? null : proporciones(medida.lectura)
  const veredicto = medida === null ? null : interpretar(p, medida.modo)

  return (
    <div className="rounded border border-border p-4">
      <h3 className="text-sm font-medium">Medir una superficie</h3>
      <p className="mt-0.5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        Lo que decide no es el LED, es <strong>qué hay debajo del robot</strong>.
      </p>

      {/* ── El modo ────────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Modo de medida">
        {(['REFLEJO', 'EMISION'] as Modo[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            disabled={!conectado || ocupado}
            onClick={() => { void cambiarModo(m) }}
            className={`pulsable focus-ring rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              modo === m
                ? 'border-foreground bg-foreground text-background'
                : 'border-[rgb(var(--filo)/0.2)]'
            }`}
          >
            {NOMBRE_MODO[m]}
            <span className="ml-2 text-[11px] opacity-70">
              {m === 'REFLEJO' ? 'suelo, cinta, papel' : 'pantalla, baldosa LED'}
            </span>
          </button>
        ))}
      </div>

      {/*
        🔴 AQUI ES DONDE SE INCUMPLE LA PROHIBICION 1 SI UNO SE DESCUIDA. El
           campo `color_activo` NO se presenta como «encendido / apagado» —eso
           haría leer el modo emisión como una avería—: se presenta como si la
           luz CONCUERDA con el modo pedido, que es la única pregunta útil.
      */}
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
        {modo === null
          ? 'Elige primero qué hay debajo del robot. No se puede deducir desde aquí, y elegir mal '
            + 'no da un número peor: da el número al revés.'
          : concuerda === null
            ? 'No llega /estado_robot, así que el robot no ha confirmado el estado de la luz.'
            : concuerda
              ? `El robot confirma la luz ${LUZ_DE(modo) ? 'encendida' : 'apagada'}, que es lo que pide este modo.`
              : 'El robot dice que la luz está al revés de lo que pide este modo. Vuelve a pulsarlo.'}
      </p>

      <button
        type="button"
        onClick={() => { void medir() }}
        disabled={!conectado || ocupado || modo === null}
        aria-busy={ocupado}
        className="pulsable focus-ring mt-3 rounded-md border border-[rgb(var(--filo)/0.2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground"
      >
        {ocupado ? 'Esperando al sensor…' : 'Medir ahora'}
      </button>

      {/* ── El resultado ───────────────────────────────────────────────── */}
      {medida !== null && (
        <div className="mt-4">
          <div className="rejilla sm:grid-cols-3 xl:grid-cols-6">
            <Dato etiqueta="Rojo" valor={numero(medida.lectura.rojo, 0)} crudo={medida.lectura.rojo} />
            <Dato etiqueta="Verde" valor={numero(medida.lectura.verde, 0)} crudo={medida.lectura.verde} />
            <Dato etiqueta="Azul" valor={numero(medida.lectura.azul, 0)} crudo={medida.lectura.azul} />
            {/*
              🔴 `claro` SIN VEREDICTO DE «POCO» O «MUCHO». 42 cuentas son una
                 lectura excelente en emisión y oscuridad en reflejo: el umbral
                 depende del modo y el robot prohíbe copiarlo de uno a otro.
            */}
            <Dato
              etiqueta="Claro"
              valor={numero(medida.lectura.claro, 0)}
              crudo={medida.lectura.claro}
              nota="Sin filtro: la luz total. No tiene unidades ni umbral fijo."
            />
            {/* Las proporciones, que son lo que decide el color. */}
            <Dato etiqueta="R / G" valor={p === null ? SIN_DATO : numero(p.rg, 2)} crudo={p?.rg} />
            <Dato etiqueta="B / G" valor={p === null ? SIN_DATO : numero(p.bg, 2)} crudo={p?.bg} />
          </div>

          <div className="mt-3" role="status">
            {!hayLectura(medida.lectura) ? (
              <Aviso nivel="ERROR" titulo={`El sensor no contestó bien · ${medida.hora}`}>
                El servicio respondió con <code>success: false</code>.
                {medida.lectura.message !== '' && <> El robot dice: «{medida.lectura.message}»</>}
              </Aviso>
            ) : veredicto === 'NO_SE_PUEDE_DECIR' ? (
              <Aviso nivel="ATENCION" titulo={`No se puede decir de qué color es · ${medida.hora}`}>
                {motivoDeDuda(p, medida.modo)}
                {medida.lectura.message !== '' && <> El robot añade: «{medida.lectura.message}»</>}
              </Aviso>
            ) : veredicto === null ? null : (
              <Aviso nivel="NOTA" titulo={`Medido · ${medida.hora}`}>
                {/*
                  🔴 EL MODO VA EN LA MISMA FRASE QUE EL COLOR, no en una nota al
                     pie. Es la prohibición 3: los mismos R/G/B significan el
                     color de la superficie en reflejo y el de la luz emitida en
                     emisión, y separarlos deja la frase a merced de quien la lea.
                */}
                {medida.modo === 'EMISION'
                  ? <>La luz que sale de la superficie es <strong>{NOMBRE_VEREDICTO[veredicto]}</strong>, medida en modo superficie luminosa.</>
                  : <>La superficie es <strong>{NOMBRE_VEREDICTO[veredicto]}</strong>, medida por reflejo del LED del robot.</>}
                {medida.lectura.message !== '' && <> El robot añade: «{medida.lectura.message}»</>}
              </Aviso>
            )}
          </div>
        </div>
      )}

      {fallo !== null && (
        <div className="mt-3" role="alert">
          <Aviso nivel="ERROR" titulo={`Sin respuesta · ${fallo.hora}`}>{fallo.texto}</Aviso>
        </div>
      )}
    </div>
  )
}
