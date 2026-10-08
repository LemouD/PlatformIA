// Resolution hook so Node can run the TypeScript sources directly: maps "@/..." to src/
// and adds the ".ts" extension that the sources leave out.
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../src/', import.meta.url)

export async function resolve(specifier, context, nextResolve) {
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
