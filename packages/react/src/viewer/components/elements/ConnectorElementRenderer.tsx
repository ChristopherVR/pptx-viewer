import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import {
	connectorWrapperTransform,
	getSelectionOutlineColor,
	svgLineCap,
} from 'pptx-viewer-shared';
import React from 'react';

import { DEFAULT_STROKE_COLOR } from '../../constants';
import {
	colorWithOpacity,
	getSvgStrokeDasharray,
	normalizeHexColor,
	normalizeStrokeDashType,
	buildLineShadowCss,
	buildLineGlowFilter,
} from '../../utils';
import { getAriaLabel, getAriaRole, getAriaRoleDescription } from '../../utils/accessibility';
import {
	getCompoundLineOffsets,
	getCompoundLineWidths,
	getConnectorPathGeometry,
	renderConnectorMarker,
} from '../../utils/shape-connector';
import { ConnectorTextOverlay } from './ConnectorTextOverlay';
import type { ConnectorRendererProps } from './element-renderer-types';
import { ResizeHandles } from './ResizeHandles';

export type { ConnectorRendererProps };

export const ConnectorElementRenderer: React.FC<ConnectorRendererProps> = React.memo(
	// oxlint-disable-next-line prefer-arrow-callback -- named fn gives the memo component its displayName
	function ConnectorElementRendererInner({
		el,
		isSelected,
		canInteract,
		showResizeHandles,
		showHoverBorder,
		selectionColorClass: selClr,
		opacity,
		zIndex,
		adjustmentHandles: adjH,
		onResizePointerDown,
		onAdjustmentPointerDown,
		animationState,
		textStyleOverrideCss,
	}) {
		const shapeEl = hasShapeProperties(el) ? el : undefined;
		// The wrapper keeps the AUTHORED extent (matching every other binding,
		// and what the shared `buildWrapperStyle`/parity fingerprint expect): a
		// degenerate connector must not measure taller/wider than PowerPoint
		// itself paints it. Grabbability for a zero-extent connector comes from
		// `hitTargetWidth` below (a widened invisible stroke), not from
		// inflating the box.
		//
		// The nested `<svg>` still needs its OWN width/height to exactly match
		// its viewBox: a `viewBox="0 0 1 145"` stretched across a wider/shorter
		// CSS box under `preserveAspectRatio="none"` scales one axis
		// disproportionately, which tilts the line off vertical and smears its
		// round `a:headEnd`/`a:tailEnd` markers into bars (issue #132). Floor
		// both at 1, matching the other four bindings, so a still-degenerate
		// (but never distorted) 1x145 SVG sits inside a 0x145 wrapper without
		// inflating what the wrapper measures.
		const viewWidth = Math.max(el.width, 0);
		const viewHeight = Math.max(el.height, 0);
		const svgWidth = Math.max(el.width, 1);
		const svgHeight = Math.max(el.height, 1);
		const ss = shapeEl?.shapeStyle;
		const strokeWidth = Math.max(0, ss?.strokeWidth ?? 2);
		const strokeColor = normalizeHexColor(ss?.strokeColor, DEFAULT_STROKE_COLOR);
		const strokePaint = colorWithOpacity(strokeColor, ss?.strokeOpacity);
		const dashType = normalizeStrokeDashType(ss?.strokeDash);
		const dashArray = getSvgStrokeDasharray(
			dashType,
			Math.max(strokeWidth, 1),
			ss?.customDashSegments,
		);
		const startArrow = ss?.connectorStartArrow;
		const endArrow = ss?.connectorEndArrow;
		const compoundLine = ss?.compoundLine;
		const markerSeed = el.id.replace(/[^a-zA-Z0-9_-]/gu, '_');
		const startMarkerId = `${markerSeed}-sel-start`;
		const endMarkerId = `${markerSeed}-sel-end`;

		const compoundOffsets = getCompoundLineOffsets(compoundLine, strokeWidth);
		const compoundWidths = getCompoundLineWidths(compoundLine, strokeWidth);
		const strokeCap = svgLineCap(ss?.lineCap);

		const textEl = hasTextProperties(el) ? el : undefined;
		const connectorText = textEl?.text?.trim() ?? '';
		const connectorTextSegments = textEl?.textSegments;
		const connectorTextStyle = textEl?.textStyle;

		const pathGeometry = shapeEl
			? getConnectorPathGeometry(shapeEl)
			: {
					pathData: `M 0 0 L ${viewWidth} ${viewHeight}`,
					startX: 0,
					startY: 0,
					endX: viewWidth,
					endY: viewHeight,
				};

		const hitTargetWidth = Math.max(strokeWidth * 3, 14);
		const selColor = selClr === 'blue-400' ? '#60a5fa' : '#3b82f6';
		const lineShadow = buildLineShadowCss(el);
		const lineGlow = buildLineGlowFilter(el);

		return (
			<div
				data-pptx-element='true'
				data-element-id={el.id}
				// The shared accessibility contract, which the other four bindings
				// stamp on a connector through their post-render DOM pass. React's
				// connector took a dedicated renderer that never applied it, so a
				// connector was the one element type with no role and no
				// `aria-roledescription` here: unreachable to a screen reader, and
				// invisible to every spec that addresses elements by their type.
				role={getAriaRole(el, { actionable: false })}
				aria-label={getAriaLabel(el)}
				aria-roledescription={getAriaRoleDescription(el)}
				aria-selected={isSelected ? true : undefined}
				className='absolute'
				style={{
					left: el.x,
					top: el.y,
					width: viewWidth,
					height: viewHeight,
					['--pptx-selection-width' as string]: `${viewWidth}px`,
					['--pptx-selection-height' as string]: `${viewHeight}px`,
					transform: connectorWrapperTransform(el),
					transformOrigin: 'center',
					background: 'transparent',
					border: 'none',
					pointerEvents: 'none',
					opacity,
					zIndex,
					visibility: animationState?.visible === false ? 'hidden' : 'visible',
					animation: animationState?.cssAnimation,
					...(lineGlow ? { filter: lineGlow } : {}),
				}}
			>
				{/* A font-style emphasis effect (Bold Flash, Bold Reveal, Underline,
				    Change Font Style/Size) overrides the caption's own inline
				    bold/italic/underline/size, which plain CSS inheritance cannot
				    reach. See `animation-text-style-css.ts`. */}
				{textStyleOverrideCss && <style>{textStyleOverrideCss}</style>}
				<svg
					width={svgWidth}
					height={svgHeight}
					viewBox={`0 0 ${svgWidth} ${svgHeight}`}
					preserveAspectRatio='none'
					style={{ overflow: 'visible', pointerEvents: 'none' }}
				>
					<defs>
						{renderConnectorMarker(
							startMarkerId,
							startArrow,
							strokePaint,
							ss?.connectorStartArrowWidth,
							ss?.connectorStartArrowLength,
						)}
						{renderConnectorMarker(
							endMarkerId,
							endArrow,
							strokePaint,
							ss?.connectorEndArrowWidth,
							ss?.connectorEndArrowLength,
						)}
						{lineShadow && (
							<filter id={`${markerSeed}-line-shadow`} x='-50%' y='-50%' width='200%' height='200%'>
								<feDropShadow
									dx={ss?.lineShadowOffsetX ?? 2}
									dy={ss?.lineShadowOffsetY ?? 2}
									stdDeviation={Math.max(0, (ss?.lineShadowBlur ?? 4) / 2)}
									floodColor={ss?.lineShadowColor ?? '#000000'}
									floodOpacity={ss?.lineShadowOpacity ?? 0.35}
								/>
							</filter>
						)}
					</defs>

					{isSelected && (
						<path
							d={pathGeometry.pathData}
							fill='none'
							stroke={getSelectionOutlineColor(selColor)}
							strokeWidth={Math.max(strokeWidth, 2) + 6}
							strokeOpacity={0.35}
							strokeLinecap='round'
							strokeLinejoin='round'
							vectorEffect='non-scaling-stroke'
							style={{ pointerEvents: 'none' }}
						/>
					)}

					{!isSelected && showHoverBorder && (
						<path
							d={pathGeometry.pathData}
							fill='none'
							stroke='#93c5fd'
							strokeWidth={Math.max(strokeWidth, 2) + 4}
							strokeOpacity={0}
							strokeLinecap='round'
							strokeLinejoin='round'
							vectorEffect='non-scaling-stroke'
							className='transition-[stroke-opacity] duration-150 group-hover:stroke-opacity-40'
							style={{ pointerEvents: 'none' }}
						/>
					)}

					<path
						d={pathGeometry.pathData}
						fill='none'
						stroke='transparent'
						strokeWidth={hitTargetWidth}
						strokeLinecap='round'
						strokeLinejoin='round'
						style={{
							pointerEvents: 'stroke',
							cursor: canInteract ? 'move' : 'default',
						}}
					/>

					{compoundOffsets.map((offset, idx) => (
						<path
							key={idx}
							d={pathGeometry.pathData}
							fill='none'
							stroke={strokePaint}
							strokeWidth={Math.max(compoundWidths[idx] ?? strokeWidth, 1)}
							strokeDasharray={dashArray}
							strokeLinecap={strokeCap}
							strokeLinejoin='round'
							markerStart={
								idx === 0 && startArrow && startArrow !== 'none'
									? `url(#${startMarkerId})`
									: undefined
							}
							markerEnd={
								idx === compoundOffsets.length - 1 && endArrow && endArrow !== 'none'
									? `url(#${endMarkerId})`
									: undefined
							}
							vectorEffect='non-scaling-stroke'
							filter={idx === 0 && lineShadow ? `url(#${markerSeed}-line-shadow)` : undefined}
							style={{
								pointerEvents: 'none',
								...(offset !== 0
									? {
											transform: `translate(0, ${offset}px)`,
										}
									: {}),
							}}
						/>
					))}

					{isSelected && (
						<>
							<circle
								cx={pathGeometry.startX}
								cy={pathGeometry.startY}
								r={4}
								fill={selColor}
								stroke='white'
								strokeWidth={1.5}
								style={{ pointerEvents: 'none' }}
							/>
							<circle
								cx={pathGeometry.endX}
								cy={pathGeometry.endY}
								r={4}
								fill={selColor}
								stroke='white'
								strokeWidth={1.5}
								style={{ pointerEvents: 'none' }}
							/>
						</>
					)}
				</svg>

				{connectorTextSegments && (
					<ConnectorTextOverlay
						connectorText={connectorText}
						connectorTextSegments={connectorTextSegments}
						connectorTextStyle={connectorTextStyle}
					/>
				)}

				{showResizeHandles && (
					<ResizeHandles
						elementId={el.id}
						adjustmentHandles={adjH}
						onResizePointerDown={onResizePointerDown}
						onAdjustmentPointerDown={onAdjustmentPointerDown}
						forcePointerEvents
					/>
				)}
			</div>
		);
	},
);
ConnectorElementRenderer.displayName = 'ConnectorElementRenderer';
