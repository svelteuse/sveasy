import { useFs } from '@nbhr/utils'
import { build, OutputFile, transformSync } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { basename, relative, sep} from 'node:path'
import { svelte } from './plugins'
import { Processor as windi } from 'windicss/lib'
import { loadConfig } from 'unconfig'
import { type PreprocessorGroup } from 'svelte/types/compiler/preprocess/index'
import { writeFileSync } from 'node:fs'

// function combineCss(tmpCss: string, cssReplace: string) {
//   let parsedCss = ''

//   const regex = new RegExp(
//     `(?<=svelte-css)[\\w/:-]+(?<fileId>\\/${cssReplace.toLowerCase()}).*?(:sveasy.*?{.*?"(?<files>[\\w,.]+?)?".*?})\n*(?<css>.+?)(?=\\/\\*\\s?svelte-css)`,
//     'is'
//   )
//   // const cssMatches = [...tmpCss.matchAll(regex)]
//   const cssMatch = tmpCss.match(regex)

//   if (cssMatch && cssMatch.groups && cssMatch.groups.css) {
//     parsedCss = parsedCss + '\n' + cssMatch.groups.css
//     if (cssMatch.groups.files) {
//       const files = cssMatch.groups.files.split(',')
//       for (const file of files) {
//         const tmpFile = file + '.css'
//         parsedCss = parsedCss + '\n' + combineCss(tmpCss, tmpFile)
//       }
//     }
//   }
//   return parsedCss
// }

async function handleComponents(js: OutputFile, css: OutputFile): Promise<OutputFile> {
  const preflights = new windi().preflight().build(false)
  const minifyCSS = transformSync(preflights + '\n' +  css.text, {
    loader: "css",
    minify: true
  })
  
  const res = transformSync(js.text, {
    define: {
      IVECSSPLACEHOLDERIVE: JSON.stringify(minifyCSS.code.replaceAll('\n', ''))
    }
  })
  
  // const registerMatches = [
  //   ...tmpJS.matchAll(
  //     /register\((["'`])(?<tagName>[\w-]+)\1\s*,\s*(?<component>\w+)\s*,\s*(["'`])(?<cssReplace>[\w.]+)\4/gi
  //   ),
  // ]

  // tmpCss += '\n/* svelte-css:INJECTED_END'
  // const cssMap: Map<string, string> = new Map()
  // for (const match of registerMatches) {
  //   if (match.groups?.cssReplace) {
  //     const finalCSS = combineCss(tmpCss, match.groups.cssReplace)
  //     cssMap.set(match.groups.cssReplace, finalCSS)
  //   }
  // }

  // const data = await Promise.all(
  //   [...cssMap.entries()].map(async (entry) => {
  //     return {
  //       ...(await transform(entry[1], {
  //         loader: 'css',
  //         minify: false,
  //       })),
  //       identifier: entry[0],
  //     }
  //   })
  // )

  const out = {
    path: js.path,
    contents: Buffer.from(res.code),
    get text() {
      return this.contents.toString()
    },
  }
  return out
}

export default async function (options: { path: string }) {
  const { config } = await loadConfig<{
    preprocess: PreprocessorGroup
  }>({
    sources: [
      {
        files: 'svelte.config',
        // default extensions
        extensions: ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', ''],
      },
    ],
    merge: false,
  })

  if (config == undefined) throw new Error('No svelte.config found')
  console.log(config)
  const extractedPreprocess = config.preprocess

  try {
    await mkdir('dist')
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error
  }

  const root = process.cwd()
  console.log(root)
  // glob for all js files in src directory
  const files = useFs.walkSync(`${root}/${options.path}`)
  .map((path) => relative(root, path))
  .filter((path) => path.endsWith('.js'))
  .map((path) => path.replaceAll(sep, '/'))

  build({
    bundle: true,
    entryPoints: [...files],
    format: 'esm',
    minify: false,
    outdir: './dist',
    splitting: false,
    write: false,
    plugins: [
      svelte({
        compileOptions: { css: false, accessors: true },
        components: true,
        preprocess: extractedPreprocess,
      }),
    ],
  }).then(async (result) => {
    for (const outfile of result.outputFiles.filter((f) => f.path.endsWith('js'))) {
      const filename = basename(outfile.path, '.js')
      const css = result.outputFiles.find((file) => file.path.endsWith(`${filename}.css`))

      if (css) {
        const out = await handleComponents(outfile, css)
        // console.log(out)
        writeFileSync(`dist/${filename}.js`, out.text)
      }
    }
  })
}
