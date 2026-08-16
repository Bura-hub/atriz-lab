'use client'

/**
 * EL EDITOR DEL TALLER: un `<textarea>` transparente sobre un espejo de color.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE UN ESPEJO Y NO UN EDITOR DE VERDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * Dos razones, y las dos son duras:
 *
 *   1. **Cero dependencias nuevas** (`CLAUDE.md`). El propio `PanelTerminal` ya
 *      lo habia razonado: *«Monaco son ~5 MB para poner colores»*.
 *   2. `pantallas_reales.test.ts:187` exige `<textarea` en el HTML y que **no**
 *      este `disabled`. Un `contentEditable` rompe esa guardia, que existe para
 *      que nadie convierta el editor en una maqueta que no se puede escribir.
 *
 * Asi que el `<textarea>` se queda —con su cursor, su seleccion, su deshacer y
 * su accesibilidad, gratis— y el color lo pinta un `<pre>` identico DEBAJO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 LO QUE HACE QUE EL ESPEJO NO SE DESPEGUE
 * ═══════════════════════════════════════════════════════════════════════════
 * Si el `<pre>` y el `<textarea>` no maquetan **exactamente** igual, el color se
 * separa del texto y el desfase CRECE hacia abajo — es el fallo mas visible que
 * esto puede tener. Lo que lo impide, y cada punto cierra un desfase concreto:
 *
 *   · `tokenizar()` **conserva todos los caracteres**, saltos incluidos. Hay una
 *     prueba que lo comprueba sobre las 16 practicas reales del robot. Sin esa
 *     invariante nada de lo demas sirve.
 *   · Misma tipografia y mismo cuerpo (`font-mono text-[13px]`).
 *   · **`leading-[21px]` en pixeles, no `leading-relaxed`.** 1,625 sin unidad da
 *     21,125 px, y que un `<textarea>` y un `<pre>` redondeen igual no esta
 *     verificado. Fijarlo quita la duda; 21 px es 1,615, indistinguible.
 *   · Mismo relleno, y **el borde va en el envoltorio**, nunca en el `textarea`.
 *   · Mismo ajuste de linea (`pre-wrap` + `break-words`). Sin el corte de palabra
 *     larga, una palabra desborda en uno y se parte en el otro.
 *   · `[tab-size:4]` en los dos: el Tab de la interfaz escribe espacios, pero una
 *     practica leida del robot puede traer tabuladores literales.
 *   · Y el scroll se copia en `onScroll`, que hace falta porque el editor se
 *     puede redimensionar y el contenido pasar del alto.
 *
 * 🔴 `[scrollbar-gutter:stable]` EN LOS DOS, Y ESTO SE ENCONTRO MIDIENDO.
 *    El `<textarea>` saca barra de desplazamiento cuando el texto pasa del alto;
 *    el espejo es `overflow-hidden` y no la saca nunca. Sin reservar el hueco, el
 *    espejo es **15 px mas ancho**, asi que una linea larga ajusta en otra
 *    columna y el color se despega **desde ahi hacia abajo**. Medido en Edge
 *    headless sobre un fichero con lineas que ajustan:
 *
 *        sin reservar el hueco   alto 402 vs 381 (una linea de menos) · ancho 394 vs 409
 *        reservandolo            alto 402 vs 402 · ancho 394 vs 394
 *
 *    ⚠️ Es LATENTE: con las practicas cortas de hoy ninguna linea llega a
 *       ajustar, asi que los dos altos coincidian y parecia correcto. Lo destapo
 *       comparar el ANCHO, no el alto.
 *
 * ⚠️ NINGUNA PRUEBA PURA VE ESTO. No hay jsdom en este repositorio y ninguna
 *    prueba renderiza un componente: hace falta un navegador de verdad. Queda una
 *    casilla en `VALIDAR_CON_EL_ROBOT.md` para mirarlo con ojos, que es lo unico
 *    que juzga si ademas se LEE bien.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 EL MAPA DE COLOR VIVE AQUI, Y NO EN `lib/`
 * ═══════════════════════════════════════════════════════════════════════════
 * Tailwind solo escanea `src/componentes/**` y `src/app/**`: una clase nombrada
 * desde `src/lib/**` **no se compila** y saldria sin estilo, en silencio. Por eso
 * `resaltado.ts` devuelve TIPOS y el nombre de la clase se escribe aqui.
 */

import { useRef } from 'react'
import { tokenizar, type TipoToken } from '@/lib/taller/resaltado'

/**
 * De tipo de token a clase.
 *
 * 🔴 SON TRES TINTAS Y ES UN TECHO, con el razonamiento entero en `globals.css`:
 *    esta pantalla ya gasta color para decir si un robot esta vivo, asi que lo
 *    demas se separa con TIPOGRAFIA —cursiva y seminegrita—, que no gasta
 *    vocabulario de color.
 *
 * `Record` y no un objeto suelto: `tsc` obliga a que esten los ocho tipos, asi
 * que añadir uno a `TipoToken` sin darle clase no compila.
 */
/*
 * ═══════════════════════════════════════════════════════════════════════════
 * 👤 SEIS COLORES Y NO TRES, sobre la consola oscura (2026-08-16)
 * ═══════════════════════════════════════════════════════════════════════════
 * *«aplicando un estilo de colores para variables y toda la sintaxis de un
 * código como si fuera un IDE»*.
 *
 * Antes eran tres tintas y dos categorías compartían: `constante` iba con
 * `palabra_clave`, y `definicion` y `llamada` se separaban **solo con el peso de
 * la letra**. Ahora cada una tiene la suya, que es lo que hace un editor.
 *
 * 🔴 `normal` NO LLEVA CLASE, y es donde caen las variables: heredan la tinta de
 *    la consola. Un IDE tampoco colorea cada identificador — colorear todo es no
 *    colorear nada. Lo que se tiñe es lo que tiene un papel gramatical.
 *
 * 🔴 Y NINGUNO ES ROJO. Los seis están medidos sobre `--consola-fondo` y ninguno
 *    entra en la familia de `--destructive`, que es exclusivo de la parada de
 *    emergencia — y esta pantalla la tiene a la vista en el mismo raíl.
 */
const CLASE: Record<TipoToken, string> = {
  normal: '',
  comentario: 'italic text-[rgb(var(--consola-apagada))]',
  cadena: 'text-[rgb(var(--sintaxis-texto))]',
  numero: 'text-[rgb(var(--sintaxis-numero))]',
  palabra_clave: 'text-[rgb(var(--sintaxis-clave))]',
  constante: 'text-[rgb(var(--sintaxis-constante))]',
  definicion: 'font-semibold text-[rgb(var(--sintaxis-definicion))]',
  llamada: 'text-[rgb(var(--sintaxis-llamada))]',
}

/**
 * Lo que comparten el espejo y el `<textarea>`, en UNA sola cadena.
 *
 * 🔴 Es literalmente la razon de que no se despeguen: si estas clases se
 *    escribieran dos veces, alguien cambiaria una y no la otra.
 */
const MAQUETA = 'px-4 py-3 font-mono text-[13px] leading-[21px] [tab-size:4] '
  + 'whitespace-pre-wrap break-words [scrollbar-gutter:stable]'

export interface EditorPythonProps {
  codigo: string
  alCambiar: (codigo: string) => void
  /** Se pinta cuando el editor esta vacio; va en el `<textarea>`, no en el espejo. */
  ejemplo?: string
}

export function EditorPython({ codigo, alCambiar, ejemplo }: EditorPythonProps) {
  const espejo = useRef<HTMLPreElement>(null)

  return (
    /*
     * 🔴 `.consola` VA AQUÍ Y NO EN EL `<textarea>`: el espejo coloreado y la caja
     *    de escritura tienen que compartir fondo o se ve el borde entre los dos.
     *    El `<textarea>` sigue transparente, como siempre.
     */
    <div className="consola relative rounded-md">
      {/*
        El espejo. `aria-hidden` porque es una COPIA: sin eso, un lector de
        pantalla leeria el programa dos veces.
      */}
      <pre
        ref={espejo}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden text-[rgb(var(--consola-tinta))] ${MAQUETA}`}
      >
        {/*
          El indice ES la identidad: los tokens se regeneran enteros en cada
          tecla y no tienen ninguna clave estable que darles.
        */}
        {tokenizar(codigo).map((t, i) => (
          <span key={i} className={CLASE[t.tipo]}>{t.texto}</span>
        ))}
        {/* Un salto de mas: un `<pre>` se come el ultimo y un `<textarea>` no,
            asi que sin esto la ultima linea vacia desalinearia el final. */}
        {'\n'}
      </pre>

      <textarea
        id="editor-taller"
        aria-label="Tu código"
        spellCheck={false}
        value={codigo}
        onChange={(e) => alCambiar(e.target.value)}
        onScroll={(e) => {
          const p = espejo.current
          if (p === null) return
          p.scrollTop = e.currentTarget.scrollTop
          p.scrollLeft = e.currentTarget.scrollLeft
        }}
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault()
            const t = e.currentTarget
            const i = t.selectionStart
            const nuevo = `${codigo.slice(0, i)}    ${codigo.slice(t.selectionEnd)}`
            alCambiar(nuevo)
            requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = i + 4 })
          }
        }}
        placeholder={ejemplo}
        /*
          🔴 `text-transparent` deja ver el espejo, y `caret-*` devuelve el cursor
             —que tambien es texto y tambien se volveria invisible—.
          🔴 Y `selection:` es obligatorio: el `textarea` esta ENCIMA, asi que su
             fondo de seleccion opaco taparia el color. Con alfa se ve a traves.
        */
        className={`relative w-full resize-y bg-transparent text-transparent caret-[rgb(var(--consola-tinta))] outline-none min-h-[260px] selection:bg-[rgb(var(--marca)/0.22)] placeholder:text-[rgb(var(--consola-apagada)/0.55)] ${MAQUETA}`}
      />
    </div>
  )
}
