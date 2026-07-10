import type { Component } from 'svelte';

import PowerPointViewerComponent from './PowerPointViewer.svelte';
import type { PowerPointViewerApi, PowerPointViewerProps } from './types';

/**
 * Explicitly-typed public export of the viewer component.
 *
 * `svelte-check` types the `.svelte` import precisely, but the plain
 * TypeScript pass that emits the published declaration files resolves
 * `.svelte` modules through a loose ambient shim (`src/shims-svelte.d.ts`).
 * Re-exporting through this annotated constant keeps the published `.d.ts`
 * fully typed regardless of which compiler produced it.
 */
export const PowerPointViewer: Component<PowerPointViewerProps, PowerPointViewerApi> =
	PowerPointViewerComponent as unknown as Component<PowerPointViewerProps, PowerPointViewerApi>;
