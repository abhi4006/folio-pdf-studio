import { cp, mkdir } from 'node:fs/promises';
await mkdir('public/engine', { recursive: true });
for (const name of ['qpdf.js', 'qpdf.wasm']) await cp(`node_modules/@neslinesli93/qpdf-wasm/dist/${name}`, `public/engine/${name}`);
await mkdir('public/pdfjs', { recursive: true });
for (const name of ['cmaps', 'standard_fonts', 'wasm']) await cp(`node_modules/pdfjs-dist/${name}`, `public/pdfjs/${name}`, { recursive: true });
console.log('Self-hosted PDF engines and font assets are ready.');
await mkdir('public/licenses', { recursive: true });
for (const [pkg, file] of [['pdfjs-dist', 'LICENSE'], ['pdf-lib', 'LICENSE.md'], ['react', 'LICENSE'], ['lucide-react', 'LICENSE'], ['@fontsource-variable/dm-sans', 'LICENSE'], ['@fontsource-variable/manrope', 'LICENSE']]) {
  await cp(`node_modules/${pkg}/${file}`, `public/licenses/${pkg.replaceAll('/', '-')}-${file}`);
}
