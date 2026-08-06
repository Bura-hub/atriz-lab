/**
 * LAS CUENTAS: listarlas y crear una. **No hay borrar ni editar.**
 *
 * 📝 Es lo que se pidió, y el hueco se declara en la pantalla en vez de dejar un
 *    botón que no existe: dar de baja se hace a mano en `usuarios.json`. Con una
 *    plantilla de personal que cambia una vez por semestre, un formulario de
 *    borrado es superficie que mantener sin nadie a quien servir.
 *
 * 🔴 SIN SESIÓN NO SE PUEDE NI LISTAR. La lista de nombres de quien puede
 *    liberar una parada es justo lo que se le da a quien quiere adivinar una
 *    contraseña.
 */

import { NextRequest, NextResponse } from 'next/server'
import { hashear } from '@/lib/sesion/credenciales'
import { normalizar, revisarAlta } from '@/lib/sesion/reglas'
import { guardarCuentas, leerCuentas } from '@/lib/sesion/almacen'
import { noAutorizado, sesionDe } from '@/lib/sesion/peticion'

export async function GET(pet: NextRequest) {
  if (sesionDe(pet) === null) return noAutorizado()
  const cuentas = await leerCuentas()
  // 🔴 `clave` NO sale de aquí. Es un hash, no una contraseña, pero mandarlo al
  //    navegador lo pone a tiro de un ataque sin conexión y no sirve para nada.
  return NextResponse.json({
    cuentas: cuentas.map((c) => ({ usuario: c.usuario, creada: c.creada })),
  })
}

export async function POST(pet: NextRequest) {
  if (sesionDe(pet) === null) return noAutorizado()

  let cuerpo: { usuario?: unknown; contrasena?: unknown }
  try {
    cuerpo = await pet.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo ilegible.' }, { status: 400 })
  }
  if (typeof cuerpo.usuario !== 'string' || typeof cuerpo.contrasena !== 'string') {
    return NextResponse.json({ error: 'Hacen falta usuario y contraseña.' }, { status: 400 })
  }

  /*
   * 🔴 LAS MISMAS REGLAS QUE EN EL NAVEGADOR, otra vez aquí. No es duplicar por
   *    duplicar: la validación de la pantalla es comodidad —dice qué falla
   *    mientras se escribe— y esta es la que manda, porque a esta ruta se le
   *    puede llamar con `curl` sin pasar por ninguna pantalla. Las dos llaman a
   *    `revisarAlta`, así que la regla vive en un solo sitio.
   */
  const motivo = revisarAlta(cuerpo.usuario, cuerpo.contrasena)
  if (motivo !== null) return NextResponse.json({ error: motivo }, { status: 422 })

  const usuario = normalizar(cuerpo.usuario)
  const cuentas = await leerCuentas()
  if (cuentas.some((c) => c.usuario === usuario)) {
    return NextResponse.json({ error: `Ya existe una cuenta «${usuario}».` }, { status: 409 })
  }

  await guardarCuentas([
    ...cuentas,
    { usuario, clave: await hashear(cuerpo.contrasena), creada: Date.now() },
  ])
  return NextResponse.json({ usuario }, { status: 201 })
}
