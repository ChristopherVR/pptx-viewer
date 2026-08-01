import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import {
	getGroupChildParentFill,
	isElementActionable,
	isElementRendered,
	LINK_TOOLTIP_HOST_CLASS,
} from 'pptx-viewer-shared';
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
import { ActionAffordances, useActionAffordance } from './elements/ActionAffordance';
import { ConnectorElementRenderer } from './elements/ConnectorElementRenderer';
import { getElementInteractionProps } from './elements/element-interaction-props';
import {
	renderDagDuotoneFilterForElement,
	getContainerStyle,
} from './elements/element-renderer-helpers';
import type { ElementRendererProps } from './elements/element-renderer-types';
import { shapeParams } from './elements/element-shape-params';
import { renderBody } from './elements/ElementBody';
import { Extrusion3DOverlay } from './elements/Extrusion3DOverlay';
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

		// Authoring chrome for an Action Setting (amber badge + hover tooltip).
		// Resolved through shared so all five bindings agree on when it shows and
		// what it says; a hook, so it must sit above the early returns below.
		const actionAffordance = useActionAffordance(el, canInteract);

		const [isMediaPlaying, setIsMediaPlaying] = useState(false);
		const handleMediaPlayStateChange = useCallback((playing: boolean): void => {
			setIsMediaPlaying(playing);
		}, []);

		// The Selection Pane hid this element: draw nothing at all, exactly as
		// PowerPoint does. Skipping the subtree (rather than painting it with
		// `visibility: hidden`) is what keeps it out of hit-testing, the tab
		// order, the accessibility tree, and the html2canvas export raster. The
		// element is still listed in and selectable from the Selection Pane,
		// which reads the slide model rather than the rendered DOM.
		//
		// Placed after the hooks above, never before them: an early return at the
		// top of the component would make those hook calls conditional on a flag
		// the user toggles at runtime.
		if (!isElementRendered(el)) {
			return null;
		}

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
		const isZoom = el.type === 'zoom' && Boolean(onZoomClick);
		// The actionable rule itself lives in shared, so the four non-React
		// bindings (which classify in a post-render DOM pass) reach the same
		// verdict for the same deck instead of re-deriving it, or not at all.
		const isActionable = isElementActionable(el, {
			hasActionHandler: Boolean(onActionClick),
			hasHyperlinkHandler: Boolean(onHyperlinkClick),
			hasZoomHandler: Boolean(onZoomClick),
		});

		// Selection / hover affordance. Drawn as an `outline` inset by 1px so it
		// lands exactly where the old 1px border did WITHOUT participating in
		// layout: as a border it was consuming 2px of every unstroked element's
		// content box (`box-sizing: border-box`), leaving shapes 2px small and
		// 1px off-origin versus PowerPoint.
		const selB = isSelected
			? `outline-1 -outline-offset-1 outline-${selClr} ring-2 ring-${selClr}/50`
			: showHoverBorder
				? 'outline-1 -outline-offset-1 outline-transparent hover:outline-primary/40'
				: '';
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

		const ariaRole = getAriaRole(el, { actionable: isActionable });
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
				// The neutral marker `PRESENTATION_INERT_CLICK_SELECTOR` keys off, so
				// a tap or swipe on an action shape never ALSO steps the show on.
				// `StaticElementRenderer` and the four non-React bindings' DOM pass
				// stamp the same attribute.
				data-pptx-action={isActionable ? 'click' : undefined}
				role={ariaRole}
				aria-label={ariaLabel}
				aria-roledescription={ariaRoleDescription}
				aria-selected={isSelected ? true : undefined}
				tabIndex={isFocusable ? 0 : -1}
				className={cn(
					'absolute',
					'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
					cur,
					effectiveCanInteract || isActionable ? '' : 'pointer-events-none',
					isFullscreenMedia ? 'pointer-events-auto' : '',
					selB,
					// Shared class the tooltip's `:hover` rule keys off (see
					// `ACTION_AFFORDANCE_CSS`), replacing React's Tailwind `group/link`
					// so the four non-Tailwind bindings reveal it the same way.
					actionAffordance.showLinkTooltip && LINK_TOOLTIP_HOST_CLASS,
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
							// A morph pairs a `!!`-named shape across a grouping boundary
							// (shared `morph-flatten`) and keys the animation by the
							// CHILD's id, so the child needs both its own animation and a
							// `data-element-id` to be addressable - the group node alone
							// cannot express a child moving independently of its siblings.
							animation={presentationElementStates?.get(child.id)?.cssAnimation}
							exposeElementId
							parentGroupFill={getGroupChildParentFill(el)}
							// A grouped child keeps its own `a:hlinkClick`; PowerPoint
							// treats it as an individually clickable target even though
							// the group is a single selectable object. Only wire it up
							// where the group itself is not the action target, so a
							// child link cannot shadow one set on the group.
							onActionClick={el.actionClick ? undefined : onActionClick}
							actionRequiresModifier={effectiveCanInteract}
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
				<ActionAffordances affordance={actionAffordance} />
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
