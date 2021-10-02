import { customComponentsNext, builder, server } from './utils/index'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
  .scriptName('sveasy')
  .usage('$0 <command> [options]')
  .command('build', 'builds in production')
  .command('dev', 'builds in development')
  .option('verbose', {
    alias: 'v',
    describe: 'Verbose output',
    type: 'boolean',
  })
  .option('custom-elements', {
    alias: 'ce',
    describe: 'Custom elements',
    type: 'boolean',
  })
  .help('h')
  .alias('h', 'help')
  .demandCommand(1, 'You need at least one command before moving on')
  .parseSync()

switch (argv._[0]) {
  case 'build': {
    // check if argv.custom-elements is true
    if (argv.customElements) {
      customComponentsNext({ write: false, type: 'webcomponents' })
    } else {
      builder({ write: true, type: 'default' })
    }
    break
  }
  case 'dev':
    // throw error if argv.custom-elements is true
    if (argv.customElements) {
      throw new Error('Custom elements are not supported in dev mode')
    } else {
      server({ write: false, type: 'default' })
    }
    break
}
