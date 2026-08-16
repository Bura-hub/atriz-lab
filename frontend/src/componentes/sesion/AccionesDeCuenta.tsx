'use client'

/**
 * LAS TRES ACCIONES DE UNA FILA: ascender/degradar, resetear y borrar.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 BORRAR PIDE CONFIRMACION ESCRIBIENDO EL NOMBRE, Y NO ES CEREMONIA
 * ═══════════════════════════════════════════════════════════════════════════
 * Es la unica accion **irreversible** de toda la aplicacion: no hay papelera, y
 * rehacer la cuenta no devuelve nada porque la contraseña anterior era un hash.
 * Un `confirm()` del navegador se despacha con la barra espaciadora sin leerlo;
 * teclear el nombre obliga a mirar **cual** se esta borrando, que es justo el
 * error que se comete — borrar la fila de al lado.
 *
 * ⚠️ Y NO SE USA UN MODAL. `impeccable` en modo Operate lo dice sin matices:
 *    *«modal as first thought is usually laziness»*. La confirmacion se abre en
 *    la propia fila, donde esta el nombre que hay que leer.
 *
 * 🔴 LOS ERRORES SUBEN, no se pintan aqui. Una fila de tabla no tiene sitio para
 *    un motivo de dos lineas —«es el ultimo profesor, si lo borras nadie podra
 *    crear cuentas»— y recortarlo lo convertiria en «no se pudo». El motivo ES
 *    la accion: sube al aviso del panel, que si tiene sitio.
 */

import { useState } from 'react'
import { SIN_SERVIDOR } from '@/lib/sesion/entrada'
import type { Rol } from '@/lib/sesion/reglas'

interface Props {
  cuenta: { usuario: string; rol: Rol }
  soyYo: boolean
  /**
   * 🔴 EL CLIENTE TAMBIEN LO SABE, y por eso lo comprueba.
   *
   * El servidor es el que manda —contesta 409 y su motivo—, pero dejar el boton
   * encendido significa ofrecer una accion que **se sabe** que va a fallar. En
   * esta aplicacion un control encendido es una promesa; apagarlo con su motivo
   * en el `title` dice lo mismo ANTES de gastar un clic y una respuesta de error.
   *
   * ⚠️ No sustituye a la comprobacion del servidor: a esa ruta se le puede llamar
   *    con `curl` sin pasar por esta pantalla. Son dos capas, no una duplicada.
   */
  esUltimoProfesor: boolean
  alCambiar: () => Promise<void>
  alFallar: (motivo: string) => void
}

const BOTON = 'focus-ring pulsable rounded-md border border-[rgb(var(--filo)/0.18)] '
  + 'px-2.5 py-1 text-[12px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45'

export function AccionesDeCuenta({
  cuenta, soyYo, esUltimoProfesor, alCambiar, alFallar,
}: Props) {
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [tecleado, setTecleado] = useState('')

  const llamar = async (opciones: RequestInit) => {
    setOcupado(true)
    try {
      const r = await fetch(`/api/sesion/usuarios/${encodeURIComponent(cuenta.usuario)}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opciones,
      })
      const d = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        alFallar(d.error ?? (r.status === 401
          ? 'Tu sesión ha caducado. Vuelve a entrar.'
          : `Respuesta inesperada del servidor (código ${r.status}).`))
        return false
      }
      await alCambiar()
      return true
    } catch {
      alFallar(SIN_SERVIDOR)
      return false
    } finally {
      setOcupado(false)
    }
  }

  if (confirmando) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-muted-foreground">
          Escribe <code className="font-mono">{cuenta.usuario}</code>
          <input
            value={tecleado}
            onChange={(e) => setTecleado(e.target.value)}
            autoFocus
            spellCheck={false}
            aria-label={`Escribe ${cuenta.usuario} para confirmar el borrado`}
            className="focus-ring ml-2 w-40 rounded-md border border-border bg-input px-2 py-1 font-mono text-[12px]"
          />
        </label>
        <button
          type="button"
          disabled={ocupado || tecleado.trim().toLowerCase() !== cuenta.usuario}
          onClick={() => { void llamar({ method: 'DELETE' }) }}
          /*
            🔴 EL ROJO DE `--destructive` NO SE USA AQUI. Está reservado a la
               parada de emergencia —`MarcoRobot` promete que es el único
               elemento en rojo, y este proyecto ya descubrió que esa promesa era
               falsa una vez—. Lo que separa esta acción es que **exige teclear
               el nombre**, que es más fuerte que un color.
          */
          className={`${BOTON} font-semibold`}
        >
          {ocupado ? 'Borrando…' : 'Borrar de verdad'}
        </button>
        <button
          type="button"
          onClick={() => { setConfirmando(false); setTecleado('') }}
          className={BOTON}
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={ocupado || esUltimoProfesor}
        title={esUltimoProfesor
          ? 'Es el último profesor: si lo pasas a alumno, nadie podrá administrar cuentas'
          : undefined}
        onClick={() => {
          void llamar({
            method: 'PATCH',
            body: JSON.stringify({ rol: cuenta.rol === 'profesor' ? 'alumno' : 'profesor' }),
          })
        }}
        className={BOTON}
      >
        {cuenta.rol === 'profesor' ? 'Pasar a alumno' : 'Hacer profesor'}
      </button>

      <button
        type="button"
        disabled={ocupado || soyYo}
        title={soyYo ? 'Para cambiar la tuya hace falta la contraseña actual' : undefined}
        onClick={() => {
          /*
           * El reseteo genera una contraseña aquí y la enseña una sola vez, igual
           * que el alta por lote. Se usa `crypto.getRandomValues` del navegador:
           * `Math.random` no sirve para una credencial, y esto no necesita servidor.
           */
          const azar = new Uint32Array(4)
          crypto.getRandomValues(azar)
          const nueva = [...azar].map((n) => n.toString(36).slice(0, 5)).join('-')
          void llamar({ method: 'PATCH', body: JSON.stringify({ contrasena: nueva }) })
            .then((bien) => {
              if (bien) {
                // Se enseña por el canal de error a propósito: es el único aviso
                // de la pantalla con sitio para un texto largo, y esta contraseña
                // NO se puede volver a consultar.
                alFallar(`Nueva contraseña de «${cuenta.usuario}»: ${nueva} — cópiala ahora, `
                  + 'no se puede volver a ver.')
              }
            })
        }}
        className={BOTON}
      >
        Resetear
      </button>

      <button
        type="button"
        disabled={ocupado || soyYo}
        title={soyYo ? 'No puedes borrar tu propia cuenta' : undefined}
        onClick={() => setConfirmando(true)}
        className={BOTON}
      >
        Borrar
      </button>
    </div>
  )
}
