/**
 * Build-time constant injected by `tsup.config.ts` (esbuild `define`), set to
 * this package's own `package.json` version. Read by File > Account's About
 * panel; never referenced at type-check time as a real runtime import so the
 * published `.d.ts` output stays standalone.
 */
declare const __PPTX_PACKAGE_VERSION__: string;
