// Genera public/icons/icon-{16,32,48,128}.png a partir del símbolo APP_ICON de Material Symbols:
// glifo negro sobre fondo blanco con borde negro redondeado, el mismo estilo que la cabecera del popup.
// Uso: npm run icons (vuelve a ejecutarlo si cambias APP_ICON en src/config/app.ts).
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const config = await readFile(new URL('../src/config/app.ts', import.meta.url), 'utf8');
const icon = config.match(/APP_ICON\s*=\s*'([^']+)'/)?.[1];
if (!icon) throw new Error('No se encontró APP_ICON en src/config/app.ts');

const svg = await readFile(require.resolve(`@material-symbols/svg-400/outlined/${icon}.svg`), 'utf8');
const path = svg.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
if (!path) throw new Error(`No se pudo leer el trazado del icono "${icon}"`);

const outDir = new URL('../public/icons/', import.meta.url);
await mkdir(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  // A 16 px el borde se come el glifo: se omite y el glifo ocupa casi todo el lienzo.
  const border = size >= 32;
  const stroke = Math.max(1, size / 24);
  const glyph = size * (border ? 0.68 : 0.9);
  const offset = (size - glyph) / 2;
  const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="${stroke / 2}" y="${stroke / 2}" width="${size - stroke}" height="${size - stroke}" rx="${size * 0.2}"
      fill="#fff" ${border ? `stroke="#111827" stroke-width="${stroke}"` : ''}/>
    <svg x="${offset}" y="${offset}" width="${glyph}" height="${glyph}" viewBox="0 -960 960 960"><path d="${path}" fill="#111827"/></svg>
  </svg>`;
  await sharp(Buffer.from(image)).png().toFile(fileURLToPath(new URL(`icon-${size}.png`, outDir)));
  console.log(`public/icons/icon-${size}.png`);
}
