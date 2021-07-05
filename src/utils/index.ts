import { useConfig } from '@nbhr/utils'
import { build, serve } from 'esbuild'
import { copyFile, existsSync, mkdirSync, promises, readFile, rmSync } from 'fs'
import { createServer, request, ServerResponse } from 'http'
import { join } from 'path'
import { svelte } from './plugins'

export const builder = async (): Promise<void> => {
  // glob svelte.config.{js,cjs,mjs}
  const config = await useConfig.load('svelte.config.js')
  const extractedPreprocess = config.preprocess

  // make sure the directory exists before stuff gets put into into
  if (!existsSync('./dist/')) {
    mkdirSync('./dist/')
  }
  // build the application
  build({
    bundle: true,
    entryPoints: ['src/index.js'],
    format: 'esm',
    minify: true,
    outdir: './dist',
    splitting: true,
    target: [
      'chrome78',
      'firefox75',
      'safari11',
      'edge79'
    ],
    write: true,
    // advanced
    color: true,
    incremental: false,
    legalComments: 'eof',
    logLevel: 'info',
    metafile: false,
    plugins: [
      svelte({
        compileOptions: { css: false },
        preprocess: extractedPreprocess
      })
    ]
  })
    .then(async (_result) => {
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })

  try {
    const files = await promises.readdir('public')
    files.forEach(file => {
      copyFile(join('public', file), join('dist', file), (err) => {
        if (err != null) {
          throw err
        }
      })
    })
  } catch (error) {

  }
}

// sveasy dev
export const server = async (): Promise<void> => {
  const config = await useConfig.load('svelte.config.js')
  const extractedPreprocess = config.preprocess

  try {
    // make sure the directory exists before stuff gets put into into
    if (!existsSync('.sveasy')) {
      mkdirSync('.sveasy')
    }
    const files = await promises.readdir('public')
    files.forEach(file => {
      copyFile(join('public', file), join('.sveasy', file), (err) => {
        if (err != null) {
          throw err
        }
      })
    })
  } catch (error) {

  }

  const clients: ServerResponse[] = []
  build({
    target: [
      'chrome78',
      'firefox75',
      'safari11',
      'edge79'
    ],
    entryPoints: ['src/index.js'],
    bundle: true,
    incremental: true,
    sourcemap: 'inline',
    outdir: './.sveasy',
    banner: { js: ' (() => new EventSource("/esbuild").onmessage = (e) => location.reload())();' },
    watch: {
      onRebuild (error, result) {
        if (error != null) console.error('watch build failed:', error)
        clients.forEach(res => res.write('data: update\n\n'))
        clients.length = 0
      }
    },
    plugins: [
      svelte({
        compileOptions: { css: false, dev: true },
        preprocess: extractedPreprocess
      })
    ]
  })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })

  serve({
    port: 8000,
    servedir: '.sveasy'
  }, {})
    .then((result) => {
      const { port } = result
      createServer((req, res) => {
        const { url, method, headers } = req
        // TODO: UNDERSTAND
        if (req.url === '/esbuild') {
          return clients.push(
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive'
            })
          )
        }
        const path = url
        req.pipe(
          request({ hostname: '0.0.0.0', port: port, path, method, headers }, (prxRes) => {
            if (prxRes.statusCode === 404) {
              readFile('./.sveasy/index.html', function (error, content) {
                if (error != null) throw error
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(content, 'utf-8')
              })
            } else if (prxRes.statusCode !== undefined) {
              res.writeHead(prxRes.statusCode, prxRes.headers)
              prxRes.pipe(res, { end: true })
            }
          }),
          { end: true }
        )
      }).listen(8080)
      process.on('SIGINT', function () {
        rmSync('.sveasy', { recursive: true })
        process.exit()
      // clients.length = 0
      // result.stop()
      // setTimeout(() => {
      // }, 500)
      })
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
