'use client'

/**
 * DONDE BUSCAR A CADA ROBOT. El override de direccion del muro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE EXISTE — y no es una preferencia, es un fallo medido
 * ═══════════════════════════════════════════════════════════════════════════
 * `rvr-NN.local` resuelve a CUATRO direcciones y el navegador prueba las dos
 * peores primero. Ninguna falla: **se cuelgan**. Medido el 2026-08-04 con el
 * robot encendido y sano — 12 s sin `onopen`, sin `onerror` y sin `onclose`.
 * El detalle completo esta en `lib/interfaz/direcciones.ts`.
 *
 * JavaScript no puede enumerar lo que resolvio un nombre ni elegir direccion:
 * no hay API. Asi que lo unico que puede hacer el cliente es dejar que una
 * persona lo diga.
 *
 * ⚠️ **Esto no descubre nada ni promete nada.** No escanea la red, no adivina y
 *    no comprueba que la direccion escrita responda: solo cambia a donde se
 *    marca. Si la baldosa sigue diciendo «no llego», la direccion tambien esta
 *    mal — y eso es informacion, no un fallo de este cuadro.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CLAVE_DIRECCIONES, Direcciones, conDireccion, cuantasPuestas, escribirDirecciones,
  leerDirecciones, validarDireccion,
} from '@/lib/interfaz/direcciones'
import { ROBOTS } from '@/lib/interfaz/identidad'

/**
 * Lee y escribe el override.
 *
 * 🔴 Arranca VACIO y carga en un efecto, a proposito: el servidor no tiene
 *    `localStorage`, asi que leerlo durante el render daria un HTML distinto
 *    del del cliente y React abortaria la hidratacion — la pantalla entera se
 *    volveria a pintar sin avisar de nada.
 */
export function useDirecciones() {
  const [direcciones, setDirecciones] = useState<Direcciones>({})
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    try {
      setDirecciones(leerDirecciones(window.localStorage.getItem(CLAVE_DIRECCIONES)))
    } catch {
      // localStorage puede lanzar (modo privado, cuota, politica del navegador).
      // Sin override el muro sigue funcionando por nombre: no hay nada que hacer.
    }
    setCargado(true)
  }, [])

  const poner = useCallback((id: number, texto: string) => {
    setDirecciones((antes) => {
      const nuevas = conDireccion(antes, id, texto)
      try {
        window.localStorage.setItem(CLAVE_DIRECCIONES, escribirDirecciones(nuevas))
      } catch { /* ver arriba */ }
      return nuevas
    })
  }, [])

  return { direcciones, poner, cargado }
}

function Fila({ id, valor, poner }: {
  id: number
  valor: string
  poner: (id: number, texto: string) => void
}) {
  const [texto, setTexto] = useState(valor)
  // Si otra fila cambia el mapa, esta no debe perder lo que se esta escribiendo:
  // solo se resincroniza cuando cambia SU valor guardado.
  useEffect(() => { setTexto(valor) }, [valor])

  const r = validarDireccion(texto)
  const invalido = texto.trim() !== '' && !r.ok

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <label className="w-16 shrink-0 font-mono text-xs text-muted-foreground" htmlFor={`dir-${id}`}>
        rvr-{String(id).padStart(2, '0')}
      </label>
      <input
        id={`dir-${id}`}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => poner(id, texto)}
        onKeyDown={(e) => { if (e.key === 'Enter') poner(id, texto) }}
        placeholder="rvr-NN.local"
        className={`focus-ring w-56 border bg-input px-2 py-1 font-mono text-xs ${
          invalido ? 'border-[rgb(var(--estado-ir))]' : 'border-border'
        }`}
      />
      <span className="text-[11px] text-muted-foreground">
        {invalido && r.ok === false
          ? r.motivo
          : texto.trim() === ''
            ? 'por nombre'
            : 'se guarda al salir del campo'}
      </span>
    </div>
  )
}

export function DondeBuscar({ direcciones, poner }: {
  direcciones: Direcciones
  poner: (id: number, texto: string) => void
}) {
  const puestas = cuantasPuestas(direcciones)

  return (
    <details className="group border border-border bg-card">
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-90"
        >
          ▸
        </span>
        Dónde buscar a los robots
        <span className="font-mono">
          {puestas === 0 ? 'todos por nombre' : `${puestas} con dirección puesta`}
        </span>
      </summary>

      <div className="border-t border-border">
        <p className="max-w-prose px-3 py-2 text-xs leading-snug text-muted-foreground">
          Por defecto cada baldosa busca <code>rvr-NN.local</code>. Ese nombre puede resolver a
          varias direcciones, y el navegador prueba primero las que no sirven desde esta red:
          no dan error, <strong>se quedan colgadas</strong>. Escribe aquí una IP y esa baldosa irá
          directa. Se guarda en este navegador.
        </p>
        <div className="max-h-64 overflow-y-auto border-t border-border">
          {ROBOTS.map((id) => (
            <Fila key={id} id={id} valor={direcciones[String(id)] ?? ''} poner={poner} />
          ))}
        </div>
      </div>
    </details>
  )
}
