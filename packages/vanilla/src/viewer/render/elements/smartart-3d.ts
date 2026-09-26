import {
	elementInLocalFrame,
	resolveSmartArtThreeViewSpec,
	stripEditLayerMarkers,
} from 'pptx-viewer-shared';

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
 *
 * Inline node editing: the SVG becomes the view's fallback, hidden once the
 * scene is up, so while the diagram is editable a second SVG sits over the
 * scene in the element's local frame with its paint hidden. Its
 * `[data-smartart-node-id]` groups still take the double-click, so the same
 * textarea editor as the 2D path (`smartart-editable.ts`) opens over the node,
 * as React and Vue do over their 3D scenes.
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
	if (context.onSmartArtNodeTextChange && context.interactive && !context.presenting) {
		const layer = renderSmartArtSvg(elementInLocalFrame(element), 0, context);
		if (layer) {
			layer.classList.add('pptxv-smartart-3d-edit-layer');
			layer.setAttribute('data-smartart-3d-edit-layer', 'true');
			// One element, one set of markers: the layer is an input surface,
			// not a second copy of the diagram for tests or assistive tech.
			stripEditLayerMarkers(layer);
			layer.setAttribute('aria-hidden', 'true');
			Object.assign(layer.style, { position: 'absolute', inset: '0', zIndex: '1' });
			for (const svg of layer.querySelectorAll('svg')) {
				svg.style.opacity = '0';
			}
			wrapper.appendChild(layer);
		}
	}
	return wrapper;
};
