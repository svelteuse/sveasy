import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { default as handleComponent } from './utils/component'
import { default as handleBuild } from './utils/build'
import { default as handleServe } from './utils/serve'

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
	.option('path', {
		alias: 'p',
		describe: 'Path to the component root folder [default: ./src/components]',
		type: 'string',
	})
	.help('h')
	.alias('h', 'help')
	.demandCommand(1, 'You need at least one command before moving on')
	.parseSync()

switch (argv._[0]) {
	case 'build': {
		// check if argv.custom-elements is true
		if (argv.customElements) {
			handleComponent({path: argv.path || 'src/components' })
		} else {
			handleBuild()
		}
		break
	}
	case 'dev':
		// throw error if argv.custom-elements is true
		if (argv.customElements) {
			throw new Error('Custom elements are not supported in dev mode')
		} else {
			handleServe({ port: '8080' })
		}
		break
}
