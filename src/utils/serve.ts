// import { useConfig } from '@nbhr/utils'
// import { cpFolderSync } from '@nbhr/utils/fs'
import { build, serve } from 'esbuild'
import getPort from 'get-port'
import { copyFileSync, readdirSync, readFile, rmSync, existsSync, mkdirSync } from 'node:fs'
import { createServer, request, ServerResponse } from 'node:http'
import { join, relative } from 'node:path'
import { cwd } from 'node:process'
import { svelte } from './plugins'

export default async (options: { port?: string }): Promise<void> => {
  if (options.port == undefined) options.port = '8080'
  const config: any = (await import(join(cwd(), 'svelte.config.js'))).default
  const extractedPreprocess = config.preprocess

  if (!existsSync('.sveasy')) {
    mkdirSync('.sveasy')
  }
  const files = readdirSync('public')

  for (const file of files) {
    copyFileSync(`public/${file}`, `.sveasy/${file}`)
  }
  // cpFolderSync('public', '.sveasy')

  // const define: Record<string, string> = {}

  // for (const k in process.env) {
  //   if (!k.startsWith('SVEASY_BUILD_VAR_')) continue
  //   define[`process.env.${k}`] = JSON.stringify(process.env[k])
  // }

  const clients: ServerResponse[] = []
  build({
    entryPoints: ['src/index.js'],
    bundle: true,
    // define: define,
    incremental: true,
    sourcemap: true,
    splitting: true,
    format: 'esm',
    outdir: './.sveasy',
    banner: {
      js: ' (() => new EventSource("/esbuild").onmessage = (e) => location.reload())();',
    },
    watch: {
      onRebuild(error, result) {
        if (error != undefined) console.error('watch build failed:', error)
        try {
          const files = readdirSync('public')

          for (const file of files) {
            copyFileSync(`public/${file}`, `.sveasy/${file}`)
          }
        } catch (error) {
          console.log(error)
        }

        for (const res of clients) res.write('data: update\n\n')
        clients.length = 0
      },
    },
    plugins: [
      svelte({
        compileOptions: { css: false, dev: true, accessors: false },
        components: false,
        preprocess: extractedPreprocess,
      }),
    ],
  }).catch((error) => {
    console.error(error)
    throw new Error(error)
  })
  const internalPort = await getPort()
  console.log('internal:', internalPort)

  serve(
    {
      port: internalPort,
      servedir: '.sveasy',
    },
    {}
  )
    .then((result) => {
      const { port } = result
      createServer((req, res) => {
        const { url, method, headers } = req
        console.log('url:', url)
        // TODO: UNDERSTAND
        if (url === '/esbuild') {
          return clients.push(
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            })
          )
        }
        const path = url
        req.pipe(
          request({ hostname: '0.0.0.0', port: port, path, method, headers }, (prxRes) => {
            if (prxRes.statusCode === 404) {
              readFile('./.sveasy/index.html', function (error, content) {
                if (error != undefined) throw error
                res.writeHead(200, {
                  'Content-Type': 'text/html; charset=utf-8',
                })
                res.end(content, 'utf-8')
              })
            } else if (prxRes.statusCode !== undefined) {
              res.writeHead(prxRes.statusCode, prxRes.headers)
              prxRes.pipe(res, { end: true })
            }
          }),
          { end: true }
        )
      }).listen(Number.parseInt(options.port!))
      process.on('SIGINT', function () {
        rmSync('.sveasy', { recursive: true })
        process.exit()
        // clients.length = 0
        // result.stop()
        // setTimeout(() => {
        // }, 500)
      })
    })
    .catch((error) => {
      console.error(error)
      throw new Error(error)
    })
}
