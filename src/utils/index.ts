import { useConfig } from '@nbhr/utils'
import { build, serve, transformSync } from 'esbuild'
import { copyFile, copyFileSync, existsSync, mkdirSync, promises, readdirSync, readFile, rmSync, writeFileSync } from 'fs'
import { createServer, request, ServerResponse } from 'http'
import { join } from 'path'
import { svelte } from './plugins'

export const builder = async (options: { write: boolean }): Promise<void> => {
  // glob svelte.config.{js,cjs,mjs}
  const config = await useConfig.load('svelte.config.js')
  const extractedPreprocess = config.preprocess

  // make sure the directory exists before stuff gets put into into
  if (!existsSync('./dist/')) {
    mkdirSync('./dist/')
  }
  console.log(options.write);
  
  // build the application
  build({
    bundle: true,
    entryPoints: ['src/index.js'],
    format: 'esm',
    minify: false,
    outdir: './dist',
    splitting: true,
    target: [
      'chrome78',
      'firefox75',
      'safari11',
      'edge79'
    ],
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
        preprocess: extractedPreprocess
      })
    ]
  })
  .then(async (result) => {
    console.log(result);
    if (result.outputFiles && result.outputFiles.length > 0) {
      let jsFile
      let cssFile
      for (const file of result.outputFiles) {
        if (file.path.includes('index.js')) {
          jsFile = file
          // console.log(file.contents);
          // console.log(file.text);
        }
        if (file.path.includes('index.css')) {
          cssFile = file
          // console.log(file.contents);
          // console.log(file.text);
          let matches = [...file.text.matchAll(/(?<=((?<fileId>Button.svelte.css)\s\*\/))(.+:sveasy\s{.*?})?(?<css>.*?)\/\*/gis)]
          // console.log(matches[0].groups);
        }

      }
      if (jsFile && cssFile) {
        let tmpText = jsFile.text
        let tmpCss = cssFile.text + '\n/*'
        let registerMatches = [...jsFile.text.matchAll(/register\((["|'|`])(?<tagName>[\w|-]+)\1\s*,\s*(?<component>\w+)\s*,\s*(["|'|`])(?<cssReplace>[\w|.|]+)\4/gi)]
        for (const register of registerMatches) {
          if (register.groups && register.groups.cssReplace) {
            console.log(register.groups.cssReplace);
            // let regex = new RegExp(`(?<=((?<fileId>${register.groups.cssReplace})\\s\\*\/))(.+:sveasy\\s{.*?})?(?<css>.*?)\/\\*`, 'gis')
            let regex = new RegExp(`(?<=svelte-css)[\\w|:|/|-]+(?<fileId>${register.groups.cssReplace}).*?(:sveasy.*?{.*?"(?<files>[\\w|.|,]+?)?".*?})\n*(?<css>.+?)(?=\/\\*)`, 'gis')
            console.log(regex);
            let cssMatches = [...tmpCss.matchAll(regex)]
            if (cssMatches && cssMatches.length > 0 && cssMatches[0].groups && cssMatches[0].groups.css) {
              let finalCss = cssMatches[0].groups.css
              if (cssMatches[0].groups.files) {
                let files = cssMatches[0].groups.files.split(',')
                console.log("Nested Files", files);
                for (const file of files) {
                  let nestedRegex = new RegExp(`(?<=svelte-css)[\\w|:|/|-]+(?<fileId>${file}.css).*?(:sveasy.*?{.*?"(?<files>[\\w|.|,]+?)?".*?})\n*(?<css>.+?)(?=\/\\*)`, 'gis')
                  let nestedCSS = [...tmpCss.matchAll(nestedRegex)]
                  if (nestedCSS && nestedCSS.length > 0 && nestedCSS[0].groups && nestedCSS[0].groups.css) {
                    finalCss = finalCss + "\n" + nestedCSS[0].groups.css
                  }
                }
              }
              let minifiedCss = transformSync(finalCss, {
                loader: 'css',
                minify: true,
              })
              tmpText = tmpText.replace(`"${register.groups.cssReplace}"`, "`" + JSON.stringify(minifiedCss.code) + "`" )
            }
          }          
        }
        writeFileSync(jsFile.path, tmpText, 'utf8')
        // let cssBMatches = [...cssFile.text.matchAll(/(?<=((?<fileId>Button.svelte.css)\s\*\/))(.+:sveasy\s{.*?})?(?<css>.*?)\/\*/gis)]
        // if (cssBMatches[0] && cssBMatches[0].groups) {
        //   tmpText = jsFile.text.replace("\"Button.svelte.css\"","`"+ cssBMatches[0].groups.css + "`")
        // }
        // let cssPMatches = [...cssFile.text.matchAll(/(?<=((?<fileId>Pagination.svelte.css)\s\*\/))(.+:sveasy\s{.*?})?(?<css>.*?)$/gis)]
        // if (cssPMatches[0] && cssPMatches[0].groups) {
        //   tmpText = jsFile.text.replace("\"Pagination.svelte.css\"","`"+ cssPMatches[0].groups.css + "`")
        // }
        // writeFileSync(jsFile.path, tmpText, 'utf8')
      }
    }

    try {
      const files = readdirSync('public')
      // console.log(files);
      files.forEach(file => {
        copyFileSync(`public/${file}`, `dist/${file}`)
      })
    } catch (error) {
            console.log(error)
    }
    
    
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
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
