import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const result = await build({ entryPoints: [new URL('./view.ts', import.meta.url).pathname], bundle: true, minify: true, platform: 'browser', format: 'iife', write: false });
const script = result.outputFiles[0].text.replaceAll('</script', '<\\/script').replace(/[ \t]+$/gm, '');
const shell = await readFile(new URL('./view.html', import.meta.url), 'utf8');
// The callback keeps bundled `$` sequences literal; string replacement would corrupt the App script.
await writeFile(new URL('./dist/view.html', import.meta.url), shell.replace('<!-- APP_SCRIPT -->', () => `<script>${script}</script>`));
const server = await build({ entryPoints: [new URL('./main.ts', import.meta.url).pathname], bundle: true, minify: true, platform: 'node', format: 'esm', target: 'node22', write: false });
await writeFile(new URL('./dist/server.mjs', import.meta.url), server.outputFiles[0].text.replace(/[ \t]+$/gm, ''));
