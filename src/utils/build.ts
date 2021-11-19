// import { useConfig } from '@nbhr/utils'
import { build, BuildResult } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { svelte } from './plugins'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { pathToFileURL } from 'node:url'

export default async (): Promise<void> => {
  // glob svelte.config.{js,cjs,mjs}
  const filePath = pathToFileURL(join(cwd(), 'svelte.config.js')).toString()
  const config: any = (await import(filePath)).default

  const extractedPreprocess = config.preprocess

  // make sure the directory exists before stuff gets put into into
  if (!existsSync('./dist/')) {
    mkdirSync('./dist/')
  }

  const define: Record<string, string> = {}

  for (const k in process.env) {
    if (!k.startsWith('SVEASY_BUILD_VAR_')) continue
    define[`process.env.${k}`] = JSON.stringify(process.env[k])
  }

  // build the application
  build({
    bundle: true,
    define: define,
    entryPoints: ['src/index.js'],
    format: 'esm',
    minify: true,
    outdir: './dist',
    splitting: true,
    target: ['chrome88', 'firefox85', 'safari14', 'edge88'],
    // advanced
    color: true,
    incremental: false,
    logLevel: 'info',
    metafile: false,
    plugins: [
      svelte({
        compileOptions: { css: false },
        components: false,
        preprocess: extractedPreprocess,
      }),
    ],
  })
    .then((result: BuildResult) => {
      console.dir(result)
      try {
        const files = readdirSync('public')

        for (const file of files) {
          copyFileSync(`public/${file}`, `dist/${file}`)
        }
      } catch (error) {
        console.log(error)
      }
    })
    .catch((error) => {
      console.error(error)
      throw new Error(error)
    })
}
