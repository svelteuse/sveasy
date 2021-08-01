import { useConfig } from '@nbhr/utils'
import { build, serve, transformSync } from 'esbuild'
import {
  copyFile,
  copyFileSync,
  existsSync,
  mkdirSync,
  promises,
  readdirSync,
  readFile,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer, request, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { svelte } from './plugins'

function combineCss(tmpCss: string, cssReplace: string) {
  let parsedCss = ''
  // console.log(cssReplace)
  const regex = new RegExp(
    `(?<=svelte-css)[\\w/:-]+(?<fileId>${cssReplace.toLowerCase()}).*?(:sveasy.*?{.*?"(?<files>[\\w,.]+?)?".*?})\n*(?<css>.+?)(?=\\/\\*)`,
    'gis'
  )
  const cssMatches = [...tmpCss.matchAll(regex)]
  if (
    cssMatches &&
    cssMatches.length > 0 &&
    cssMatches[0].groups &&
    cssMatches[0].groups.css
  ) {
    parsedCss = parsedCss + '\n' + cssMatches[0].groups.css
    if (cssMatches[0].groups.files) {
      const files = cssMatches[0].groups.files.split(',')
      console.log(`Nested Files (of ${cssReplace})`, files)
      for (const file of files) {
        const tmpFile = file + '.css'
        parsedCss = parsedCss + '\n' + combineCss(tmpCss, tmpFile)
      }
    }
  }
  return parsedCss
}

export const builder = async (options: { write: boolean }): Promise<void> => {
  // glob svelte.config.{js,cjs,mjs}
  const config = await useConfig.load('svelte.config.js')
  const extractedPreprocess = config.preprocess

  // make sure the directory exists before stuff gets put into into
  if (!existsSync('./dist/')) {
    mkdirSync('./dist/')
  }
  console.log(options.write)

  // build the application
  build({
    bundle: true,
    entryPoints: ['src/index.js'],
    format: 'esm',
    minify: false,
    outdir: './dist',
    splitting: true,
    target: ['chrome78', 'firefox75', 'safari11', 'edge79'],
    write: options.write,
    // advanced
    color: true,
    incremental: false,
    legalComments: 'eof',
    logLevel: 'info',
    metafile: false,
    plugins: [
      svelte({
        compileOptions: { css: false },
        preprocess: extractedPreprocess,
      }),
    ],
  })
    .then(async (result) => {
      console.log(result)
      if (result.outputFiles && result.outputFiles.length > 0) {
        let jsFile
        let cssFile
        for (const file of result.outputFiles) {
          if (file.path.includes('index.js')) {
            jsFile = file
          }
          if (file.path.includes('index.css')) {
            cssFile = file
          }
        }
        if (jsFile && cssFile) {
          let tmpText = jsFile.text
          const tmpCss = cssFile.text + '\n/*'
          const registerMatches = [
            ...jsFile.text.matchAll(
              /register\((["'`])(?<tagName>[\w-]+)\1\s*,\s*(?<component>\w+)\s*,\s*(["'`])(?<cssReplace>[\w.]+)\4/gi
            ),
          ]
          for (const register of registerMatches) {
            if (register.groups && register.groups.cssReplace) {
              const finalCss = combineCss(tmpCss, register.groups.cssReplace)
              const minifiedCss = transformSync(finalCss, {
                loader: 'css',
                minify: true,
              })
              tmpText = tmpText.replace(
                `"${register.groups.cssReplace}"`,
                '`' + JSON.stringify(minifiedCss.code) + '`'
              )
            }
          }
          writeFileSync(jsFile.path, tmpText, 'utf8')
        }
      }

      try {
        const files = readdirSync('public')
        // console.log(files);
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
    for (const file of files) {
      copyFile(join('public', file), join('.sveasy', file), (err) => {
        if (err != undefined) {
          throw err
        }
      })
    }
  } catch (error) {
    throw new Error(error)
  }

  const clients: ServerResponse[] = []
  build({
    target: ['chrome78', 'firefox75', 'safari11', 'edge79'],
    entryPoints: ['src/index.js'],
    bundle: true,
    incremental: true,
    sourcemap: 'inline',
    outdir: './.sveasy',
    banner: {
      js: ' (() => new EventSource("/esbuild").onmessage = (e) => location.reload())();',
    },
    watch: {
      onRebuild(error) {
        if (error != undefined) console.error('watch build failed:', error)
        for (const res of clients) res.write('data: update\n\n')
        clients.length = 0
      },
    },
    plugins: [
      svelte({
        compileOptions: { css: false, dev: true },
        preprocess: extractedPreprocess,
      }),
    ],
  }).catch((error) => {
    console.error(error)
    throw new Error(error)
  })

  serve(
    {
      port: 8000,
      servedir: '.sveasy',
    },
    {}
  )
    .then((result) => {
      const { port } = result
      createServer((req, res) => {
        const { url, method, headers } = req
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
          request(
            { hostname: '0.0.0.0', port: port, path, method, headers },
            (prxRes) => {
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
            }
          ),
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
    .catch((error) => {
      console.error(error)
      throw new Error(error)
    })
}
