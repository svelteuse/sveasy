import type { OnLoadResult, PartialMessage, Plugin } from 'esbuild'
import { promises, statSync } from 'node:fs'
import { relative } from 'node:path'
import { compile, preprocess } from 'svelte/compiler'
import type { CompileOptions, Warning } from 'svelte/types/compiler/interfaces'
import { PreprocessorGroup } from 'svelte/types/compiler/preprocess/types'

function formatMessage({ message, start, end, filename, frame }: Warning): PartialMessage {
  let location
  if (start != undefined && end != undefined) {
    const tmp = frame !== undefined ? frame.length : 0
    const lineEnd = start.line === end.line ? end.column : tmp
    location = {
      file: filename,
      line: start.line,
      column: start.column,
      length: lineEnd - start.column,
      lineText: frame,
    }
  }
  return { text: message, location }
}

interface pluginOptions {
  components: boolean
  /**
   * Svelte compiler options
   */
  compileOptions?: CompileOptions

  /**
   * The preprocessor(s) to run the Svelte code through before compiling
   */
  preprocess?: PreprocessorGroup | PreprocessorGroup[]
}

export const svelte = (options?: pluginOptions): Plugin => {
  return {
    name: 'svelte',
    setup(build) {
      let cache = false
      if (
        build.initialOptions.incremental != undefined ||
        build.initialOptions.watch != undefined
      ) {
        //
        cache = true
      } else {
        //
      }

      const cacheMap = new Map<string, { data: OnLoadResult; time: Date }>()
      const cssMap = new Map<string, string>()

      build.onLoad({ filter: /\.(svelte|svx)$/ }, async (args) => {
        if (cache && cacheMap.has(args.path)) {
          const file = cacheMap.get(args.path)
          if (file != undefined && statSync(args.path).mtime < file.time) {
            return file.data
          }
        }

        let source = await promises.readFile(args.path, 'utf8')
        const filename = relative(process.cwd(), args.path)

        try {
          if (options?.preprocess != undefined) {
            source = (await preprocess(source, options.preprocess, { filename })).code
          }

          const compileOptions = { css: false, ...options?.compileOptions }

          const {
            js,
            css,
            warnings,
          }: {
            js: {
              code: string
              map: {
                toString: () => string
                toUrl: () => string
              }
            }
            css: {
              code: string
              map: {
                toString: () => string
                toUrl: () => string
              } | null
            } | null
            warnings: Warning[]
          } = compile(source, {
            ...compileOptions,
            filename: filename,
          })
          let contents = js.code + '//# sourceMappingURL=' + js.map.toUrl()

          if (compileOptions.css == false && css !== null && css.map !== null) {
            if (options?.components) {
              const path = args.path.replace(/\.svelte$/, '.svelte.css').replaceAll('\\', '/')
              // const includedFiles = [...source.matchAll(/import.+?(?<file>\w+\.svelte)/gi)]
              cssMap.set(path, css.code + `/*# sourceMappingURL=${css.map.toUrl()}*/`)
              // cssMap.set(
              //   path,
              //   `:sveasy {--files: "${includedFiles.map((m) => m.groups?.file).join(',')}";}\n` +
              //     css.code +
              //     `/*# sourceMappingURL=${css.map.toUrl()}*/`
              // )
              contents = contents + `\nimport "${path}";`
            } else {
              const path = args.path.replace(/\.svelte$/, '.svelte.css').replaceAll('\\', '/')
              cssMap.set(path, css.code + `/*# sourceMappingURL=${css.map.toUrl()}*/`)
              contents = contents + `\nimport "${path}";`
            }
          }

          const data = { contents, warnings: warnings.map(formatMessage) }

          if (cache) {
            cacheMap.set(args.path, { data, time: new Date() })
          }
          // eslint-disable-next-line unicorn/no-array-callback-reference
          return {
            contents,
            warnings: warnings.map(formatMessage),
          }
        } catch (error: any) {
          return { errors: [formatMessage(error)] }
        }
      })

      // if the css exists in our map, then output it with the css loader
      build.onResolve({ filter: /\.svelte.css$/ }, (args) => {
        return { path: args.path, namespace: 'svelte-css' }
      })

      build.onLoad({ filter: /\.svelte.css$/, namespace: 'svelte-css' }, (args) => {
        const css = cssMap.get(args.path)
        return css !== null ? { contents: css, loader: 'css' } : undefined
      })
    },
  }
}
