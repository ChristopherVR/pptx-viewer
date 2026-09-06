import { hasTextProperties } from 'pptx-viewer-core';
import {
	getOverflowSegments,
	getTextBodyRotationTransform,
	isLinkedTextBox as isLinkedTextBoxElement,
	placeholderPromptDescriptor,
} from 'pptx-viewer-shared';
import React from 'react';

import { DEFAULT_TEXT_COLOR } from '../../constants';
import {
	cn,
	getTextCompensationTransform,
	getTextLayoutStyle,
	getTextWarpStyle,
	renderTextSegments,
} from '../../utils';
import { buildTextBody3DSceneStyle } from '../../utils/text-effects';
import { shouldUseSvgWarp, WarpedText } from '../../utils/text-warp';
import { ActionButtonGlyphOverlay, isActionButtonShape } from './ActionButtonGlyphOverlay';
import type { RenderBodyOptions } from './element-body-types';

export function renderTextElementBody(options: RenderBodyOptions): React.ReactNode {
	const {
		el,
		vecShape,
		isTxtEl,
		txtS,
		txtSE,
		findHl,
		onHyperlinkClick,
		fieldContext,
		presentationElementStates,
		isPresentationPassive,
		placeholderPromptMode = 'present',
		slideElements,
	} = options;
	// `a:linkedTxbx` overflow now resolves through `pptx-viewer-shared` so all
	// five bindings distribute a chain's text through the one implementation.
	// Behaviour is unchanged: the shared helper returns `undefined` for a
	// non-chain element and for a missing sibling list, which is exactly what the
	// guard this replaced computed.
	const isLinkedTextBox = isLinkedTextBoxElement(el);
	const linkedSegments = getOverflowSegments(el, slideElements);
	const useSvgWarp = shouldUseSvgWarp(
		hasTextProperties(el) ? el.textStyle?.textWarpPreset : undefined,
	);
	const scene3dStyle = hasTextProperties(el)
		? buildTextBody3DSceneStyle(el.textStyle, { width: el.width, height: el.height })
		: undefined;
	// `a:bodyPr/@rot` rotates the whole text body (degrees, clockwise positive).
	// Through shared since wave 4: the same rotation now reaches vue, angular,
	// svelte and vanilla, which all painted a rotated body upright.
	const rotationTransform = getTextBodyRotationTransform(el);
	const composedTransform =
		[rotationTransform, getTextCompensationTransform(el), scene3dStyle?.transform]
			.filter(Boolean)
			.join(' ') || undefined;
	const transformStyle: React.CSSProperties = {
		transform: composedTransform,
		// A COM-measured homography (`scene3dStyle.transformOrigin === '0 0'`)
		// MUST win over the default centred origin, or the matrix3d's baked-in
		// translation (relative to the element's own top-left) is applied from
		// the wrong pivot and the projection is wrong (see
		// `visual-3d-camera-homography`'s module doc comment). This used to be
		// hardcoded to `'center'` unconditionally, silently clobbering
		// `scene3dStyle.transformOrigin` the same way Svelte's `ElementRenderer`
		// once re-clobbered `pointerEvents` from its own interactive flag.
		transformOrigin: scene3dStyle?.transformOrigin ?? 'center',
		...(scene3dStyle?.perspective ? { perspective: scene3dStyle.perspective } : {}),
		// COM-calibrated off-axis correction for a handful of camera presets
		// (see `visual-3d-camera`'s module doc comment); only reachable when an
		// explicit `a:camera/a:rot`/`@fov`/`@zoom` override sits alongside one of
		// those presets, since the homography path above never sets it.
		...(scene3dStyle?.perspectiveOrigin
			? { perspectiveOrigin: scene3dStyle.perspectiveOrigin as string }
			: {}),
		...(scene3dStyle?.transformStyle ? { transformStyle: scene3dStyle.transformStyle } : {}),
		...(isLinkedTextBox ? { overflow: 'hidden' } : {}),
	};
	const shapeType = 'shapeType' in el ? (el as { shapeType?: string }).shapeType : undefined;
	// An empty inherited placeholder's greyed-out hint ("Click to add title").
	// Shared owns the surface rule (editing canvas only); a non-text shape that
	// carries nothing but the hint still needs a text body to show it in.
	const placeholderPrompt = placeholderPromptDescriptor(el, placeholderPromptMode);
	const shouldRenderText = isTxtEl || placeholderPrompt !== null;

	return (
		<>
			{vecShape}
			{isActionButtonShape(shapeType) && <ActionButtonGlyphOverlay element={el} />}
			{shouldRenderText &&
				(useSvgWarp ? (
					<div
						className={cn(
							'relative z-10 w-full h-full',
							onHyperlinkClick ? '' : 'pointer-events-none',
						)}
						style={{ ...getTextLayoutStyle(el), ...transformStyle }}
					>
						<WarpedText
							element={el}
							width={el.width}
							height={el.height}
							fallbackColor={DEFAULT_TEXT_COLOR}
							findHighlights={findHl}
							fieldContext={fieldContext}
						/>
					</div>
				) : (
					<div
						className={cn(
							'relative z-10 w-full h-full whitespace-pre-wrap break-words leading-[1.3]',
							onHyperlinkClick ? '' : 'pointer-events-none',
						)}
						style={{
							...getTextLayoutStyle(el),
							...txtS,
							...getTextWarpStyle(txtSE),
							...transformStyle,
						}}
					>
						{renderTextSegments(
							el,
							DEFAULT_TEXT_COLOR,
							undefined,
							findHl,
							onHyperlinkClick,
							fieldContext,
							presentationElementStates,
							linkedSegments ?? undefined,
							!isPresentationPassive,
							placeholderPrompt,
						)}
					</div>
				))}
		</>
	);
}
