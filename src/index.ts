import { customComponentsNext, builder, server } from './utils/index'

export const main = (): void => {
  const argv = process.argv.slice(2)
  console.log(argv)
  if (!argv[0]) throw new Error('invalid arguments')
  if (argv[0] !== 'dev' && argv[0] !== 'build')
    throw new Error('invalid arguments')
  if (argv[0] === 'dev') {
    console.log('serving in dev mode')
    if (argv[1] && argv[1] === '--wc') {
      server({
        write: false,
        type: 'webcomponents',
        port: argv[2] ? argv[2].split('=')[1] : undefined,
      })
    } else {
      server({ write: true, type: 'default' })
    }
  } else if (argv[0] === 'build') {
    console.log('building in prod mode')
    if (argv[1] && argv[1] === '--wc') {
      customComponentsNext({ write: false, type: 'webcomponents' })
    } else {
      builder({ write: true, type: 'default' })
    }
  } else {
    throw new Error('unexpected error')
  }
}
main()
