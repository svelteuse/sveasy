import { /* useConfig, */ useFs } from '@nbhr/utils'
import { build, OutputFile, transform, transformSync } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { relative, sep, join } from 'node:path'
import { Processor as windi } from 'windicss/lib'
import { svelte } from './plugins'
import { cwd } from 'node:process'

function combineCss(tmpCss: string, cssReplace: string) {
  let parsedCss = ''

  const regex = new RegExp(
    `(?<=svelte-css)[\\w/:-]+(?<fileId>\\/${cssReplace.toLowerCase()}).*?(:sveasy.*?{.*?"(?<files>[\\w,.]+?)?".*?})\n*(?<css>.+?)(?=\\/\\*\\s?svelte-css)`,
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

export default async function (options: any) {
  // glob svelte.config.{js,cjs,mjs}
  const config: any = (await import(join(cwd(), 'svelte.config.js'))).default
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
        components: false,
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
        components: true,
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
