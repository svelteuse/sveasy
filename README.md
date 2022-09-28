<h1 align="center">Welcome to sveasy 👋</h1>
<p>
  <a href="https://www.npmjs.com/package/sveasy" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/sveasy.svg">
  </a>
  <img src="https://img.shields.io/badge/node-%3E14.x-blue.svg" />
  <a href="https://github.com/svelteuse/sveasy#readme" target="_blank">
    <img alt="Documentation" src="https://img.shields.io/badge/documentation-yes-brightgreen.svg" />
  </a>
  <a href="https://github.com/svelteuse/sveasy/graphs/commit-activity" target="_blank">
    <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" />
  </a>
  <a href="https://github.com/svelteuse/sveasy/blob/master/LICENSE" target="_blank">
    <img alt="License: ISC" src="https://img.shields.io/github/license/alexanderniebuhr/sveasy" />
  </a>
  <a href="https://twitter.com/realalexniebuhr" target="_blank">
    <img alt="Twitter: realalexniebuhr" src="https://img.shields.io/twitter/follow/realalexniebuhr.svg?style=social" />
  </a>
</p>

> Opiniated &#34;bundler&#34; for svelte projects using nativ esbuild, without any comfortable features like others have

### 🏠 [Homepage](https://github.com/svelteuse/sveasy#readme)

## Prerequisites

- node >14.x

## Install

```sh
npm i -D sveasy
```

## Usage

```sh
sveasy <cmd> [options]
```

## Author

👤 **Alexander Niebuhr**

* Website: https://nbhr.io
* Twitter: [@realalexniebuhr](https://twitter.com/realalexniebuhr)
* Github: [@alexanderniebuhr](https://github.com/alexanderniebuhr)
* LinkedIn: [@alexanderniebuhr](https://linkedin.com/in/alexanderniebuhr)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/svelteuse/sveasy/issues). You can also take a look at the [contributing guide](https://github.com/svelteuse/sveasy/blob/master/CONTRIBUTING.md).

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2021 [Alexander Niebuhr](https://github.com/alexanderniebuhr).<br />
This project is [ISC](https://github.com/svelteuse/sveasy/blob/master/LICENSE) licensed.

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_


let examplePlugin = {
  name: 'example',
  setup(build) {
    console.log(build.esbuild.version)
    console.log(build.esbuild.transformSync('1+2'))
  },
}

let examplePlugin = {
  name: 'example',
  setup(build) {
    build.onResolve({ filter: /^example$/ }, async () => {
      const result = await build.resolve('./foo', { resolveDir: '/bar' })
      if (result.errors.length > 0) return result
      return { ...result, external: true }
    })
  },
}