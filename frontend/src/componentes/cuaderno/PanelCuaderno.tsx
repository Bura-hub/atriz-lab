'use client'

/**
 * EL CUADERNO DE MEDIDAS: lo que dijo el robot contra lo que midió la persona.
 *
 * La aritmética y el formato viven en `lib/cuaderno/medidas.ts`, que es puro y
 * tiene 8 pruebas. Aquí solo se pinta y se guarda.
 *
 * ⚠️ Ruta propuesta por el análisis multiagente: el alumno mide con cinta y
 *    transportador, y esas medidas vivían en papel. La pareja robot/persona es
 *    el corazón del laboratorio — la odometría de este robot está contrastada
 *    contra cinta, y eso solo se sabe porque alguien anotó las dos columnas.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AVISO_ALMACENAMIENTO, CLAVE_CUADERNO, Medida, aCSV, diferencia, leerMedidas,
} from '@/lib/cuaderno/medidas'
import { ROBOTS } from '@/lib/interfaz/identidad'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

const VACIA = { robot: 'rvr-01', que: '', robotValor: '', personaValor: '', unidad: 'cm', nota: '' }

function numero(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function PanelCuaderno() {
  const [medidas, setMedidas] = useState<Medida[]>([])
  const [f, setF] = useState(VACIA)

  /*
   * 🔴 Arranca VACIO y carga en un efecto: el servidor no tiene
   *    `localStorage`, y leerlo durante el render daria un HTML distinto del
   *    del cliente. React abortaria la hidratacion sin avisar de nada.
   */
  useEffect(() => {
    try {
      setMedidas(leerMedidas(window.localStorage.getItem(CLAVE_CUADERNO)))
    } catch { /* modo privado, cuota, politica del navegador */ }
  }, [])

  const guardar = useCallback((nuevas: Medida[]) => {
    setMedidas(nuevas)
    try {
      window.localStorage.setItem(CLAVE_CUADERNO, JSON.stringify(nuevas))
    } catch { /* ver arriba */ }
  }, [])

  const anotar = () => {
    if (f.que.trim() === '') return
    guardar([...medidas, {
      id: `${Date.now()}-${medidas.length}`,
      cuando: Date.now(),
      robot: f.robot,
      que: f.que.trim(),
      robotValor: numero(f.robotValor),
      personaValor: numero(f.personaValor),
      unidad: f.unidad.trim() || 'cm',
      nota: f.nota.trim(),
    }])
    setF({ ...VACIA, robot: f.robot, unidad: f.unidad })
  }

  const csv = useMemo(() => aCSV(medidas), [medidas])
  const descargar = () => {
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const u = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = u
    a.download = 'cuaderno-atriz.csv'
    a.click()
    URL.revokeObjectURL(u)
  }

  const campo = 'focus-ring w-full rounded-md border border-[rgb(var(--filo)/0.12)] '
    + 'bg-[rgb(var(--vidrio)/0.05)] px-3 py-2 text-sm placeholder:text-muted-foreground/60'

  return (
    <div className="relative min-h-screen">
      <div className="luz-ambiente" aria-hidden="true" />
      <main className="relative z-10 mx-auto max-w-5xl space-y-5 px-6 pb-16 pt-14">
        <header>
          <h1
            className="bg-gradient-to-b from-white to-[#A8B0C8] bg-clip-text font-semibold leading-[0.94] tracking-[-0.05em] text-transparent"
            style={{ fontSize: 'clamp(2.25rem, 5.4vw, 3.75rem)' }}
          >
            Cuaderno<br />de medidas
          </h1>
          <p className="mt-4 max-w-[56ch] text-base leading-relaxed text-muted-foreground">
            Lo que dijo el robot, al lado de lo que mediste con la cinta. La resta la hace la
            página; <strong className="text-foreground/85">si una medida está bien o no, lo
            decides tú</strong> — aquí no hay tolerancias inventadas.
          </p>
        </header>

        {/*
          🔴 EL AVISO DE ALMACENAMIENTO VA ARRIBA Y SIEMPRE VISIBLE.
          Un alumno que crea que sus medidas están «en la nube» las perderá al
          cambiar de portátil, y eso es una práctica entera tirada.
        */}
        <p className="rounded-ficha border border-warning/40 bg-warning/[0.08] px-5 py-3.5 text-sm leading-relaxed text-muted-foreground">
          {AVISO_ALMACENAMIENTO}
        </p>

        <Tarjeta titulo="Anotar una medida">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-6">
            <label className="lg:col-span-1">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">robot</span>
              <select
                className={campo}
                value={f.robot}
                onChange={(e) => setF({ ...f, robot: e.target.value })}
              >
                {ROBOTS.map((n) => {
                  const r = `rvr-${String(n).padStart(2, '0')}`
                  return <option key={r} value={r}>{r}</option>
                })}
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">qué mediste</span>
              <input
                className={campo} value={f.que} placeholder="avance de 30 cm"
                onChange={(e) => setF({ ...f, que: e.target.value })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">dijo el robot</span>
              <input
                className={`${campo} font-mono`} value={f.robotValor} inputMode="decimal" placeholder="30,2"
                onChange={(e) => setF({ ...f, robotValor: e.target.value })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">mediste tú</span>
              <input
                className={`${campo} font-mono`} value={f.personaValor} inputMode="decimal" placeholder="30"
                onChange={(e) => setF({ ...f, personaValor: e.target.value })}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">unidad</span>
              <input
                className={campo} value={f.unidad}
                onChange={(e) => setF({ ...f, unidad: e.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[rgb(var(--filo)/0.09)] px-5 py-3.5">
            <button
              type="button"
              onClick={anotar}
              disabled={f.que.trim() === ''}
              className="pulsable focus-ring rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anotar
            </button>
            <span className="text-xs text-muted-foreground">
              Puedes dejar un lado vacío y completarlo después.
            </span>
          </div>
        </Tarjeta>

        <Tarjeta
          titulo={medidas.length === 0 ? 'Todavía no hay medidas' : `${medidas.length} medidas`}
          extremo={medidas.length > 0 ? (
            <button
              type="button" onClick={descargar}
              className="pulsable focus-ring rounded-full border border-[rgb(var(--filo)/0.16)] px-4 py-1.5 text-xs font-medium"
            >
              Exportar CSV
            </button>
          ) : undefined}
        >
          {medidas.length === 0 ? (
            /*
              El estado vacio de PRIMER USO, que no es lo mismo que «sin
              resultados» ni que «fallo». Dice como se llena.
            */
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Anota la primera arriba. La pareja que importa es{' '}
              <strong className="text-foreground/85">lo que dijo el robot</strong> junto a{' '}
              <strong className="text-foreground/85">lo que mediste tú</strong>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-medium">robot</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">qué</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">robot</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">tú</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">diferencia</th>
                    <th scope="col" className="px-5 py-2.5 font-medium"><span className="sr-only">quitar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--filo)/0.08)]">
                  {medidas.map((m) => {
                    const d = diferencia(m)
                    return (
                      <tr key={m.id}>
                        <td className="px-5 py-3 font-mono text-[13px] text-muted-foreground">{m.robot}</td>
                        <td className="px-3 py-3">{m.que}</td>
                        <td className="px-3 py-3 text-right font-mono">
                          {m.robotValor === null
                            ? <span className="text-muted-foreground" title="no se sabe">—</span>
                            : <>{m.robotValor}<span className="ml-1 text-[11px] text-muted-foreground">{m.unidad}</span></>}
                        </td>
                        <td className="px-3 py-3 text-right font-mono">
                          {m.personaValor === null
                            ? <span className="text-muted-foreground" title="no se sabe">—</span>
                            : <>{m.personaValor}<span className="ml-1 text-[11px] text-muted-foreground">{m.unidad}</span></>}
                        </td>
                        {/*
                          🔴 La diferencia NO se colorea. Sin una tolerancia
                             medida por práctica, un verde o un rojo aquí serían
                             un juicio que esta pantalla no puede emitir.
                        */}
                        <td className="px-3 py-3 text-right font-mono">
                          {d === null
                            ? <span className="text-muted-foreground" title="falta un lado">—</span>
                            : <>{d > 0 ? '+' : ''}{d.toFixed(2)}<span className="ml-1 text-[11px] text-muted-foreground">{m.unidad}</span></>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => guardar(medidas.filter((x) => x.id !== m.id))}
                            className="focus-ring rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            quitar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Tarjeta>
      </main>
    </div>
  )
}
