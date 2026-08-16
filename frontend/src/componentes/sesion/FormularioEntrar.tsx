'use client'

/**
 * EL FORMULARIO DE ENTRAR — solo la tarjeta, sin carcasa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ SE SEPARÓ DE `PanelEntrar` (2026-08-16)
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 El usuario pidió fundir `/` y `/entrar` en una sola pantalla, y tiene
 *    razón: para quien no ha entrado eran **dos páginas para una sola cosa**.
 *    La portada explicaba qué es esto y ofrecía un botón que llevaba a otra
 *    página a escribir dos campos — un salto entero para un formulario de
 *    quince segundos.
 *
 * `PanelEntrar` montaba su propia carcasa: `min-h-screen`, luz ambiente y una
 * banda de sección con el título «Entrar». Eso no cabe **dentro** de la portada,
 * que ya tiene su banda. Así que el formulario se saca aquí y la carcasa la pone
 * la página, que es de quien es.
 *
 * ⚠️ Y NO se toca nada de lo que hace: los mismos estados, la misma
 *    discriminación de errores por código HTTP, el mismo `?volver=` validado.
 *    Lo único que cambia es quién dibuja el marco.
 *
 * De `SIVE_App` se conservan: el campo de contraseña con mostrar/ocultar, el
 * botón que cambia de texto y se desactiva mientras envía, y **la
 * discriminación de errores por estado HTTP** — 401, 423, 429 y «no hay
 * servidor» dicen cuatro cosas distintas porque piden cuatro reacciones
 * distintas.
 *
 * Lo que NO se copia:
 *   · El **spinner**. Es `animation: … infinite`, y la guardia de `estilo.ts` lo
 *     prohíbe con un motivo que aquí aplica entero: sobre una pantalla que
 *     espera, un bucle perpetuo es indistinguible de una que se colgó. El botón
 *     dice «Entrando…», se desactiva y lleva `aria-busy`. Dice lo mismo.
 *   · El **contador de intentos en `localStorage`**. El nuestro vive en el
 *     servidor: uno que el navegador puede poner a cero no cuenta nada.
 *   · El **registro de cuentas abierto**. La primera se crea con
 *     `herramientas/crear-cuenta.mjs`, desde la máquina que sirve la aplicación.
 */

import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { useSesion } from '@/hooks/ContextoSesion'
import { SIN_SERVIDOR, mensajeDeFallo } from '@/lib/sesion/entrada'
import { destinoSeguro } from '@/lib/sesion/regreso'
import { Aviso } from '@/componentes/ui/Aviso'
import { CampoContrasena } from './CampoContrasena'

export function FormularioEntrar() {
  const router = useRouter()
  const parametros = useSearchParams()
  const { refrescar } = useSesion()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setFallo(null)
    try {
      const r = await fetch('/api/sesion/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, contrasena }),
      })
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { segundos?: number }
        setFallo(mensajeDeFallo({ estado: r.status, segundos: d.segundos }))
        return
      }
      setContrasena('')
      await refrescar()
      /*
       * 🔴 `refresh()` ADEMÁS de navegar. Sin él, Next puede servir la ruta
       *    desde su caché de cliente: el raíl no volvería a pintarse, seguiría
       *    diciendo «Entrar» y la entrada de `/usuarios` no aparecería. Sería un
       *    inicio de sesión con éxito y sin efecto visible — el modo de fallo
       *    favorito de este proyecto.
       */
      router.refresh()

      /*
       * ── Y SE VUELVE A DONDE IBA ───────────────────────────────────────────
       *
       * 🔴 `replace` y no `push`: con `push`, la flecha de «atrás» del navegador
       *    devuelve a la pantalla de entrar **ya con sesión**, y ahí no hay nada
       *    que hacer — parece que te ha echado.
       *
       * 🔴 Y el destino pasa por `destinoSeguro`, SIEMPRE. Un `?volver=` sin
       *    validar es una redirección abierta: la persona ve el dominio de su
       *    laboratorio, escribe su contraseña de verdad, y acaba en otro sitio ya
       *    autenticada. Es de los pocos agujeros que se explotan sin tocar el
       *    servidor.
       */
      router.replace(destinoSeguro(parametros.get('volver')))
    } catch {
      setFallo(SIN_SERVIDOR)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={(e) => { void enviar(e) }} className="vidrio aparece rounded-ficha p-6 sm:p-7">
      <div className="space-y-4">
        <div>
          <label htmlFor="usuario" className="microetiqueta mb-1.5 block">usuario</label>
          <input
            id="usuario"
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            disabled={enviando}
            autoComplete="username"
            autoFocus
            className="focus-ring w-full rounded-md border border-[rgb(var(--filo)/0.14)] bg-[rgb(var(--vidrio)/0.03)] px-3 py-2.5 font-mono text-[15px] disabled:opacity-60"
          />
        </div>

        <CampoContrasena
          valor={contrasena}
          alCambiar={setContrasena}
          etiqueta="contraseña"
          autoComplete="current-password"
          desactivado={enviando}
        />

        {fallo !== null && (
          <Aviso nivel="ERROR" titulo="No se pudo entrar">{fallo}</Aviso>
        )}

        <button
          type="submit"
          disabled={enviando || usuario.trim() === '' || contrasena === ''}
          aria-busy={enviando}
          className="pulsable focus-ring w-full rounded-none border border-transparent bg-[rgb(var(--seccion-sesion))] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[rgb(var(--filo)/0.16)] disabled:bg-transparent disabled:text-muted-foreground"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </form>
  )
}
