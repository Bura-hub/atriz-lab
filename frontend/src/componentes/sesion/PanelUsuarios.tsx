'use client'

/**
 * ADMINISTRAR LAS CUENTAS: alta, alta por lote, rol, reseteo y baja.
 *
 * 🔴 AQUÍ PONÍA «SIN BORRAR NI EDITAR», y el motivo era bueno: *«con una
 *    plantilla que cambia una vez por semestre, un formulario de borrado es
 *    superficie que mantener sin nadie a quien servir»*. **Era cierto con tres
 *    cuentas de personal.**
 *
 *    Desde la Fase B (2026-08-15) los dieciséis alumnos **necesitan cuenta**: sin
 *    sesión no se abre un socket con ningún robot. La plantilla pasó de tres a
 *    diecinueve y cambia **cada semestre entero**. El hueco declarado dejó de ser
 *    barato en el momento en que dar de baja pasó de «una vez al año» a «dieciséis
 *    veces cada seis meses».
 *
 * 📝 La lección, que es la de siempre aquí: **una decisión correcta se apoya en un
 *    hecho, y el hecho puede caducar.** Lo que había que revisar no era el
 *    razonamiento — era su premisa.
 */

import { CSSProperties, FormEvent, useCallback, useEffect, useState } from 'react'
import { useSesion } from '@/hooks/ContextoSesion'
/*
 * 🔴 DE `reglas`, NO DE `credenciales`. El segundo importa `node:crypto` en su
 *    primera línea y este es un componente de cliente: bastaba con nombrarlo
 *    para romper el build del navegador. Las reglas viven aparte justo por esto.
 */
import { MINIMO_CONTRASENA, revisarAlta, type Rol } from '@/lib/sesion/reglas'
import { SIN_SERVIDOR } from '@/lib/sesion/entrada'
import { Aviso } from '@/componentes/ui/Aviso'
import { CampoContrasena } from './CampoContrasena'
import { AltaPorLote } from './AltaPorLote'
import { AccionesDeCuenta } from './AccionesDeCuenta'

interface CuentaVisible {
  usuario: string
  creada: number
  rol: Rol
}

/** Fecha corta y local. La hora no aporta nada para «cuándo se dio de alta». */
function fecha(ms: number): string {
  return new Date(ms).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function PanelUsuarios() {
  const { usuario: yo, cargando } = useSesion()
  const [cuentas, setCuentas] = useState<CuentaVisible[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  const tono = { '--tono-seccion': 'var(--seccion-sesion)' } as CSSProperties

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/sesion/usuarios')
      if (!r.ok) { setCuentas(null); return }
      const d = (await r.json()) as { cuentas: CuentaVisible[] }
      setCuentas(d.cuentas)
    } catch {
      setCuentas(null)
    }
  }, [])

  useEffect(() => { if (yo !== null) void cargar() }, [yo, cargar])

  /*
   * La misma regla que el servidor, llamando a la MISMA función. Aquí sirve para
   * decir qué falla mientras se escribe; la que manda es la del endpoint, porque
   * a esa ruta se le puede llamar con `curl` sin pasar por esta pantalla.
   */
  const motivo = nombre === '' && contrasena === '' ? null : revisarAlta(nombre, contrasena)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setFallo(null)
    setHecho(null)
    try {
      const r = await fetch('/api/sesion/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: nombre, contrasena }),
      })
      const d = (await r.json().catch(() => ({}))) as { error?: string; usuario?: string }
      if (!r.ok) {
        // El servidor manda el motivo exacto en 409 y 422; el 401 no lo trae.
        setFallo(d.error ?? (r.status === 401
          ? 'Tu sesión ha caducado. Vuelve a entrar.'
          : `Respuesta inesperada del servidor (código ${r.status}).`))
        return
      }
      setHecho(`Cuenta «${d.usuario ?? nombre}» creada.`)
      setNombre('')
      setContrasena('')
      await cargar()
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
          <p className="microetiqueta !text-white/85">Cuentas del laboratorio</p>
          <h1
            className="mt-2 font-semibold leading-[0.95] tracking-[-0.035em]"
            style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)' }}
          >
            Usuarios
          </h1>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Comprobando la sesión…</p>
        ) : yo === null ? (
          <div className="max-w-[34rem]">
            <Aviso nivel="NOTA" titulo="Hace falta una sesión">
              Las cuentas solo las ve y las crea quien ya tiene una. Entra desde el raíl. Si aún no
              existe ninguna, se crea en la máquina que sirve la aplicación con{' '}
              <code>node herramientas/crear-cuenta.mjs</code>.
            </Aviso>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            {/* ─── Alta ─────────────────────────────────────────────────── */}
            <section>
              <h2 className="microetiqueta mb-3">dar de alta</h2>
              <form onSubmit={(e) => { void enviar(e) }} className="vidrio aparece rounded-ficha p-5">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="nuevo-usuario" className="microetiqueta mb-1.5 block">
                      nombre
                    </label>
                    <input
                      id="nuevo-usuario"
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      disabled={enviando}
                      autoComplete="off"
                      className="focus-ring w-full rounded-md border border-[rgb(var(--filo)/0.14)] bg-[rgb(var(--vidrio)/0.03)] px-3 py-2.5 font-mono text-[15px] disabled:opacity-60"
                    />
                  </div>

                  <CampoContrasena
                    valor={contrasena}
                    alCambiar={setContrasena}
                    etiqueta="contraseña"
                    autoComplete="new-password"
                    desactivado={enviando}
                    ayuda={`Al menos ${MINIMO_CONTRASENA} caracteres. Una frase larga vale más que un símbolo.`}
                  />

                  {motivo !== null && (
                    <p className="text-[13px] leading-relaxed text-[rgb(var(--estado-mirar))]">
                      {motivo}
                    </p>
                  )}
                  {fallo !== null && (
                    <Aviso nivel="ERROR" titulo="No se creó">{fallo}</Aviso>
                  )}
                  {hecho !== null && (
                    <Aviso nivel="NOTA" titulo="Hecho">{hecho}</Aviso>
                  )}

                  <button
                    type="submit"
                    disabled={enviando || motivo !== null || nombre === '' || contrasena === ''}
                    aria-busy={enviando}
                    className="pulsable focus-ring w-full rounded-md border border-transparent bg-[rgb(var(--seccion-sesion))] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[rgb(var(--filo)/0.16)] disabled:bg-transparent disabled:text-muted-foreground"
                  >
                    {enviando ? 'Creando…' : 'Crear cuenta'}
                  </button>
                </div>
              </form>

              {/*
                🔴 AQUÍ PONÍA «No hay dos niveles: hay sesión o no la hay». Falso
                   desde hoy. Y la otra mitad —«quien tenga cuenta puede liberar
                   una parada»— sigue siendo cierta, pero por una razón que ahora
                   hay que decir, porque ya NO es «no hay roles».
              */}
              <p className="mt-4 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                Hay <strong>dos clases de cuenta</strong>. Un <strong>alumno</strong> conduce, mide,
                programa y usa el cuaderno de su robot. Un <strong>profesor</strong> hace además todo
                lo de esta pantalla y arranca la navegación.
              </p>
              <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                <strong>Liberar una parada de emergencia lo puede cualquiera con sesión</strong>, no
                solo un profesor: liberar no pone el robot en marcha —está medido en el robot— y
                reservarlo dejaría un robot parado hasta que apareciera alguien.
              </p>

              {/* ─── Una clase entera ──────────────────────────────────── */}
              <div className="mt-8">
                <h2 className="microetiqueta mb-3">dar de alta a una clase</h2>
                <div className="vidrio rounded-ficha p-5">
                  <AltaPorLote alCrear={cargar} />
                </div>
              </div>
            </section>

            {/* ─── Quién hay ────────────────────────────────────────────── */}
            <section>
              <h2 className="microetiqueta mb-3">cuentas existentes</h2>
              {cuentas === null ? (
                <p className="text-sm text-muted-foreground">No se pudo leer la lista.</p>
              ) : (
                <div className="vidrio aparece overflow-hidden rounded-ficha">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--filo)/0.12)]">
                        <th scope="col" className="microetiqueta px-4 py-3 font-normal">usuario</th>
                        <th scope="col" className="microetiqueta px-4 py-3 font-normal">rol</th>
                        <th scope="col" className="microetiqueta px-4 py-3 font-normal">
                          dada de alta
                        </th>
                        <th scope="col" className="microetiqueta px-4 py-3 font-normal">
                          <span className="sr-only">acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cuentas.map((c) => (
                        <tr
                          key={c.usuario}
                          className="border-b border-[rgb(var(--filo)/0.08)] last:border-0"
                        >
                          <td className="px-4 py-3 font-mono text-[15px]">
                            {c.usuario}
                            {c.usuario === yo && (
                              <span className="ml-2 text-[12px] text-muted-foreground">(tú)</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {/*
                              🔴 El rol va como PALABRA, no como color ni icono.
                                 Es la regla del muro aplicada aquí: una de cada
                                 doce personas no distingue dos tonos, y esta
                                 tabla decide quién puede borrar cuentas.
                            */}
                            <span className="text-[13px]">
                              {c.rol === 'profesor' ? 'profesor' : 'alumno'}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {fecha(c.creada)}
                          </td>
                          <td className="px-4 py-3">
                            <AccionesDeCuenta
                              cuenta={c}
                              soyYo={c.usuario === yo}
                              esUltimoProfesor={
                                c.rol === 'profesor'
                                && cuentas.filter((x) => x.rol === 'profesor').length === 1
                              }
                              alCambiar={cargar}
                              alFallar={setFallo}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/*
                🔴 AQUÍ VIVÍA EL AVISO «no se puede dar de baja desde aquí», y era
                   correcto hasta hoy. Se sustituye por el límite que SÍ queda, que
                   es distinto y sigue siendo real.
              */}
              <div className="mt-5 max-w-prose">
                <Aviso nivel="NOTA" titulo="Siempre tiene que quedar un profesor">
                  No se puede borrar ni degradar al <strong>último profesor</strong>: la instalación
                  se quedaría sin nadie capaz de crear cuentas, y la única salida sería editar{' '}
                  <code>usuarios.json</code> a mano en la máquina que sirve la aplicación. Para
                  quitarte a ti mismo, asciende antes a otra persona.
                </Aviso>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
