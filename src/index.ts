import { builder, server } from './utils/index';

export const main = (): void => {
  const argv = process.argv.slice(2)
  console.log(argv)
  if (!argv[0]) throw new Error('invalid arguments')
  if (argv[0] !== 'dev' && argv[0] !== 'build') throw new Error('invalid arguments')
  if (argv[0] === 'dev') {
    console.log('serving in dev mode')
    server()
  } else if (argv[0] === 'build') {
    console.log('building in prod mode')
    if(argv[1] && argv[1] === '--wc'){
      builder({write: false})
    }
    builder({write: true})
  } else {
    throw new Error('unexpected error')
  }
}
main()
