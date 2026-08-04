import { defineConfig } from 'vitest/config'

export default defineConfig({
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
