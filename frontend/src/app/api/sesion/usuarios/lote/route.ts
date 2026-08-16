/**
 * DAR DE ALTA A UNA CLASE ENTERA, de una vez.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LAS CONTRASEÑAS SALEN EN CLARO **UNA SOLA VEZ**, Y NUNCA MAS
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se guarda es el hash (`scrypt` con sal por cuenta), asi que **nadie
 * puede volver a consultarlas**: ni el profesor, ni esta ruta, ni nadie con
 * acceso al fichero. Esta respuesta es la unica vez que existen legibles.
 *
 * → Por eso `Cache-Control: no-store`, y por eso la pantalla lo advierte ANTES
 *   de generar nada. Y por eso el reseteo existe en la misma pantalla: sin el,
 *   esto seria una trampa — quien pierda el papel se queda fuera para siempre.
 *
 * 🔴 EL AZAR VIENE DE `node:crypto`, no de `Math.random`. `lote.ts` es puro y
 *    EXIGE que se le pase el generador precisamente para que esta decision sea
 *    visible aqui: una contraseña generada con un generador predecible es una
 *    contraseña que no protege, y ese fichero no puede saber cual le pasan.
 *
 * ⚠️ SE ESCRIBE UNA SOLA VEZ, al final. Guardar cuenta a cuenta dejaria la clase
 *    partida en dos si algo falla a la mitad —unos con cuenta y otros no— sin
 *    forma de saber donde se corto. Hashear dieciseis contraseñas con `scrypt`
 *    tarda, y ese es justo el rato en el que algo puede interrumpirse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'node:crypto'
import { frase, planDeLote, type Alta } from '@/lib/sesion/lote'
import { hashear } from '@/lib/sesion/credenciales'
import { esProfesor, type Cuenta } from '@/lib/sesion/reglas'
import { guardarCuentas, leerCuentas } from '@/lib/sesion/almacen'
import { cuentaDeSesion, noAutorizado, noLlega, sesionDe } from '@/lib/sesion/peticion'

export async function POST(pet: NextRequest) {
  if (sesionDe(pet) === null) return noAutorizado()
  const quien = await cuentaDeSesion(pet)
  if (!esProfesor(quien)) return noLlega('Solo un profesor puede dar de alta a una clase.')

  let cuerpo: { prefijo?: unknown; desde?: unknown; hasta?: unknown }
  try {
    cuerpo = await pet.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo ilegible.' }, { status: 400 })
  }
  if (typeof cuerpo.prefijo !== 'string'
    || typeof cuerpo.desde !== 'number' || typeof cuerpo.hasta !== 'number') {
    return NextResponse.json(
      { error: 'Hacen falta un prefijo y un rango de numeros.' }, { status: 400 },
    )
  }

  const cuentas = await leerCuentas()
  const plan = planDeLote({
    prefijo: cuerpo.prefijo,
    desde: cuerpo.desde,
    hasta: cuerpo.hasta,
    existentes: cuentas.map((c) => c.usuario),
  })
  if (plan.error !== null) return NextResponse.json({ error: plan.error }, { status: 422 })

  /*
   * ⚠️ Cero cuentas nuevas NO es un error: es lo que pasa cuando ya existen
   *    todas, y quien lo pide tiene que poder verlo sin que parezca que fallo
   *    algo. Se contesta 200 con la lista de choques y ninguna creada.
   */
  if (plan.nuevas.length === 0) {
    return NextResponse.json({ creadas: [], choques: plan.choques })
  }

  const creadas: Alta[] = []
  const nuevas: Cuenta[] = []
  for (const usuario of plan.nuevas) {
    const contrasena = frase((tope) => randomInt(tope))
    creadas.push({ usuario, contrasena })
    nuevas.push({ usuario, clave: await hashear(contrasena), creada: Date.now(), rol: 'alumno' })
  }

  await guardarCuentas([...cuentas, ...nuevas])

  return NextResponse.json(
    { creadas, choques: plan.choques },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
