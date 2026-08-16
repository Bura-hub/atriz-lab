import { redirect } from 'next/navigation'

export const metadata = { title: 'Entrar · Plataforma Atriz' }

/**
 * `/entrar` YA NO ES UNA PANTALLA: LLEVA A LA PORTADA, QUE AHORA LAS ES LAS DOS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 FUSIONADA CON `/` EL 2026-08-16, por decisión del usuario
 * ═══════════════════════════════════════════════════════════════════════════
 * Eran **dos páginas para una sola cosa**: la portada explicaba el laboratorio y
 * ofrecía un botón que llevaba aquí a escribir dos campos. Ahora la portada trae
 * la presentación y el formulario, uno al lado del otro.
 *
 * 🔴 LA RUTA SE CONSERVA, Y NO ES POR NOSTALGIA. Hay tres clases de enlace
 *    apuntando aquí que no se pueden cambiar de golpe:
 *      · marcadores y URLs que alguien haya guardado o escrito en un guion;
 *      · el `enlace: '/entrar'` que `evaluarPrecondicion` mete en el aviso de
 *        «no has iniciado sesión», que se pinta en el muro y en cada robot;
 *      · el `?volver=` que fabrican el middleware y el layout privado.
 *    Romperlos daría un 404 a quien intenta entrar, que es el peor momento.
 *
 * ⚠️ Y CONSERVA EL `?volver=` TAL CUAL, sin validarlo aquí: quien lo valida es
 *    `destinoSeguro()` en el formulario, **en el instante de navegar**. Validar
 *    dos veces en dos sitios distintos es cómo acaban discrepando; y validar
 *    aquí y no allí dejaría el agujero abierto para quien llegue por `/`.
 *
 * 📝 Redirección de servidor, no un `<meta refresh>` ni un `useEffect`: no se
 *    manda ni un byte de página intermedia, así que no hay parpadeo.
 */
export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const volver = unaCadena((await searchParams).volver)
  redirect(volver === null ? '/' : `/?volver=${encodeURIComponent(volver)}`)
}

/**
 * Un parámetro de consulta puede llegar repetido (`?volver=a&volver=b`), y
 * entonces Next entrega un array. Se queda con el primero.
 *
 * 🔴 NO se junta el array: el destino es UNA ruta, y pasar «/a,/b» sería
 *    inventar un sitio que nadie pidió. Ante lo inesperado, `null` — y entonces
 *    manda el destino por defecto.
 */
function unaCadena(v: string | string[] | undefined): string | null {
  if (typeof v === 'string') return v
  return Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null
}
