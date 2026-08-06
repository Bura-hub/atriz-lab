import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * ⚠️ EL INDICADOR DE DESARROLLO DE NEXT SE MUEVE A LA DERECHA, y esto es una
   *    nota de método más que un ajuste.
   *
   * Es el disco oscuro que `next dev` inyecta (`<nextjs-portal>`); por defecto
   * vive abajo a la izquierda y **tapaba entero el enlace «Entrar» del pie del
   * raíl**, que es justo donde ahora vive la sesión. Se descubrió mirando una
   * captura, no leyendo código.
   *
   * 🔴 Y estuvo a punto de contarse como un fallo propio. Lo que lo zanjó fue
   *    volcar el DOM renderizado y encontrar `nextjs-dev-overlay` — o sea
   *    **mirar quién pinta el píxel**, en vez de deducirlo del sitio donde
   *    aparece. En producción no existe: `next build` no lo inyecta.
   *
   * 📝 Se mueve en vez de apagarse porque el indicador sirve: avisa de errores
   *    de compilación que si no hay que ir a buscar a la terminal.
   */
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
