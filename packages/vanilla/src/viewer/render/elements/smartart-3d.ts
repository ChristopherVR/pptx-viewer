import { resolveSmartArtThreeViewSpec } from 'pptx-viewer-shared';

import type { ElementRenderer } from '../types';
import { renderSmartArtSvg } from './smartart';
import { mountThreeViewInto } from './three-view';

/**
 * Opt-in 3D SmartArt renderer (gated on `context.smartArt3D`, threaded from
 * `PptxViewerOptions.smartArt3D`; see `smartart.ts` for the dispatch). The
 * flat SVG renders first and becomes the slotted fallback of a shared
 * `<pptx-three-view>`, which loads `three`, draws the diagram through the one
 * page-wide WebGL context and keeps the SVG when it cannot. A diagram with
 * nothing to draw stays plain SVG. Mirrors React's `SmartArt3DView.tsx`.
 *
 * Active font-style emphasis (`context.presentationStates`) reaches the
 * scene's canvas-drawn captions through the view's `textStyle`
 * (`animation-dom.ts` keeps it live during playback).
 */
export const renderSmartArt3DElement: ElementRenderer = (element, zIndex, context) => {
	const wrapper = renderSmartArtSvg(element, zIndex, context);
	const spec = wrapper ? resolveSmartArtThreeViewSpec(element, context.smartArt3D) : null;
	if (!wrapper || !spec) {
		return wrapper;
	}
	mountThreeViewInto(context.document, wrapper, {
		spec,
		interactive: Boolean(context.interactive) && !context.presenting,
		textStyle: context.presentationStates?.get(element.id)?.textStyle,
	});
	return wrapper;
};
