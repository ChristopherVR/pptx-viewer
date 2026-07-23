import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import { getGroupChildParentFill } from 'pptx-viewer-shared';
import React, { useState, useCallback, useMemo } from 'react';

import { DEFAULT_TEXT_COLOR } from '../constants';
import {
	cn,
	getImageEffectsFilter,
	getImageEffectsOpacity,
	getImageRenderStyle,
	getElementTransformWithoutRotation,
	getShapeVisualStyle,
	getTextStyleForElement,
	isConnectorOrLineElement,
	isEditableTextElement,
	renderVectorShape,
} from '../utils';
import { getAriaRole, getAriaLabel, getAriaRoleDescription } from '../utils/accessibility';
import { build3DExtrusionData } from '../utils/shape-visual-3d';
import { ConnectorElementRenderer } from './elements/ConnectorElementRenderer';
import { getElementInteractionProps } from './elements/element-interaction-props';
import {
	renderDagDuotoneFilterForElement,
	getContainerStyle,
	ActionIndicator,
	elementHasTextHyperlink,
} from './elements/element-renderer-helpers';
import type { ElementRendererProps } from './elements/element-renderer-types';
import { shapeParams } from './elements/element-shape-params';
import { renderBody } from './elements/ElementBody';
import { Extrusion3DOverlay } from './elements/Extrusion3DOverlay';
import { LinkTooltip } from './elements/LinkTooltip';
import { ResizeHandles } from './elements/ResizeHandles';
import { getScopedElementHandlers } from './elements/scoped-element-handlers';
import { ShapeEffectOverlay } from './elements/ShapeEffectOverlay';
import { StaticElementRenderer } from './StaticElementRenderer';

export type { ElementRendererProps } from './elements/element-renderer-types';
export { shapeParams } from './elements/element-shape-params';

export const ElementRenderer: React.FC<ElementRendererProps> = React.memo(
	// oxlint-disable-next-line prefer-arrow-callback -- named fn gives the memo component its displayName
	function ElementRendererInner({
		element: el,
		activeSlide,
		isSelected,
		isInlineEditing,
		inlineEditingText,
		canInteract,
		spellCheckEnabled,
		mediaDataUrls,
		tableEditorState,
		selectionColorClass: selClr,
		showHoverBorder,
		opacity,
		templateEditing,
		zIndex,
		imageAltText,
		showResizeHandles,
		renderInk: doInk,
		renderGroups: doGrp,
		adjustmentHandleDescriptor: adjH,
		onResizePointerDown,
		onAdjustmentPointerDown,
		onRotate,
		onInlineEditChange,
		onInlineEditCommit,
		onInlineEditCancel,
		onTableCellSelect,
		onCommitCellEdit,
		onUpdateSmartArtElement,
		onFormatText,
		onResizeTableColumns,
		onResizeTableRow,
		findHighlights,
		onActionClick,
		onHyperlinkClick,
		animationState,
		presentationElementStates,
		allSlides,
		onZoomClick,
		sourceSlideIndex,
		fieldContext,
		tableStyleContext,
	}) {
		const {
			cellSelectHandler,
			cellCommitHandler,
			colResizeHandler,
			rowResizeHandler,
			smartArtUpdateHandler,
		} = getScopedElementHandlers(el.id, {
			onTableCellSelect,
			onCommitCellEdit,
			onResizeTableColumns,
			onResizeTableRow,
			onUpdateSmartArtElement,
		});
		const chartUpdateHandler = smartArtUpdateHandler;
		const { hf, fc, sw, sc } = shapeParams(el);
		const elementLocks = el.locks;
		const isTxt = isEditableTextElement(el) && !elementLocks?.noTextEdit;
		const txtSE = hasTextProperties(el) ? el.textStyle : undefined;
		const ss = getShapeVisualStyle(
			el,
			hf,
			fc,
			sw,
			sc,
			animationState?.animatesFill,
			animationState?.animatesStroke,
		);
		const ts = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);
		const vs = renderVectorShape(
			el,
			hf,
			fc,
			sw,
			sc,
			animationState?.animatesFill,
			animationState?.animatesStroke,
		);
		const isImg = el.type === 'picture' || el.type === 'image';
		const isModel3D = el.type === 'model3d';
		const isConn = isConnectorOrLineElement(el);

		const shapeStyle3d = hasShapeProperties(el) ? el.shapeStyle : undefined;
		const extrusionData = useMemo(
			() =>
				build3DExtrusionData(shapeStyle3d?.shape3d, shapeStyle3d?.scene3d, fc, el.width, el.height),
			[shapeStyle3d?.shape3d, shapeStyle3d?.scene3d, fc, el.width, el.height],
		);

		const [isMediaPlaying, setIsMediaPlaying] = useState(false);
		const handleMediaPlayStateChange = useCallback((playing: boolean): void => {
			setIsMediaPlaying(playing);
		}, []);

		if (isConn) {
			return (
				<ConnectorElementRenderer
					el={el}
					isSelected={isSelected}
					canInteract={canInteract}
					showResizeHandles={showResizeHandles && !elementLocks?.noResize}
					showHoverBorder={showHoverBorder}
					selectionColorClass={selClr}
					opacity={opacity}
					zIndex={zIndex}
					adjustmentHandleDescriptor={adjH}
					onResizePointerDown={onResizePointerDown}
					onAdjustmentPointerDown={onAdjustmentPointerDown}
					animationState={animationState}
				/>
			);
		}

		const effectiveCanInteract = canInteract && !elementLocks?.noSelect;
		const effectiveShowResizeHandles = showResizeHandles && !elementLocks?.noResize;
		const effectiveIsInlineEditing = isInlineEditing && !elementLocks?.noTextEdit;
		const canEditSmartArt = effectiveCanInteract && !elementLocks?.noTextEdit;
		const canEditChart = effectiveCanInteract;

		const hasAction = Boolean(el.actionClick && onActionClick);
		const hasHoverAction = Boolean(el.actionHover);
		const hasHyperlinks = Boolean(onHyperlinkClick) && elementHasTextHyperlink(el);
		const isZoom = el.type === 'zoom' && Boolean(onZoomClick);
		const isActionable = hasAction || hasHoverAction || hasHyperlinks || isZoom;

		const selB = isSelected
			? `border-${selClr} ring-2 ring-${selClr}/50`
			: showHoverBorder
				? 'border-transparent hover:border-primary/40'
				: 'border-transparent';
		const cur = effectiveIsInlineEditing
			? 'cursor-text'
			: effectiveCanInteract
				? elementLocks?.noMove
					? 'cursor-default'
					: 'cursor-move'
				: hasAction || isZoom
					? 'cursor-pointer'
					: '';

		const isPresentationPassive = !effectiveCanInteract;
		const isFullscreenMedia =
			el.type === 'media' && Boolean(el.fullScreen) && isPresentationPassive && isMediaPlaying;

		const ariaRole = isActionable ? 'button' : getAriaRole(el);
		const ariaLabel = getAriaLabel(el);
		const ariaRoleDescription = getAriaRoleDescription(el);
		const isFocusable = effectiveCanInteract || isActionable;
		const interactionProps = getElementInteractionProps({
			element: el,
			isEditableText: isTxt,
			canInteract: effectiveCanInteract,
			isInlineEditing: effectiveIsInlineEditing,
			isActionable,
			isPresentationPassive,
			onInlineEditCancel,
			onActionClick,
		});

		return (
			<div
				data-pptx-element='true'
				data-element-id={el.id}
				role={ariaRole}
				aria-label={ariaLabel}
				aria-roledescription={ariaRoleDescription}
				aria-selected={isSelected ? true : undefined}
				tabIndex={isFocusable ? 0 : -1}
				className={cn(
					'absolute border',
					'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
					cur,
					effectiveCanInteract || isActionable ? '' : 'pointer-events-none',
					isFullscreenMedia ? 'pointer-events-auto' : '',
					selB,
					effectiveCanInteract && el.actionClick && 'group/link',
				)}
				style={getContainerStyle({
					el,
					isFullscreenMedia,
					isImg: isImg || isModel3D,
					zIndex,
					opacity,
					animationState,
					shapeVisualStyle: ss,
					has3DExtrusion: extrusionData.hasExtrusion,
					templateEditing,
				})}
				{...interactionProps}
			>
				{renderDagDuotoneFilterForElement(el)}
				<ShapeEffectOverlay element={el} />
				{extrusionData.hasExtrusion && <Extrusion3DOverlay data={extrusionData} />}
				{renderBody({
					el,
					isImg,
					isEditing: effectiveIsInlineEditing,
					editText: inlineEditingText,
					spellCheck: spellCheckEnabled,
					txtSE,
					txtS: ts,
					vecShape: vs,
					imgStyle: getImageRenderStyle(el),
					imgFilter: getImageEffectsFilter(el),
					imgOpacity: getImageEffectsOpacity(el),
					imgAlt: imageAltText,
					isTxtEl: isTxt,
					media: mediaDataUrls,
					tableSt: tableEditorState,
					isSel: isSelected,
					doInk,
					doGrp,
					renderGroupChild: (child, index) => (
						<StaticElementRenderer
							key={child.id}
							element={child}
							activeSlide={activeSlide}
							allSlides={allSlides}
							mediaDataUrls={mediaDataUrls}
							sourceSlideIndex={sourceSlideIndex}
							zIndex={index}
							parentGroupFill={getGroupChildParentFill(el)}
						/>
					),
					onEditChange: onInlineEditChange,
					onCommit: onInlineEditCommit,
					onCancel: onInlineEditCancel,
					onCellSel: cellSelectHandler,
					onCellCommit: cellCommitHandler,
					onColResize: colResizeHandler,
					onRowResize: rowResizeHandler,
					findHl: findHighlights,
					onHyperlinkClick,
					isPresentationPassive,
					handleMediaPlayStateChange,
					presentationElementStates,
					slideElements: activeSlide?.elements,
					allSlides,
					onZoomClick,
					sourceSlideIndex,
					fieldContext,
					tableStyleContext,
					canEditSmartArt,
					onUpdateSmartArtElement: smartArtUpdateHandler,
					canEditChart,
					onUpdateChartElement: chartUpdateHandler,
					onFormatText,
				})}
				{(el.actionClick || el.actionHover) && canInteract && (
					<ActionIndicator
						clickTooltip={el.actionClick?.tooltip}
						hoverTooltip={el.actionHover?.tooltip}
					/>
				)}
				{effectiveCanInteract && el.actionClick && (
					<LinkTooltip
						label={el.actionClick.tooltip || el.actionClick.url || el.actionClick.action || 'Link'}
						hasUrl={Boolean(el.actionClick.url)}
					/>
				)}
				{effectiveShowResizeHandles && !effectiveIsInlineEditing && (
					<ResizeHandles
						elementId={el.id}
						adjustmentHandleDescriptor={adjH}
						onResizePointerDown={onResizePointerDown}
						onAdjustmentPointerDown={onAdjustmentPointerDown}
						rotation={el.rotation}
						nonRotationTransform={getElementTransformWithoutRotation(el)}
						onRotate={elementLocks?.noRotation ? undefined : onRotate}
					/>
				)}
			</div>
		);
	},
);
