import { type BuildOptions, build } from "esbuild";
const ESM_REQUIRE_SHIM = `
await (async () => {
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  /**
   * Shim entry-point related paths.
   */
  if (typeof globalThis.__filename === "undefined") {
    globalThis.__filename = fileURLToPath(import.meta.url);
  }
  if (typeof globalThis.__dirname === "undefined") {
    globalThis.__dirname = dirname(globalThis.__filename);
  }
  /**
   * Shim require if needed.
   */
  if (typeof globalThis.require === "undefined") {
    const { default: module } = await import("module");
    globalThis.require = module.createRequire(import.meta.url);
  }
})();
`;

/** Whether or not you're bundling. */
const bundle = true;

/** Tell esbuild to add the shim to emitted JS. */
const shimBanner = {
  "js": ESM_REQUIRE_SHIM
};

/**
 * ESNext + ESM, bundle: true, and require() shim in banner.
 */
const buildOptions: BuildOptions = {
  entryPoints: ["./src/index.ts"],
  external: ["esbuild"],
  format: "esm",
  platform: "node",
  target: "esnext",
  outfile: "./dist/index.mjs",
  banner: bundle ? shimBanner : undefined,
  bundle,
};

//esbuild src/index.ts --external:esbuild --format=esm --platform=node --target=esnext --outfile=dist/index.mjs --bundle --minify
build(buildOptions);