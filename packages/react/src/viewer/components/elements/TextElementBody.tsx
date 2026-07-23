import { getLinkedTextBoxSegments, hasTextProperties } from 'pptx-viewer-core';
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
		slideElements,
	} = options;
	const isLinkedTextBox = hasTextProperties(el) && el.linkedTxbxId !== undefined;
	const linkedSegments =
		isLinkedTextBox && slideElements ? getLinkedTextBoxSegments(el, slideElements) : undefined;
	const useSvgWarp = shouldUseSvgWarp(
		hasTextProperties(el) ? el.textStyle?.textWarpPreset : undefined,
	);
	const scene3dStyle = hasTextProperties(el) ? buildTextBody3DSceneStyle(el.textStyle) : undefined;
	// `a:bodyPr/@rot` rotates the whole text body (degrees, clockwise positive).
	const bodyRotation = hasTextProperties(el) ? el.textStyle?.textBodyRotation : undefined;
	const rotationTransform =
		typeof bodyRotation === 'number' && Number.isFinite(bodyRotation) && bodyRotation !== 0
			? `rotate(${bodyRotation}deg)`
			: undefined;
	const composedTransform =
		[rotationTransform, getTextCompensationTransform(el), scene3dStyle?.transform]
			.filter(Boolean)
			.join(' ') || undefined;
	const transformStyle: React.CSSProperties = {
		transform: composedTransform,
		transformOrigin: 'center',
		...(scene3dStyle?.perspective ? { perspective: scene3dStyle.perspective } : {}),
		...(scene3dStyle?.transformStyle ? { transformStyle: scene3dStyle.transformStyle } : {}),
		...(isLinkedTextBox ? { overflow: 'hidden' } : {}),
	};
	const shapeType = 'shapeType' in el ? (el as { shapeType?: string }).shapeType : undefined;
	const shouldRenderText = isTxtEl || (hasTextProperties(el) && Boolean(el.promptText));

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
						)}
					</div>
				))}
		</>
	);
}
