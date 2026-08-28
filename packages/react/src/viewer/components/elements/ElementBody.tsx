import type {
	ChartPptxElement,
	ContentPartPptxElement,
	GroupPptxElement,
	Model3DPptxElement,
	OlePptxElement,
	PptxSlide,
	ZoomPptxElement,
} from 'pptx-viewer-core';
import { isInkElement } from 'pptx-viewer-core';
import { getGroupChildParentFill, mediaTransportVisible } from 'pptx-viewer-shared';
import React from 'react';

import {
	getImageSurfaceStyle,
	getTextLayoutStyle,
	renderMediaElement,
	renderTableElement,
	shouldRenderFallbackLabel,
	getElementLabel,
} from '../../utils';
import { ChartElementView } from './ChartElementView';
import type { RenderBodyOptions } from './element-body-types';
import { renderImg } from './ImageRenderer';
import { renderInk, renderGroup, renderContentPart } from './InkGroupRenderers';
import { InlineTextEditor } from './InlineTextEditor';
import { Model3DRenderer } from './Model3DRenderer';
import { OleRenderer } from './OleRenderer';
import { SmartArtElement } from './SmartArtElement';
import { renderTextElementBody } from './TextElementBody';
import { ZoomElementRenderer } from './ZoomElementRenderer';

export type { RenderBodyOptions } from './element-body-types';

export function renderBody(options: RenderBodyOptions): React.ReactNode {
	const {
		el,
		isImg,
		isEditing,
		editText,
		spellCheck,
		txtSE,
		txtS,
		vecShape,
		imgStyle,
		imgFilter,
		imgOpacity,
		imgAlt,
		isTxtEl,
		media,
		tableSt,
		isSel,
		doInk,
		doGrp,
		renderGroupChild,
		onEditChange,
		onCommit,
		onCancel,
		onCellSel,
		onCellCommit,
		onColResize,
		onRowResize,
		isPresentationPassive,
		isStaticSurface,
		handleMediaPlayStateChange,
		allSlides,
		onZoomClick,
		sourceSlideIndex,
		tableStyleContext,
		onFormatText,
		canEditSmartArt,
		onUpdateSmartArtElement,
		canEditChart,
		onUpdateChartElement,
		presentationElementStates,
	} = options;
	// Per-element playback state, used to drive staged chart / SmartArt builds.
	const animationState = presentationElementStates?.get(el.id);
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
		return (
			<div className='absolute inset-0 pointer-events-none' style={getImageSurfaceStyle(el)}>
				{renderImg(el, imgStyle, imgFilter, imgAlt, imgOpacity)}
				{vecShape ? <div className='pointer-events-none absolute inset-0'>{vecShape}</div> : null}
			</div>
		);
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
		return (
			<ChartElementView
				element={el as ChartPptxElement}
				editable={Boolean(isSel && canEditChart)}
				onUpdateElement={onUpdateChartElement}
				animationState={animationState}
			/>
		);
	}
	if (el.type === 'smartArt') {
		return (
			<SmartArtElement
				element={el}
				canEdit={canEditSmartArt}
				onUpdateElement={onUpdateSmartArtElement}
				animationState={animationState}
			/>
		);
	}
	if (el.type === 'media') {
		return renderMediaElement(el, media, {
			autoPlay: isPresentationPassive && el.autoPlay === true,
			fullScreen: isPresentationPassive && Boolean(el.fullScreen),
			isPresentationMode: isPresentationPassive,
			// A still of a slide never carries a transport, whatever the canvas
			// does. The rule is shared so the five bindings cannot drift on it.
			showTransport: mediaTransportVisible({
				presenting: isPresentationPassive === true,
				preview: isStaticSurface === true,
				canvasTransport: true,
			}),
			// ...and never the play badge / placeholder box either: a still is
			// slide content, and the transition overlay paints one (issue #147).
			preview: isStaticSurface === true,
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
		return <OleRenderer element={el as OlePptxElement} />;
	}
	if (doGrp && el.type === 'group' && (el as GroupPptxElement).children) {
		if (renderGroupChild) {
			return (
				<div className='relative w-full h-full pointer-events-none'>
					{(el as GroupPptxElement).children.map(renderGroupChild)}
				</div>
			);
		}
		// Via the shared resolver, not the raw `groupFill`: a group whose own fill
		// is itself `a:grpFill` has nothing to hand down from here (there is no
		// enclosing group at this level), and passing the group-mode style on
		// would have its children resolve against a fill that is not one.
		return renderGroup((el as GroupPptxElement).children, getGroupChildParentFill(el));
	}
	if (shouldRenderFallbackLabel(el, isTxtEl)) {
		return (
			<div className='w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none'>
				{getElementLabel(el)}
			</div>
		);
	}

	return renderTextElementBody(options);
}
