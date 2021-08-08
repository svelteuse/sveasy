import { useConfig } from '@nbhr/utils'
import { build, BuildResult, serve, transform, transformSync } from 'esbuild'
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

async function handleComponents(result: BuildResult, outDir: string) {
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
      const tmpCss = cssFile.text + '\n/* svelte-css:INJECTED_END'

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

      // FIXME: #3: replace windicss static preflights with more dynamic solution
      let preflights = transformSync(
        `*, ::before, ::after {
        -webkit-box-sizing: border-box;
        box-sizing: border-box;
        border-width: 0;
        border-style: solid;
        border-color: #e5e7eb;
      }
      * {
        --tw-ring-inset: var(--tw-empty,/*!*/ /*!*/);
        --tw-ring-offset-width: 0px;
        --tw-ring-offset-color: #fff;
        --tw-ring-color: rgba(59, 130, 246, 0.5);
        --tw-ring-offset-shadow: 0 0 #0000;
        --tw-ring-shadow: 0 0 #0000;
        --tw-shadow: 0 0 #0000;
      }
      :root {
        -moz-tab-size: 4;
        -o-tab-size: 4;
        tab-size: 4;
      }
      :-moz-focusring {
        outline: 1px dotted ButtonText;
      }
      :-moz-ui-invalid {
        box-shadow: none;
      }
      ::moz-focus-inner {
        border-style: none;
        padding: 0;
      }
      ::-webkit-inner-spin-button, ::-webkit-outer-spin-button {
        height: auto;
      }
      ::-webkit-search-decoration {
        -webkit-appearance: none;
      }
      ::-webkit-file-upload-button {
        -webkit-appearance: button;
        font: inherit;
      }
      [type='search'] {
        -webkit-appearance: textfield;
        outline-offset: -2px;
      }
      abbr[title] {
        -webkit-text-decoration: underline dotted;
        text-decoration: underline dotted;
      }
      body {
        margin: 0;
        font-family: inherit;
        line-height: inherit;
      }
      html {
        -webkit-text-size-adjust: 100%;
        font-family: ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";
        line-height: 1.5;
      }
      a {
        color: inherit;
        text-decoration: inherit;
      }
      b, strong {
        font-weight: bolder;
      }
      button, input, optgroup, select, textarea {
        font-family: inherit;
        font-size: 100%;
        line-height: 1.15;
        margin: 0;
        padding: 0;
        line-height: inherit;
        color: inherit;
      }
      button, select {
        text-transform: none;
      }
      button, [type='button'], [type='reset'], [type='submit'] {
        -webkit-appearance: button;
      }
      blockquote, dl, dd, h1, h2, h3, h4, h5, h6, hr, figure, p, pre {
        margin: 0;
      }
      button {
        background-color: transparent;
        background-image: none;
      }
      button:focus {
        outline: 1px dotted;
        outline: 5px auto -webkit-focus-ring-color;
      }
      button, [role="button"] {
        cursor: pointer;
      }
      code, kbd, samp, pre {
        font-size: 1em;
      }
      fieldset {
        margin: 0;
        padding: 0;
      }
      hr {
        height: 0;
        color: inherit;
        border-top-width: 1px;
      }
      h1, h2, h3, h4, h5, h6 {
        font-size: inherit;
        font-weight: inherit;
      }
      img {
        border-style: solid;
      }
      input::placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      input::webkit-input-placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      input::-moz-placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      input:-ms-input-placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      input::-ms-input-placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      img, svg, video, canvas, audio, iframe, embed, object {
        display: block;
        vertical-align: middle;
      }
      img, video {
        max-width: 100%;
        height: auto;
      }
      legend {
        padding: 0;
      }
      ol, ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      progress {
        vertical-align: baseline;
      }
      pre, code, kbd, samp {
        font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
      }
      small {
        font-size: 80%;
      }
      sub, sup {
        font-size: 75%;
        line-height: 0;
        position: relative;
        vertical-align: baseline;
      }
      sub {
        bottom: -0.25em;
      }
      sup {
        top: -0.5em;
      }
      summary {
        display: list-item;
      }
      table {
        text-indent: 0;
        border-color: inherit;
        border-collapse: collapse;
      }
      textarea {
        resize: vertical;
      }
      textarea::placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      textarea::webkit-input-placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      textarea::-moz-placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      textarea:-ms-input-placeholder {
        opacity: 1;
        color: #9ca3af;
      }
      textarea::-ms-input-placeholder {
        opacity: 1;
        color: #9ca3af;
      }`,
        { loader: 'css', minify: true }
      )
      for (const file of data) {
        tmpText = tmpText.replace(
          `"${file.identifier}"`,
          '`' +
            JSON.stringify(preflights.code) +
            JSON.stringify(file.code) +
            '`'
        )
      }
      writeFileSync(jsFile.path, tmpText, 'utf8')
    }
  }

  try {
    const files = readdirSync('public')

    for (const file of files) {
      copyFileSync(`public/${file}`, `${outDir}/${file}`)
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
      handleComponents(result, 'dist')
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
    sourcemap: false,
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
          handleComponents(result, '.sveasy')
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
      handleComponents(result, '.sveasy')
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
