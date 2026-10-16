// Resolution hook so Node can run the TypeScript sources directly: maps "@/..." to src/
// and adds the ".ts" extension that the sources leave out.
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../src/', import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  // The terminal launcher runs on the server side: resolve the marker like Next's server layer does.
  if (specifier === 'server-only') {
    return nextResolve(specifier, { ...context, conditions: [...context.conditions, 'react-server'] })
  }
  let target
  if (specifier.startsWith('@/')) target = new URL(specifier.slice(2), SRC).href
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    target = new URL(specifier, context.parentURL).href
  } else return nextResolve(specifier, context)

  for (const candidate of [target, `${target}.ts`, `${target}/index.ts`]) {
    const path = fileURLToPath(candidate)
    if (existsSync(path) && statSync(path).isFile()) return nextResolve(candidate, context)
  }
  return nextResolve(specifier, context)
}
