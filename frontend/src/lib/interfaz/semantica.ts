/**
 * LA SEMANTICA QUE LA INTERFAZ TIENE QUE EMITIR. PURO: sin React y sin red.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POR QUE ESTO ES UNA PRUEBA Y NO UN ACUERDO
 * ═══════════════════════════════════════════════════════════════════════════
 * `Dato` emite `<data value="7.42">` cuando hay valor, y **no emite el elemento**
 * cuando no lo hay. Esa asimetria es la regla central del proyecto convertida en
 * estructura del DOM: «no se sabe» deja de ser un estilo en gris y pasa a ser
 * algo comprobable por script y distinguible por un lector de pantalla.
 *
 * 🔴 Pero una decision asi dura exactamente hasta que alguien «simplifica» el
 *    componente y pone `value=""` para que las dos ramas sean iguales. Un
 *    `<data value="">` es lo PEOR de las dos opciones: afirma que hay un valor
 *    legible por maquina, y no lo hay.
 *
 * Estas funciones trabajan sobre el HTML SERVIDO, asi que se pueden usar sin
 * `jsdom` -que este repositorio no instala- contra lo que devuelve el servidor.
 */

/** Un `<data>` encontrado en el HTML, con su atributo y su texto. */
export interface Marca {
  value: string
  texto: string
}

/**
 * Saca los `<data …>` de un HTML.
 *
 * ⚠️ Es un analisis por expresion regular, no un parser: vale para comprobar lo
 * que ESTA aplicacion emite -marcado propio, generado por React, sin `<data>`
 * anidados ni atributos con `>` dentro- y **no serviria para HTML arbitrario**.
 * Se dice aqui para que nadie lo reutilice creyendo otra cosa.
 */
export function marcasDe(html: string): Marca[] {
  const salida: Marca[] = []
  for (const m of html.matchAll(/<data\b([^>]*)>([\s\S]*?)<\/data>/g)) {
    const value = m[1].match(/\bvalue\s*=\s*"([^"]*)"/)
    salida.push({ value: value === null ? '' : value[1], texto: sinEtiquetas(m[2]) })
  }
  return salida
}

/** El texto de un fragmento, sin etiquetas ni entidades comunes. */
export function sinEtiquetas(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/**
 * 🔴 LO QUE NUNCA PUEDE PASAR: un `<data>` que no afirma nada.
 *
 * Devuelve las marcas defectuosas, cada una con su motivo. Vacio = bien.
 *
 * Los tres casos son la misma equivocacion vista de tres formas:
 *   · `value` vacio        — dice «tengo un dato legible por maquina» y no lo tiene
 *   · `value` no numerico  — `NaN`, `undefined` o `null` colados como texto
 *   · texto de «no se sabe» dentro de un `<data>` — la contradiccion directa
 */
export function marcasDefectuosas(marcas: readonly Marca[], sinDato: string): string[] {
  const fallos: string[] = []
  for (const m of marcas) {
    if (m.value.trim() === '') {
      fallos.push(`<data> sin value, con texto «${m.texto}»: afirma un dato que no existe`)
    } else if (!Number.isFinite(Number(m.value))) {
      fallos.push(`<data value="${m.value}"> no es un numero: probablemente NaN o undefined colado`)
    }
    if (m.texto.includes(sinDato)) {
      fallos.push(`<data> envolviendo «${sinDato}»: «no se sabe» NO puede ir dentro de un <data>`)
    }
  }
  return fallos
}
