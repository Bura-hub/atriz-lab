'use client'

/**
 * Un campo de contraseña con el botón de mostrar y ocultar.
 *
 * 📝 Tomado de `SIVE_App/frontend/src/components/LoginPage.js`, que alterna
 *    `type` entre `password` y `text` con un botón de `aria-label` cambiante.
 *    Se comparte entre `/entrar` y `/usuarios` porque es el mismo gesto: quien
 *    da de alta a un monitor necesita ver lo que teclea igual que quien entra.
 *
 * ⚠️ Los iconos van DIBUJADOS, como el resto de `Iconos.tsx`. Este proyecto no
 *    tiene librería de iconos ni la va a tener: cada glifo es un `path`.
 */

import { useId, useState } from 'react'

export interface PropsCampoContrasena {
  valor: string
  alCambiar: (v: string) => void
  etiqueta: string
  /** `current-password` al entrar, `new-password` al dar de alta. */
  autoComplete: 'current-password' | 'new-password'
  desactivado?: boolean
  /** Se pinta bajo el campo, en pequeño. Para la regla de longitud. */
  ayuda?: string
}

export function CampoContrasena({
  valor, alCambiar, etiqueta, autoComplete, desactivado = false, ayuda,
}: PropsCampoContrasena) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const idAyuda = `${id}-ayuda`

  return (
    <div>
      <label htmlFor={id} className="microetiqueta mb-1.5 block">{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          disabled={desactivado}
          autoComplete={autoComplete}
          aria-describedby={ayuda === undefined ? undefined : idAyuda}
          className="focus-ring w-full rounded-md border border-[rgb(var(--filo)/0.14)] bg-[rgb(var(--vidrio)/0.03)] px-3 py-2.5 pr-11 font-mono text-[15px] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          /*
            🔴 El `aria-label` dice lo que el botón VA A HACER, no en qué estado
               está. Quien usa un lector de pantalla no ve el ojo tachado: oye
               la etiqueta, y «contraseña oculta» no le dice qué pasa al pulsar.
          */
          aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          className="focus-ring absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors duration-[var(--t-estado)] hover:text-foreground"
        >
          <svg
            viewBox="0 0 24 24" width="18" height="18" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true"
          >
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 20 20 4" />}
          </svg>
        </button>
      </div>
      {ayuda !== undefined && (
        <p id={idAyuda} className="mt-1.5 text-[13px] text-muted-foreground">{ayuda}</p>
      )}
    </div>
  )
}
