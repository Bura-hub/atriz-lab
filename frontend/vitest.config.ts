import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  /*
   * ═════════════════════════════════════════════════════════════════════════
   * 🔴 EL ALIAS `@/`, QUE ANTES NO ESTABA Y COSTÓ DOS TROPIEZOS
   * ═════════════════════════════════════════════════════════════════════════
   * `tsconfig.json` lo define, así que `tsc` y Next lo resuelven y el editor no
   * subraya nada. **Vitest no lee `tsconfig`**: sin esta línea, una prueba que
   * importa un fichero que a su vez usa `@/…` falla con
   * `Cannot find package '@/…'` — y el mensaje señala al import, no al alias
   * que falta, así que se lee como un paquete sin instalar.
   *
   * Mordió dos veces. La primera se esquivó cambiando ESA prueba a una ruta
   * relativa, que es un parche por fichero: la trampa seguía armada para el
   * siguiente. La segunda fue justo el siguiente — `rail.test.ts`, en cuanto el
   * raíl empezó a leer la sesión. Arreglarlo aquí la desarma para todos.
   *
   * 📝 Es la forma que este proyecto ya conoce: **una cifra o una regla correcta
   *    en su contexto se vuelve falsa al mudarla de sitio.** El alias existía;
   *    lo que no existía era en el intérprete que corre las pruebas.
   */
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // El nucleo de rosbridge se prueba en Node, sin navegador y sin robot.
    //
    // ⚠️ `src/hooks/**` entra tambien, y NO porque se rendericen componentes:
    // aqui no hay jsdom ni @testing-library, y no se instalan. Lo que se prueba
    // de los hooks es su NUCLEO extraido -el cuerpo de cada `useEffect` como
    // funcion suelta que devuelve su limpieza-, que corre en Node igual que
    // `salud.ts`. Ver `.superpowers/informe-hooks.md`.
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/hooks/**/*.test.ts'],
  },
  // `tsconfig.json` deja `jsx: "preserve"` porque de eso se encarga Next, y el
  // transformador de Vite lo hereda. Vitest no pasa por Next, asi que sin esto
  // un `.tsx` importado desde una prueba -aunque solo se le pida una funcion
  // pura- revienta con «invalid JS syntax».
  //
  // ⚠️ Va en `oxc`, no en `esbuild`: este Vite transforma con oxc y avisa
  // explicitamente de que «las opciones de esbuild se ignoran».
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
})
