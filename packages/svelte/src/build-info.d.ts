/**
 * Build-time constant injected via `vite.config.ts`'s `define`, sourced from
 * this package's own `package.json` `version` field. Used only by
 * `AccountPage.svelte`'s File > Account > About section.
 *
 * Not defined under Vitest (see `vitest.config.ts`); consumers must guard
 * with `typeof __PPTX_SVELTE_VIEWER_VERSION__ === 'string'` rather than
 * referencing it directly.
 */
declare const __PPTX_SVELTE_VIEWER_VERSION__: string;
