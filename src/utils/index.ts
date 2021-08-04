import { useConfig } from '@nbhr/utils'
import { build, BuildResult, serve, transform } from 'esbuild'
import getPort from 'get-port'
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

  const regex = new RegExp(
    `(?<=svelte-css)[\\w/:-]+(?<fileId>${cssReplace.toLowerCase()}).*?(:sveasy.*?{.*?"(?<files>[\\w,.]+?)?".*?})\n*(?<css>.+?)(?=\\/\\*)`,
    'is'
  )
  // const cssMatches = [...tmpCss.matchAll(regex)]
  const cssMatch = tmpCss.match(regex)

  if (cssMatch && cssMatch.groups && cssMatch.groups.css) {
    parsedCss = parsedCss + '\n' + cssMatch.groups.css
    if (cssMatch.groups.files) {
      const files = cssMatch.groups.files.split(',')
      for (const file of files) {
        const tmpFile = file + '.css'
        parsedCss = parsedCss + '\n' + combineCss(tmpCss, tmpFile)
      }
    }
  }
  return parsedCss
}

async function handleComponents(result: BuildResult) {
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

      let cssMap: Map<string, string> = new Map()

      for (const register of registerMatches) {
        if (register.groups && register.groups.cssReplace) {
          const finalCss = combineCss(tmpCss, register.groups.cssReplace)

          cssMap.set(register.groups.cssReplace, finalCss)
        }
      }

      const data = await Promise.all(
        Array.from(cssMap.entries()).map(async (entry) => {
          return {
            ...(await transform(entry[1], {
              loader: 'css',
              minify: true,
            })),
            identifier: entry[0],
          }
        })
      )

      for (const file of data) {
        tmpText = tmpText.replace(
          `"${file.identifier}"`,
          '`' + JSON.stringify(file.code) + '`'
        )
      }
      writeFileSync(jsFile.path, tmpText, 'utf8')
    }
  }

  try {
    const files = readdirSync('public')

    for (const file of files) {
      copyFileSync(`public/${file}`, `dist/${file}`)
    }
  } catch (error) {
    console.log(error)
  }
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
        compileOptions: { css: false, accessors: !options.write },
        preprocess: extractedPreprocess,
      }),
    ],
  })
    .then((result) => {
      console.log(result)
      console.time('handling custom-elemets')
      handleComponents(result)
      console.timeEnd('handling custom-elemets')
    })
    .catch((error) => {
      console.error(error)
      throw new Error(error)
    })
}

// sveasy dev
export const server = async (options: {
  write: boolean
  port?: string
}): Promise<void> => {
  if (options.port == undefined) options.port = '8080'
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
    write: options.write,
    banner: {
      js: ' (() => new EventSource("/esbuild").onmessage = (e) => location.reload())();',
    },
    watch: {
      onRebuild(error, result) {
        if (error != undefined) console.error('watch build failed:', error)
        console.log(result)

        if (result) {
          console.time('handling custom-elemets')
          handleComponents(result)
          console.timeEnd('handling custom-elemets')
        }
        for (const res of clients) res.write('data: update\n\n')
        clients.length = 0
      },
    },
    plugins: [
      svelte({
        compileOptions: { css: false, dev: true, accessors: !options.write },
        preprocess: extractedPreprocess,
      }),
    ],
  })
    .then(async (result) => {
      console.time('handling custom-elemets')
      handleComponents(result)
      console.timeEnd('handling custom-elemets')
    })
    .catch((error) => {
      console.error(error)
      throw new Error(error)
    })
  let internalPort = await getPort()
  console.log(internalPort)

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
      }).listen(parseInt(options.port!))
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
