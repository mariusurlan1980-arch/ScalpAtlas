import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { SHOCK_NATIVE_HTML } from '../scalp-atlas-new/shockNativeEngine.ts';

const pages = new Map([
  ['/', ['text/html', await readFile(new URL('./index.html', import.meta.url))]],
  ['/app.mjs', ['text/javascript', await readFile(new URL('./app.mjs', import.meta.url))]],
  ['/select.mjs', ['text/javascript', await readFile(new URL('./select.mjs', import.meta.url))]],
  ['/engine.mjs', ['text/javascript', 'export default ' + JSON.stringify(SHOCK_NATIVE_HTML)]],
]);
createServer((request, response) => {
  const page = pages.get(request.url);
  if (!page) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': page[0] + '; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(page[1]);
}).listen(8765, '127.0.0.1', () => console.log('Scalp Atlas → http://localhost:8765'));
