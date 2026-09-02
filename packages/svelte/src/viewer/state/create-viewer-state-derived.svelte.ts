import type { ViewerMode } from 'pptx-viewer-shared';
import { visibleTemplateElements } from 'pptx-viewer-shared';

import type { CollaborationController } from '../collab';
import type { EditorState } from '../editor/editor-state.svelte';
import type { CreateViewerStateOptions } from './create-viewer-state-types';
import { fitScale } from './navigation';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerState } from './viewer-state.svelte';

export interface ViewerDerivedDeps {
	loader: PresentationLoader;
	viewer: ViewerState;
	editor: EditorState;
	collab: CollaborationController;
	options: CreateViewerStateOptions;
	/** The live editable flag (not the raw host prop). */
	getEditable(): boolean;
}

/** Layout / zoom / mode values every part of the chrome reads, as live getters. */
export interface ViewerDerived {
	readonly scale: number;
	readonly effectivePercent: number;
	readonly displaySlides: EditorState['renderedSlides'];
	readonly activeSlide: EditorState['renderedSlides'][number] | undefined;
	readonly chromeVisible: boolean;
	readonly editingActive: boolean;
	readonly showRibbon: boolean;
	readonly viewerMode: ViewerMode;
}

/**
 * The viewer's derived view state (canvas scale, zoom percent, the rendered
 * slide array, chrome/editing/ribbon visibility, the resolved mode) plus the
 * `$effect`s that report the ones the host subscribes to. Split out of
 * `createViewerState` to keep that file under the repo's file-size budget.
 *
 * Every value is returned as a getter, not a snapshot, so a consumer reading
 * `derived.scale` outside an effect still tracks it. Named `use*`, not
 * `build*`: it registers the host-notification effects.
 */
export function useViewerDerived(deps: ViewerDerivedDeps): ViewerDerived {
	const { loader, viewer, editor, collab, options } = deps;

	const fittedScale = $derived(
		fitScale(
			options.getViewportWidth(),
			options.getViewportHeight(),
			loader.canvasSize.width,
			loader.canvasSize.height,
			viewer.isFullscreen ? 0 : 24,
		),
	);
	// React parity: the user-facing zoom percent is relative to fit-to-viewport
	// (100% = fitted, the default), not to the slide's native pixel size.
	const scale = $derived(
		viewer.isFullscreen ? fittedScale : fittedScale * ((viewer.zoomPercent ?? 100) / 100),
	);
	const effectivePercent = $derived(Math.max(1, Math.round(viewer.zoomPercent ?? 100)));
	// Render the editable slide array (single source of truth), so committed
	// edits flow to the stage, thumbnails, and notes panel. Re-merged here
	// (not just `editor.renderedSlides`, which SAVE also reads and must keep
	// merging template edits unconditionally) so a slide with "Hide Background
	// Graphics" (`showMasterShapes === false`) drops its master/layout layer
	// from what's actually painted, without touching what gets saved.
	const displaySlides = $derived(
		editor.slides.map((slide) => {
			const template = visibleTemplateElements(
				slide,
				editor.templateElementsBySlideId[slide.id] ?? [],
			);
			return template.length > 0 ? { ...slide, elements: [...template, ...slide.elements] } : slide;
		}),
	);
	const activeSlide = $derived(displaySlides[viewer.current]);
	const chromeVisible = $derived(!viewer.isFullscreen);
	const editingActive = $derived(deps.getEditable() && !viewer.isFullscreen && !collab.readOnly);
	// The ribbon replaces the lean `ViewerToolbar` once a presentation is loaded
	// (React parity: the full ribbon renders for read-only decks too, with a
	// read-only badge and inert edits); only the empty/loading state keeps the
	// compact viewer chrome, and presentation mode hides all chrome.
	const showRibbon = $derived(loader.slides.length > 0);
	const viewerMode = $derived<ViewerMode>(
		editor.masterViewTarget
			? 'master'
			: viewer.isFullscreen
				? 'present'
				: deps.getEditable()
					? 'edit'
					: 'preview',
	);

	$effect(() => options.ondirtychange?.(editor.dirty));
	$effect(() => options.onmodechange?.(viewerMode));
	$effect(() => options.onzoomchange?.(effectivePercent / 100));
	$effect(() => options.onselectionchange?.([...editor.selection.ids]));
	$effect(() => options.onslidecountchange?.(displaySlides.length));

	return {
		get scale() {
			return scale;
		},
		get effectivePercent() {
			return effectivePercent;
		},
		get displaySlides() {
			return displaySlides;
		},
		get activeSlide() {
			return activeSlide;
		},
		get chromeVisible() {
			return chromeVisible;
		},
		get editingActive() {
			return editingActive;
		},
		get showRibbon() {
			return showRibbon;
		},
		get viewerMode() {
			return viewerMode;
		},
	};
}
