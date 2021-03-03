import { builder, server } from './utils/index'

export const main = () => {
  const argv = process.argv.slice(2)
  console.log(argv)
  if (!argv[0]) throw new Error('invalid arguments')
  if (argv[0] !== 'dev' && argv[0] !== 'build') throw new Error('invalid arguments')
  if (argv[0] === 'dev') {
    console.log('serving in dev mode')
    server()
  } else if (argv[0] === 'build') {
    console.log('building in prod mode')
    builder()
  } else {
    throw new Error('unexpected error')
  }
}
main()
