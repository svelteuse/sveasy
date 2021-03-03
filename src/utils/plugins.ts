import { compile, preprocess } from 'svelte/compiler'
import { statSync, promises } from 'fs'
import { relative } from 'path'

export const svelte = (options: any) => {
  return {
    name: 'sveasy-svelte-plugin',
    setup(build: any) {
      // Store generated css code for use in fake import
      const cssCode = new Map()
      const fileCache = new Map()

      // main loader
      build.onLoad({ filter: /\.svelte$/ }, async (args: any) => {
        // if told to use the cache, check if it contains the file,
        // and if the modified time is not greater than the time when it was cached
        // if so, return the cached data
        if (options?.cache === true && fileCache.has(args.path)) {
          const cachedFile = fileCache.get(args.path)
          if (cachedFile && statSync(args.path).mtime < cachedFile.time) {
            return cachedFile.data
          }
        }

        let source = await promises.readFile(args.path, 'utf8')
        const filename = relative(process.cwd(), args.path)

        try {
          if (options?.preprocess) {
            source = (
              await preprocess(source, options.preprocess, { filename })
            ).code
          }

          const compileOptions = { css: false, ...options?.compileOptions }

          const { js, css, warnings } = compile(source, {
            ...compileOptions,
            filename
          })
          let contents = js.code + '\n//# sourceMappingURL=' + js.map.toUrl()

          // if svelte emits css seperately, then store it in a map and import it from the js
          if (!compileOptions.css && css.code) {
            const cssPath = args.path
              .replace('.svelte', '.esbuild-svelte-fake-css')
              .replace(/\\/g, '/')
            cssCode.set(
              cssPath,
              css.code + `/*# sourceMappingURL=${css.map.toUrl()}*/`
            )
            contents = contents + `\nimport "${cssPath}";`
          }

          const result = {
            contents: contents,
            warnings: warnings.map(convertWarningFormat)
          }

          // if we are told to cache, then cache
          if (options?.cache === true) {
            fileCache.set(args.path, { data: result, time: new Date() })
          }
          return result
        } catch (e) {
          return [convertWarningFormat(e)]
        }
      })

      // if the css exists in our map, then output it with the css loader
      build.onResolve({ filter: /\.esbuild-svelte-fake-css$/ }, (args: any) => {
        return { path: args.path, namespace: 'fakecss' }
      })

      build.onLoad({ filter: /\.esbuild-svelte-fake-css$/, namespace: 'fakecss' }, (args: any) => {
        const css = cssCode.get(args.path)
        return css ? { contents: css, loader: 'css' } : null
      })
    }
  }
}

const convertWarningFormat = ({ message, start, end, filename, frame }: any) => ({
  text: message,
  location: start &&
    end && {
    file: filename,
    line: start.line,
    column: start.column,
    length: start.line === end.line ? end.column - start.column : 0,
    lineText: frame
  }
})
