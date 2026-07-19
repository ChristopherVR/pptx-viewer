/**
 * Internal re-export of the `pptx-viewer-shared/ai` subpath.
 *
 * `pptx-viewer-shared` is an INTERNAL, non-published package; its source is
 * vendored into `./shared-src` at build time by `scripts/inline-shared.mjs`.
 * The main {@link ./shared} barrel re-exports `shared-src/index`, which does
 * NOT surface the `/ai` subpath (a deliberately separate entry point whose only
 * runtime dependency, the `ai` SDK, is optional and dynamically loaded). This
 * barrel exposes the AI symbols to the Angular sources the same way, so they
 * import from `'../internal/shared-ai'` rather than the bare
 * `'pptx-viewer-shared/ai'` specifier (which ng-packagr would externalize).
 */
export * from './shared-src/ai/index';
