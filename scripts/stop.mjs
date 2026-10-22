// npm run dev:parar — cierra lo que haya quedado del entorno de prueba (emuladores y servidor de la app)
// si se cerró la terminal sin Ctrl+C y ahora dice "port taken". Solo toca procesos de Node o Java en esos puertos.

import { execSync } from 'node:child_process';
import { DEV_PORTS } from '../js/dev.js';

const PORTS = new Set([...Object.values(DEV_PORTS), 4400, 4401, 4500, 4501, 9150].map(String));

if (process.platform !== 'win32') {
  console.log('En Mac/Linux: lsof -ti tcp:8080,9099,5050,4000 | xargs kill');
  process.exit(0);
}

const pids = new Set();
for (const line of execSync('netstat -ano -p tcp', { encoding: 'utf8' }).split('\n')) {
  const cols = line.trim().split(/\s+/);
  if (cols[3] !== 'LISTENING') continue;
  const port = cols[1].split(':').pop();
  if (PORTS.has(port)) pids.add(cols[4]);
}

let stopped = 0;
for (const pid of pids) {
  const name = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' }).split(',')[0].replace(/"/g, '').toLowerCase();
  if (!['node.exe', 'java.exe'].includes(name)) continue;
  execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
  console.log(`Cerrado ${name} (PID ${pid})`);
  stopped++;
}
console.log(stopped ? 'Listo: ya podés correr npm run dev.' : 'No había nada del entorno de prueba corriendo.');
