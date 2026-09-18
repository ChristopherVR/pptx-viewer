import type { Component } from 'svelte';

import CollaborationCursorsComponent from '../collab/components/CollaborationCursors.svelte';
import type {
	CollaborationCursorsProps,
	RemoteSelectionOverlayProps,
} from '../collab/components/props';
import RemoteSelectionOverlayComponent from '../collab/components/RemoteSelectionOverlay.svelte';
import EditorLayerComponent from './EditorLayer.svelte';
import type { EditorLayerProps, SlideCanvasProps, ViewerToolbarProps } from './props';
import type { RibbonProps } from './ribbon/ribbon-types';
import RibbonComponent from './ribbon/Ribbon.svelte';
import SlideCanvasComponent from './SlideCanvas.svelte';
import ViewerToolbarComponent from './ViewerToolbar.svelte';

/**
 * Explicitly-typed public exports of the standalone view components.
 *
 * Same rationale as `PowerPointViewer` in `../component.ts`: `svelte-check`
 * types `.svelte` imports precisely, but the plain TypeScript pass that emits
 * the published declaration files resolves `.svelte` modules through a loose
 * ambient shim (`src/shims-svelte.d.ts`), and the post-build Rollup
 * declaration bundling cannot resolve a raw `.svelte` specifier at all (no
 * `.svelte.d.ts` is emitted, which broke the library build on CI). Re-export
 * through annotated constants so the published `.d.ts` is fully typed and
 * free of `.svelte` specifiers.
 */
export const Ribbon: Component<RibbonProps> = RibbonComponent as unknown as Component<RibbonProps>;

export const ViewerToolbar: Component<ViewerToolbarProps> =
	ViewerToolbarComponent as unknown as Component<ViewerToolbarProps>;

export const SlideCanvas: Component<SlideCanvasProps> =
	SlideCanvasComponent as unknown as Component<SlideCanvasProps>;

export const CollaborationCursors: Component<CollaborationCursorsProps> =
	CollaborationCursorsComponent as unknown as Component<CollaborationCursorsProps>;

export const RemoteSelectionOverlay: Component<RemoteSelectionOverlayProps> =
	RemoteSelectionOverlayComponent as unknown as Component<RemoteSelectionOverlayProps>;

export const EditorLayer: Component<EditorLayerProps> =
	EditorLayerComponent as unknown as Component<EditorLayerProps>;
