import { useConfig, useFs } from '@nbhr/utils'
import { build, OutputFile, serve, transform, transformSync } from 'esbuild'
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
import { join, relative, sep } from 'node:path'
import { Processor as windi } from 'windicss/lib'
import { svelte } from './plugins'

function combineCss(tmpCss: string, cssReplace: string) {
  let parsedCss = ''

  const regex = new RegExp(
    `(?<=svelte-css)[\\w/:-]+(?<fileId>\\/${cssReplace.toLowerCase()}).*?(:sveasy.*?{.*?"(?<files>[\\w,.]+?)?".*?})\n*(?<css>.+?)(?=\\/\\*\\s?svelte-css)`,
    'is'
  )
  // console.log(regex)
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

async function handleComponents(js: OutputFile, css: OutputFile): Promise<OutputFile> {
  let tmpJS = js.text
  let tmpCss = css.text

  const registerMatches = [
    ...tmpJS.matchAll(
      /register\((["'`])(?<tagName>[\w-]+)\1\s*,\s*(?<component>\w+)\s*,\s*(["'`])(?<cssReplace>[\w.]+)\4/gi
    ),
  ]
  tmpCss += '\n/* svelte-css:INJECTED_END'
  const cssMap: Map<string, string> = new Map()
  for (const match of registerMatches) {
    if (match.groups?.cssReplace) {
      const finalCSS = combineCss(tmpCss, match.groups.cssReplace)
      cssMap.set(match.groups.cssReplace, finalCSS)
    }
  }

  const data = await Promise.all(
    [...cssMap.entries()].map(async (entry) => {
      return {
        ...(await transform(entry[1], {
          loader: 'css',
          minify: false,
        })),
        identifier: entry[0],
      }
    })
  )

  const preflights = new windi().preflight().build(false)
  writeFileSync('dist/preflights.css', preflights)
  for (const file of data) {
    tmpJS = tmpJS.replace(
      `"${file.identifier}"`,
      '`' + JSON.stringify(preflights + file.code) + '`'
    )
  }

  const out = {
    path: js.path,
    contents: Buffer.from(transformSync(tmpJS, { loader: 'js', minify: false }).code),
    get text() {
      return this.contents.toString()
    },
  }
  return out
}

export const customComponentsNext = async function (options) {
  // glob svelte.config.{js,cjs,mjs}
  const config = await useConfig.load('svelte.config.js')
  const extractedPreprocess = config.preprocess

  // check if directory dist extists, otherwise create it
  if (!existsSync('dist')) {
    mkdirSync('dist')
  }

  const root = './'
  // glob for all js files in src directory
  const files = useFs
    .walkSync(root + 'src/components')
    .map((path) => relative(root, path))
    .filter((path) => path.endsWith('.js'))
    .map((path) => path.replaceAll(sep, '/'))

  // compile the files without bundling
  build({
    bundle: true,
    entryPoints: [...files],
    format: 'esm',
    minify: false,
    outdir: './dist',
    splitting: true,
    write: true,
    target: ['chrome91', 'edge91', 'firefox89', 'safari14'],
    plugins: [
      svelte({
        compileOptions: { css: false, accessors: !options.write },
        preprocess: extractedPreprocess,
      }),
    ],
  })

  build({
    bundle: true,
    entryPoints: ['./src/legacy.js'],
    format: 'esm',
    minify: false,
    outdir: './dist',
    splitting: false,
    write: false,
    target: ['chrome91', 'edge91', 'firefox89', 'safari14'],
    plugins: [
      svelte({
        compileOptions: { css: false, accessors: !options.write },
        preprocess: extractedPreprocess,
      }),
    ],
  }).then(async (result) => {
    const tmp = await handleComponents(
      result.outputFiles.find((file) => file.path.endsWith('legacy.js'))!,
      result.outputFiles.find((file) => file.path.endsWith('legacy.css'))!
    )
    writeFileSync(tmp.path, tmp.contents, 'utf8')
  })

  copyFileSync('./src/index.js', './dist/index.js')
}

export const builder = async (options: { write: boolean; type: string }): Promise<void> => {
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
    .then((result) => {
      console.log(result)
      if (options.type == 'webcomponents') {
        console.time('handling custom-elemets')
        handleComponents(result, 'dist')
        console.timeEnd('handling custom-elemets')
      } else {
        try {
          const files = readdirSync('public')

          for (const file of files) {
            copyFileSync(`public/${file}`, `dist/${file}`)
          }
        } catch (error) {
          console.log(error)
        }
      }
    })
    .catch((error) => {
      console.error(error)
      throw new Error(error)
    })
}

// sveasy dev
export const server = async (options: { port?: string }): Promise<void> => {
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
    entryPoints: ['src/index.js'],
    bundle: true,
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
        console.log(result)
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
        compileOptions: { css: false, dev: true, accessors: !options.write },
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
        console.log(url)
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
