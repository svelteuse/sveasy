import { useConfig } from '@nbhr/utils'
import { build, serve } from 'esbuild'
import { copyFile, existsSync, mkdirSync, rmSync } from 'fs'
import { readdir } from 'fs/promises'
import { createServer, request } from 'http'
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
    entryPoints: ['src/index.js'],
    outdir: './dist',
    format: 'esm',
    minify: true,
    bundle: true,
    plugins: [
      svelte({
        cache: false,
        compileOptions: { css: false },
        preprocess: extractedPreprocess
      })
    ]
  })
    .then((result) => {
      process.exit(0)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })

  // use a basic html file to test with
  try {
    const files = await readdir('public')
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
export const server = async (): Promise<void> => {
  const config = await useConfig.load('svelte.config.js')
  const extractedPreprocess = config.preprocess

  try {
    // make sure the directory exists before stuff gets put into into
    if (!existsSync('.sveasy')) {
      mkdirSync('.sveasy')
    }
    const files = await readdir('public')
    files.forEach(file => {
      copyFile(join('public', file), join('.sveasy', file), (err) => {
        if (err != null) {
          throw err
        }
      })
    })
  } catch (error) {

  }

  const clients: any = []
  build({
    entryPoints: ['src/index.js'],
    bundle: true,
    incremental: true,
    outdir: './.sveasy',
    banner: { js: ' (() => new EventSource("/esbuild").onmessage = (e) => location.reload())();' },
    watch: {
      onRebuild (error, result) {
        if (error != null) console.error('watch build failed:', error)
        clients.forEach((res: any) => res.write('data: update\n\n'))
        clients.length = 0
      }
    },
    plugins: [
      svelte({
        cache: false,
        compileOptions: { css: false },
        preprocess: extractedPreprocess
      })
    ]
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })

  serve({ servedir: '.sveasy' }, {}).then((result) => {
    const { host, port } = result
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
          if (prxRes.statusCode !== undefined) {
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
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
