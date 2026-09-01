/**
 * activex-overlay-view.ts: how to draw an ActiveX control's placeholder on a
 * slide.
 *
 * `p:controls > p:control` (`PptxData`'s `slide.activeXControls`) cannot run
 * inside a viewer, so every binding needs to draw SOMETHING in its place: the
 * control's static fallback picture when core resolved one
 * (`mc:AlternateContent > mc:Fallback > p:pic`), otherwise a labelled
 * placeholder badge, so the slide shows where the control lives instead of a
 * blank gap. This was React-only (`ActiveXControlOverlay.tsx`); the other four
 * bindings rendered nothing for a slide carrying an ActiveX control.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports. Only the
 * pure geometry/label/fallback-image decision lives here; each binding maps
 * the returned view onto its own `<img>`/badge markup.
 */
import type { PptxActiveXControl } from 'pptx-viewer-core';

export interface ActiveXOverlaySlideSize {
	readonly width: number;
	readonly height: number;
}

/** `top`/`left` fallback spacing for a control with no fallback-picture geometry. */
const PLACEHOLDER_WIDTH = 120;
const PLACEHOLDER_HEIGHT = 40;
const PLACEHOLDER_STACK_GAP = 6;

export interface ActiveXControlOverlayView {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
	/** Display label: the control's authored name, or a generic fallback. */
	readonly label: string;
	/** The resolved fallback-picture URL, when one is available. */
	readonly imageUrl?: string;
	/**
	 * `'image'` when {@link imageUrl} is set (render an `<img>`), `'placeholder'`
	 * otherwise (render the labelled badge). A binding's template switches on
	 * this rather than re-deriving the same `Boolean(imageUrl)` check.
	 */
	readonly className: 'image' | 'placeholder';
}

/**
 * The geometry/label/fallback-image view for one ActiveX control overlay.
 *
 * @param control        One entry from `slide.activeXControls`.
 * @param slideSize      The slide's canvas size in px, used to clamp a
 *                        fallback picture that is larger than the slide.
 * @param index           This control's position within `slide.activeXControls`,
 *                        used only to stack multiple placeholder badges (a
 *                        control with no fallback-picture geometry) instead of
 *                        drawing them on top of one another. Ignored once the
 *                        control has its own `x`/`y`.
 * @param resolveFallbackImage Optional resolver mapping
 *                        `control.fallbackImageRelId` to a data URL. Omit it
 *                        (or return `undefined`) to always render the
 *                        placeholder badge.
 */
export function getActiveXControlOverlayView(
	control: PptxActiveXControl,
	slideSize: ActiveXOverlaySlideSize,
	index = 0,
	resolveFallbackImage?: (relId: string) => string | undefined,
): ActiveXControlOverlayView {
	const width = control.width ?? PLACEHOLDER_WIDTH;
	const height = control.height ?? PLACEHOLDER_HEIGHT;
	const left = control.x ?? 8;
	const top = control.y ?? 8 + index * (PLACEHOLDER_HEIGHT + PLACEHOLDER_STACK_GAP);
	const clampedWidth = Math.min(width, slideSize.width);
	const clampedHeight = Math.min(height, slideSize.height);
	const imageUrl = control.fallbackImageRelId
		? resolveFallbackImage?.(control.fallbackImageRelId)
		: undefined;
	const label = control.name || 'ActiveX control';

	return {
		left,
		top,
		width: clampedWidth,
		height: clampedHeight,
		label,
		imageUrl,
		className: imageUrl ? 'image' : 'placeholder',
	};
}
