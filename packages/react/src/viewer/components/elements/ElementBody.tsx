import type {
	ContentPartPptxElement,
	GroupPptxElement,
	Model3DPptxElement,
	OlePptxElement,
	PptxElement,
	PptxSlide,
	TextStyle,
	ZoomPptxElement,
} from 'pptx-viewer-core';
import { hasTextProperties, isInkElement, getLinkedTextBoxSegments } from 'pptx-viewer-core';
import React from 'react';

import { DEFAULT_TEXT_COLOR } from '../../constants';
import type { TableCellEditorState } from '../../types';
import {
	cn,
	getTextCompensationTransform,
	getTextLayoutStyle,
	getTextWarpStyle,
	renderChartElement,
	renderMediaElement,
	renderTableElement,
	renderTextSegments,
	shouldRenderFallbackLabel,
	getElementLabel,
} from '../../utils';
import type { ElementAnimationState } from '../../utils/animation-timeline';
import type { TableStyleContext } from '../../utils/table-parse';
import { buildTextBody3DSceneStyle } from '../../utils/text-effects';
import type { FieldSubstitutionContext } from '../../utils/text-field-substitution';
import type { ElementFindHighlights } from '../../utils/text-segment-helpers';
import { shouldUseSvgWarp, WarpedText } from '../../utils/text-warp';
import { ActionButtonGlyphOverlay, isActionButtonShape } from './ActionButtonGlyphOverlay';
import { renderImg } from './ImageRenderer';
import { renderInk, renderGroup, renderContentPart, renderOleElement } from './InkGroupRenderers';
import { InlineTextEditor } from './InlineTextEditor';
import { Model3DRenderer } from './Model3DRenderer';
import { SmartArtRenderer } from './SmartArtRenderer';
import { ZoomElementRenderer } from './ZoomElementRenderer';

export function renderBody(
	el: PptxElement,
	isImg: boolean,
	isEditing: boolean,
	editText: string,
	spellCheck: boolean,
	txtSE: TextStyle | undefined,
	txtS: React.CSSProperties,
	vecShape: React.ReactNode,
	imgStyle: React.CSSProperties,
	imgFilter: string | undefined,
	imgOpacity: number | undefined,
	imgAlt: string,
	isTxtEl: boolean,
	media: Map<string, string>,
	tableSt: TableCellEditorState | null | undefined,
	isSel: boolean,
	doInk: boolean,
	doGrp: boolean,
	onEditChange: (t: string) => void,
	onCommit: () => void,
	onCancel: () => void,
	onCellSel?: (c: TableCellEditorState | null) => void,
	onCellCommit?: (rowIndex: number, colIndex: number, text: string) => void,
	onColResize?: (newWidths: number[]) => void,
	onRowResize?: (rowIndex: number, newHeight: number) => void,
	findHl?: ElementFindHighlights,
	onHyperlinkClick?: (url: string) => void,
	isPresentationPassive?: boolean,
	handleMediaPlayStateChange?: (isPlaying: boolean) => void,
	presentationElementStates?: ReadonlyMap<string, ElementAnimationState>,
	/** All elements on the current slide, used for linked text box overflow distribution. */
	slideElements?: readonly PptxElement[],
	/** All slides in the presentation, used for zoom element thumbnails. */
	allSlides?: readonly PptxSlide[],
	/** Callback fired when a zoom element is clicked in presentation mode. */
	onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void,
	/** Index of the slide that contains the current element (for zoom return navigation). */
	sourceSlideIndex?: number,
	/** Context for text field placeholder substitution (slide number, header/footer, etc.). */
	fieldContext?: FieldSubstitutionContext,
	/** Theme + table style map for resolving table band/header colours. */
	tableStyleContext?: TableStyleContext,
	/** Callback for inline formatting (Ctrl+B/I/U while editing). */
	onFormatText?: (updates: Partial<TextStyle>) => void,
): React.ReactNode {
	if (el.type === 'model3d') {
		return (
			<Model3DRenderer
				element={el as Model3DPptxElement}
				width={el.width}
				height={el.height}
				interactive={!isPresentationPassive}
			/>
		);
	}
	if (el.type === 'zoom') {
		return (
			<ZoomElementRenderer
				element={el as ZoomPptxElement}
				slides={allSlides as PptxSlide[] | undefined}
				isPresentationMode={isPresentationPassive}
				onZoomClick={onZoomClick}
				sourceSlideIndex={sourceSlideIndex}
			/>
		);
	}
	if (isImg) {
		return renderImg(el, imgStyle, imgFilter, imgAlt, imgOpacity);
	}
	if (isEditing) {
		return (
			<>
				{vecShape}
				<InlineTextEditor
					initialText={editText}
					spellCheck={spellCheck}
					rtl={txtSE?.rtl}
					textDirection={txtSE?.textDirection}
					textStyle={txtS}
					textStyleRaw={txtSE}
					layoutStyle={getTextLayoutStyle(el)}
					element={el}
					onCommit={onCommit}
					onCancel={onCancel}
					onEditChange={onEditChange}
					onFormatText={onFormatText}
				/>
			</>
		);
	}
	if (el.type === 'table') {
		return renderTableElement(el, txtS, {
			editable: isSel,
			selectedCell: isSel ? tableSt : null,
			onSelectCell: onCellSel,
			onCommitCellEdit: onCellCommit,
			onResizeColumns: onColResize,
			onResizeRow: onRowResize,
			styleCtx: tableStyleContext,
		});
	}
	if (el.type === 'chart') {
		return renderChartElement(el);
	}
	if (el.type === 'smartArt') {
		return <SmartArtRenderer element={el} />;
	}
	if (el.type === 'media') {
		return renderMediaElement(el, media, {
			autoPlay: isPresentationPassive,
			fullScreen: isPresentationPassive && Boolean(el.fullScreen),
			isPresentationMode: isPresentationPassive,
			onPlayStateChange: handleMediaPlayStateChange,
		});
	}
	if (doInk && isInkElement(el)) {
		return renderInk(el, {
			replay: isPresentationPassive,
			pressureSensitive: true,
		});
	}
	if (el.type === 'contentPart') {
		return renderContentPart(el as ContentPartPptxElement, {
			replay: isPresentationPassive,
		});
	}
	if (el.type === 'ole') {
		return renderOleElement(el as OlePptxElement);
	}
	if (doGrp && el.type === 'group' && (el as GroupPptxElement).children) {
		return renderGroup((el as GroupPptxElement).children);
	}
	if (shouldRenderFallbackLabel(el, isTxtEl)) {
		return (
			<div className='w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none'>
				{getElementLabel(el)}
			</div>
		);
	}

	// Linked text box chain: clip overflow so text does not spill beyond the frame.
	const isLinkedTxbx = hasTextProperties(el) && el.linkedTxbxId !== undefined;
	const linkedOverflowCss: React.CSSProperties = isLinkedTxbx ? { overflow: 'hidden' } : {};

	// Compute distributed text segments for linked text box chains.
	// When an element belongs to a chain, getLinkedTextBoxSegments returns the
	// slice of text that should render in this particular box after overflow
	// distribution. For non-linked elements this is undefined and rendering
	// falls back to the element's own textSegments.
	const linkedSegments =
		isLinkedTxbx && slideElements ? getLinkedTextBoxSegments(el, slideElements) : undefined;

	// Determine if the element should use SVG textPath-based warp rendering.
	const warpPreset = hasTextProperties(el) ? el.textStyle?.textWarpPreset : undefined;
	const useSvgWarp = shouldUseSvgWarp(warpPreset);

	// Text body 3D scene style (perspective + rotation from a:bodyPr/a:scene3d)
	const scene3dStyle = hasTextProperties(el) ? buildTextBody3DSceneStyle(el.textStyle) : undefined;

	// Compose transforms: flip compensation + 3D scene rotation
	const compensationTransform = getTextCompensationTransform(el);
	const composedTransform =
		[compensationTransform, scene3dStyle?.transform].filter(Boolean).join(' ') || undefined;

	// Scene3d CSS without the transform (perspective, transformStyle, etc.)
	const scene3dNonTransform: React.CSSProperties | undefined = scene3dStyle
		? {
				...(scene3dStyle.perspective ? { perspective: scene3dStyle.perspective } : {}),
				...(scene3dStyle.transformStyle ? { transformStyle: scene3dStyle.transformStyle } : {}),
			}
		: undefined;

	const shapeTypeForGlyph =
		'shapeType' in el ? (el as { shapeType?: string }).shapeType : undefined;
	const showActionButtonGlyph = isActionButtonShape(shapeTypeForGlyph);

	return (
		<>
			{vecShape}
			{showActionButtonGlyph && <ActionButtonGlyphOverlay element={el} />}
			{isTxtEl ? (
				useSvgWarp ? (
					<div
						className={cn(
							'relative z-10 w-full h-full',
							onHyperlinkClick ? '' : 'pointer-events-none',
						)}
						style={{
							...getTextLayoutStyle(el),
							transform: composedTransform,
							transformOrigin: 'center',
							...scene3dNonTransform,
							...linkedOverflowCss,
						}}
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
							transform: composedTransform,
							transformOrigin: 'center',
							...scene3dNonTransform,
							...linkedOverflowCss,
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
				)
			) : hasTextProperties(el) && el.promptText ? (
				useSvgWarp ? (
					<div
						className={cn(
							'relative z-10 w-full h-full',
							onHyperlinkClick ? '' : 'pointer-events-none',
						)}
						style={{
							...getTextLayoutStyle(el),
							transform: composedTransform,
							transformOrigin: 'center',
							...scene3dNonTransform,
							...linkedOverflowCss,
						}}
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
							transform: composedTransform,
							transformOrigin: 'center',
							...scene3dNonTransform,
							...linkedOverflowCss,
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
				)
			) : null}
		</>
	);
}
