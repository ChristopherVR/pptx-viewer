/**
 * Internal re-export of `pptx-viewer-shared`.
 *
 * `pptx-viewer-shared` is an INTERNAL, non-published package (`"private": true`).
 * Its source is vendored into `./shared-src` at build time by
 * `scripts/inline-shared.mjs` (a generated, git-ignored directory), so the
 * shared code compiles as part of THIS library and ships **inlined** in the
 * published FESM. As a result `pptx-viewer-shared` never appears in the
 * published `package.json`.
 *
 * All Angular sources import shared symbols from THIS barrel, never from the
 * bare `'pptx-viewer-shared'` specifier (which ng-packagr would externalize).
 */
export * from './shared-src/index';
