import { useConfig } from '@nbhr/utils'
import { build, BuildResult } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { svelte } from './plugins'

export default async (options: { write: boolean; type: string }): Promise<void> => {
  // glob svelte.config.{js,cjs,mjs}
  const config: any = await useConfig.load('svelte.config.js')
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
    minify: options.write,
    outdir: './dist',
    splitting: true,
    target: ['chrome89', 'firefox87', 'safari13', 'edge89'],
    write: options.write,
    // advanced
    color: true,
    incremental: false,
    legalComments: 'eof',
    logLevel: 'info',
    metafile: false,
    plugins: [
      svelte({
        compileOptions: { css: false, accessors: !options.write },
        preprocess: extractedPreprocess,
      }),
    ],
  })
    .then((result: BuildResult) => {
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
