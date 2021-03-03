import { copyFile, existsSync, mkdirSync } from 'fs'
import { build, serve } from 'esbuild'
import { svelte } from './plugins'
import { resolve, join } from 'path'
import { pathToFileURL } from "url";

export const builder = async () => {
  let extractedPreprocess
  if (existsSync(join(process.cwd(), 'svelte.config.js'))) {
    // @ts-expect-error
    const { preprocess } = await import(pathToFileURL(resolve('svelte.config.js'))).catch(err => { console.error(err) })
    extractedPreprocess = preprocess
  } else if (existsSync(join(process.cwd(), 'svelte.config.cjs'))) {
    // @ts-expect-error
    const { preprocess } = await import(pathToFileURL(resolve('svelte.config.cjs'))).catch(err => { console.error(err) })
    extractedPreprocess = preprocess
  }
  // make sure the directory exists before stuff gets put into into
  if (!existsSync('./dist/')) {
    mkdirSync('./dist/')
  }
  // build the application
  build({
    entryPoints: ['src/index.js'],
    outdir: './dist',
    format: 'esm',
    minify: true,
    bundle: true,
    splitting: true,
    incremental: true,
    plugins: [
      svelte({
        cache: false,
        compileOptions: { css: false },
        preprocess: extractedPreprocess
      })
    ]
  })
    .then((result) => {
      if (process.env.NODE_ENV === 'production') {
        process.exit(0)
      }
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })

  // use a basic html file to test with
  try {
    copyFile('./public/index.html', './dist/index.html', (err) => {
      if (err) throw err
    })
  } catch (error) {

  }
  try {
    copyFile('./public/favicon.ico', './dist/favicon.ico', (err) => {
      if (err) throw err
    })
  } catch (error) {

  }
  try {
    copyFile('./public/robots.txt', './dist/robots.txt', (err) => {
      if (err) throw err
    })
  } catch (error) {

  }
}
export const server = async () => {
  let extractedPreprocess
  if (existsSync(join(process.cwd(), 'svelte.config.js'))) {
    // @ts-expect-error
    const { preprocess } = await import(pathToFileURL(resolve('svelte.config.js'))).catch(err => { console.error(err) })
    extractedPreprocess = preprocess
  } else if (existsSync(join(process.cwd(), 'svelte.config.cjs'))) {
    // @ts-expect-error
    const { preprocess } = await import(pathToFileURL(resolve('svelte.config.cjs'))).catch(err => { console.error(err) })
    extractedPreprocess = preprocess
  }

  serve(
    {
      servedir: 'public',
      port: 8080,
      host: '0.0.0.0'
    },
    {
      entryPoints: ['src/index.js'],
      outdir: 'public',
      format: 'esm',
      // minify: true,
      bundle: true,
      // splitting: true,
      // incremental: true,
      plugins: [
        svelte({
          cache: false,
          compileOptions: { css: false },
          preprocess: extractedPreprocess
        })
      ]
    }
  )
    .then((server) => {
      console.log(server)
      process.on('SIGINT', function () {
        server.stop()
      })
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
