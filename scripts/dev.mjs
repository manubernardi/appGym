// Entorno de prueba: lo corre `npm run dev` con los emuladores de Firebase ya levantados.
// Carga los usuarios de prueba y sirve la app en http://localhost:5050 (y en la red local, para probar en el celular).
// Ctrl+C para cortar: los emuladores se apagan y los datos de prueba se pierden; el próximo arranque los vuelve a cargar.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEV_PORTS, DEV_PASSWORD } from '../js/dev.js';
import { seedAll } from './seed.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

console.log('\nCargando usuarios de prueba (contraseña de todos: %s):', DEV_PASSWORD);
await seedAll();

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([\\/])+/, '');
  if (path.startsWith('..') || path.startsWith('node_modules')) { res.writeHead(404).end(); return; }
  try {
    const file = join(ROOT, path || 'index.html');
    const body = await readFile(file);
    // Sin caché: cada recarga trae el código recién guardado.
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(DEV_PORTS.app, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces()).flat().find((i) => i?.family === 'IPv4' && !i.internal)?.address;
  console.log(`
Listo. Entorno de prueba:
  App:            http://localhost:${DEV_PORTS.app}
  En el celular:  ${lan ? `http://${lan}:${DEV_PORTS.app}  (misma red Wi-Fi)` : '(no se encontró la red local)'}
  Ver los datos:  http://localhost:${DEV_PORTS.ui}  (consola de los emuladores)
Ctrl+C para cortar.`);
});
