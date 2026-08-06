/**
 * QUIÉN SOY. Lo que la interfaz pregunta al cargar para saber si enseñar lo
 * que solo se ve con sesión.
 *
 * 🔴 Y ES EL SERVIDOR QUIEN CONTESTA, releyendo el testigo firmado. La pantalla
 *    no puede decidirlo sola: la cookie es `httpOnly`, así que el navegador ni
 *    siquiera puede leerla. Eso es lo que impide ponerse una sesión a mano.
 */

import { NextRequest, NextResponse } from 'next/server'
import { noAutorizado, sesionDe } from '@/lib/sesion/peticion'

export function GET(pet: NextRequest) {
  const usuario = sesionDe(pet)
  if (usuario === null) return noAutorizado()
  return NextResponse.json({ usuario })
}
