'use client'

/**
 * DAR DE ALTA A UNA CLASE ENTERA, con su tabla de contraseñas de una sola vez.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE ESTA PANTALLA TIENE QUE DECIR ANTES DE GENERAR NADA
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se guarda es el hash, así que **estas contraseñas no se pueden volver a
 * consultar**: ni el profesor, ni el servidor, ni nadie con acceso al fichero.
 * Esta tabla es la **única** vez que existen legibles.
 *
 * Se avisa **antes** y no después, porque después es tarde: quien haya cerrado
 * la pestaña ya no puede recuperarlas y solo le queda resetear una por una. Es
 * exactamente el tipo de aviso que esta aplicación pone delante de la acción y
 * no debajo — «el motivo ES la acción».
 *
 * ⚠️ Y por eso el reseteo existe en la misma pantalla. Sin él, esto sería una
 *    trampa: quien pierda el papel se quedaría fuera para siempre.
 */

import { FormEvent, useState } from 'react'
import { TOPE_LOTE } from '@/lib/sesion/lote'
import { SIN_SERVIDOR } from '@/lib/sesion/entrada'
import { Aviso } from '@/componentes/ui/Aviso'

interface Alta { usuario: string; contrasena: string }

export function AltaPorLote({ alCrear }: { alCrear: () => Promise<void> }) {
  const [prefijo, setPrefijo] = useState('alumno')
  const [desde, setDesde] = useState('1')
  const [hasta, setHasta] = useState('16')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [creadas, setCreadas] = useState<Alta[] | null>(null)
  const [choques, setChoques] = useState<string[]>([])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setFallo(null)
    try {
      const r = await fetch('/api/sesion/usuarios/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefijo, desde: Number(desde), hasta: Number(hasta) }),
      })
      const d = (await r.json().catch(() => ({}))) as
        { error?: string; creadas?: Alta[]; choques?: string[] }
      if (!r.ok) {
        setFallo(d.error ?? (r.status === 401
          ? 'Tu sesión ha caducado. Vuelve a entrar.'
          : `Respuesta inesperada del servidor (código ${r.status}).`))
        return
      }
      setCreadas(d.creadas ?? [])
      setChoques(d.choques ?? [])
      await alCrear()
    } catch {
      setFallo(SIN_SERVIDOR)
    } finally {
      setEnviando(false)
    }
  }

  const cuantas = Number(hasta) - Number(desde) + 1

  return (
    <div>
      {/*
        🔴 EL AVISO VA ANTES DEL FORMULARIO, no debajo de la tabla. Debajo sería
           una explicación de por qué acabas de perder algo.
      */}
      <Aviso nivel="ATENCION" titulo="Las contraseñas se ven una sola vez">
        Se guardan cifradas, así que <strong>nadie podrá volver a consultarlas</strong> — tampoco
        tú. Cópialas o imprímelas antes de cerrar esto. Si alguien pierde la suya, se le
        cambia desde la tabla de abajo.
      </Aviso>

      <form onSubmit={(e) => void enviar(e)} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="microetiqueta mb-1 block">Prefijo</span>
          <input
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value)}
            spellCheck={false}
            className="w-40 rounded-md border border-border bg-input px-2.5 py-1.5 font-mono text-sm focus-ring"
          />
        </label>
        <label className="block">
          <span className="microetiqueta mb-1 block">Desde</span>
          <input
            type="number" min={1} max={TOPE_LOTE} value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-20 rounded-md border border-border bg-input px-2.5 py-1.5 font-mono text-sm focus-ring"
          />
        </label>
        <label className="block">
          <span className="microetiqueta mb-1 block">Hasta</span>
          <input
            type="number" min={1} max={TOPE_LOTE} value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-20 rounded-md border border-border bg-input px-2.5 py-1.5 font-mono text-sm focus-ring"
          />
        </label>
        <button
          type="submit"
          disabled={enviando}
          aria-busy={enviando}
          className="pulsable focus-ring rounded-md border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
        >
          {enviando ? 'Creando…' : `Crear ${Number.isFinite(cuantas) && cuantas > 0 ? cuantas : ''} cuentas`}
        </button>
      </form>

      {/* El nombre que saldría, para que se vea antes de pulsar. */}
      <p className="mt-2 text-[12px] text-muted-foreground">
        Se llamarán <code className="font-mono">{prefijo || '…'}-01</code>,{' '}
        <code className="font-mono">{prefijo || '…'}-02</code>… y entran como <strong>alumno</strong>.
      </p>

      {fallo !== null && (
        <div className="mt-3">
          <Aviso nivel="ERROR" titulo="No se han creado">{fallo}</Aviso>
        </div>
      )}

      {creadas !== null && (
        <div className="mt-5">
          {creadas.length === 0 ? (
            <Aviso nivel="NOTA" titulo="No se ha creado ninguna">
              Todas las del rango ya existían. No es un fallo: es lo que pasa al repetir el
              alta o al ampliar un grupo que ya estaba dado de alta.
            </Aviso>
          ) : (
            <>
              <p className="microetiqueta mb-2">
                {creadas.length} cuentas · cópialas ahora
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="microetiqueta pb-1.5 pr-4">Usuario</th>
                    <th scope="col" className="microetiqueta pb-1.5">Contraseña</th>
                  </tr>
                </thead>
                <tbody>
                  {creadas.map((c) => (
                    <tr key={c.usuario} className="border-t border-[rgb(var(--filo)/0.09)]">
                      <td className="py-1.5 pr-4 font-mono">{c.usuario}</td>
                      <td className="py-1.5 font-mono">{c.contrasena}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {choques.length > 0 && (
            <p className="mt-3 text-[12px] text-muted-foreground">
              Ya existían y se han saltado: {choques.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
