'use client'

/**
 * ENTRAR. La forma es la de `SIVE_App`, adaptada al tema de papel.
 *
 * De su `LoginPage.js` se toman: la tarjeta centrada con la marca y una línea
 * corta, el campo de contraseña con mostrar/ocultar, el botón que cambia de
 * texto y se desactiva mientras envía, y **la discriminación de errores por
 * estado HTTP** — 401, 423, 429 y «no hay servidor» dicen cuatro cosas
 * distintas, porque piden cuatro reacciones distintas.
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

import { useRouter } from 'next/navigation'
import { CSSProperties, FormEvent, useState } from 'react'
import { useSesion } from '@/hooks/ContextoSesion'
import { SIN_SERVIDOR, mensajeDeFallo } from '@/lib/sesion/entrada'
import { Aviso } from '@/componentes/ui/Aviso'
import { CampoContrasena } from './CampoContrasena'

export function PanelEntrar() {
  const router = useRouter()
  const { usuario: yaDentro, refrescar } = useSesion()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const tono = { '--tono-seccion': 'var(--seccion-sesion)' } as CSSProperties

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
    } catch {
      setFallo(SIN_SERVIDOR)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative min-h-screen" style={tono}>
      <div className="luz-ambiente" aria-hidden="true" />

      <header className="campo-seccion relative z-10">
        <div className="relative mx-auto max-w-6xl px-4 pb-9 pt-7 sm:px-6">
          <p className="microetiqueta !text-white/85">Sesión del laboratorio</p>
          <h1
            className="mt-2 font-semibold leading-[0.95] tracking-[-0.035em]"
            style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)' }}
          >
            Entrar
          </h1>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto max-w-[27rem]">
          {yaDentro !== null ? (
            <Aviso nivel="NOTA" titulo={`Ya has entrado como ${yaDentro}`}>
              Puedes liberar una parada de emergencia y dar de alta a otras personas. Para cambiar
              de cuenta, sal primero desde el pie del raíl.
            </Aviso>
          ) : (
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
                  className="pulsable focus-ring w-full rounded-md border border-transparent bg-[rgb(var(--seccion-sesion))] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[rgb(var(--filo)/0.16)] disabled:bg-transparent disabled:text-muted-foreground"
                >
                  {enviando ? 'Entrando…' : 'Entrar'}
                </button>
              </div>
            </form>
          )}

          {/*
            ═══════════════════════════════════════════════════════════════════
            🔴 LA FRASE QUE HACE HONESTA ESTA PANTALLA, y por eso no es letra
               pequeña ni se puede cerrar.
            ═══════════════════════════════════════════════════════════════════
            Sin ella, una pantalla de acceso da a entender que hay control de
            acceso. Aquí lo hay sobre la INTERFAZ y no sobre el robot, y la
            diferencia es enorme: el navegador habla directamente con el
            rosbridge de cada robot, y ese camino no pasa por este servidor.
          */}
          <div className="mt-5">
            <Aviso nivel="ATENCION" titulo="Qué protege esta sesión">
              Identifica a quien usa <strong>esta interfaz</strong>, y es lo que evita que se
              libere una parada por curiosidad o por error. Desde el 15 de agosto de 2026 también{' '}
              <strong>abre el robot</strong>: al entrar, este servidor te firma una credencial para
              ese robot en concreto, y el robot la comprueba. Sin ella te cierra la puerta, y una
              credencial del robot 2 no abre el 1.{' '}
              <strong>Lo que todavía no protege</strong>: lo que viaja va{' '}
              <strong>sin cifrar</strong>, así que alguien en la misma red puede leer la
              telemetría aunque no pueda conducir. Y quien ejecute código{' '}
              <em>dentro</em> del robot desde el Taller tiene más permisos que esta pantalla.
            </Aviso>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            Las cuentas las crea quien ya tiene una, desde <strong>Usuarios</strong>. La primera se
            crea en la máquina que sirve la aplicación con{' '}
            <code>node herramientas/crear-cuenta.mjs</code>. No hay registro abierto: en la red de
            un aula, la primera cuenta se la quedaría quien llegara antes.
          </p>
        </div>
      </main>
    </div>
  )
}
