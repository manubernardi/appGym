// Hook de carga de módulos: los imports de Firebase por URL van al reemplazo local.

const STUB = new URL('./firebase-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://www.gstatic.com/firebasejs/')) return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}
