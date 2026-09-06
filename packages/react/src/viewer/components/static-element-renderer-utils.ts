import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import {
	getAriaRole,
	isWedgeCalloutPresetShape,
	isElementActionable,
	paintedStrokeWidth,
	resolveGroupChildFill,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'react';

import { DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, DEFAULT_TEXT_COLOR } from '../constants';
import {
	buildCssGradientFromShapeStyle,
	getShapeVisualStyle,
	getTextStyleForElement,
	isConnectorOrLineElement,
	normalizeHexColor,
} from '../utils';

export function defaultTextColorForFill(fillColor: string): string {
	const hex = String(fillColor ?? '').replace(/^#/u, '');
	if (!/^[0-9a-f]{6}$/iu.test(hex)) {
		return DEFAULT_TEXT_COLOR;
	}
	const channels = [0, 2, 4]
		.map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
		.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
	const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
	return luminance > 0.179 ? DEFAULT_TEXT_COLOR : '#ffffff';
}

/** Fill / stroke / text-colour / visual-style derivation for a static element. */
export interface StaticElementVisualState {
	hasFill: boolean;
	fill: string;
	strokeWidth: number;
	stroke: string;
	visualStyle: CSSProperties;
	textStyle: ReturnType<typeof getTextStyleForElement>;
	isImage: boolean;
	letsTextOverflow: boolean;
	isCallout: boolean;
}

export function getStaticElementVisualState(
	element: PptxElement,
	parentGroupFill: ShapeStyle | undefined,
): StaticElementVisualState {
	const style = hasShapeProperties(element) ? element.shapeStyle : undefined;
	const hasFill =
		(style?.fillColor !== undefined && style.fillColor !== 'transparent') ||
		Boolean(buildCssGradientFromShapeStyle(style) || style?.fillGradient) ||
		(style?.fillMode === 'pattern' && Boolean(style.fillPatternPreset));
	const fill = normalizeHexColor(style?.fillColor, DEFAULT_FILL_COLOR);
	// Width-only fill-less <a:ln>: paint no outline (see shared stroke-paint).
	const strokeWidth = paintedStrokeWidth(style);
	const stroke = normalizeHexColor(style?.strokeColor, DEFAULT_STROKE_COLOR);
	const baseVisualStyle = getShapeVisualStyle(element, hasFill, fill, strokeWidth, stroke);
	// `a:grpFill`: a child with fillMode 'group' inherits the enclosing group's
	// fill. `getShapeVisualStyle` has no group branch, so override the resolved
	// background here from the shared resolver (no-op for non-grpFill children).
	const inheritedFill = resolveGroupChildFill(element, parentGroupFill);
	const visualStyle: CSSProperties = inheritedFill
		? {
				...baseVisualStyle,
				backgroundColor: inheritedFill.backgroundColor,
				backgroundImage: inheritedFill.backgroundImage,
				backgroundRepeat: inheritedFill.backgroundRepeat,
				backgroundSize: inheritedFill.backgroundSize,
				backgroundPosition: inheritedFill.backgroundPosition,
			}
		: baseVisualStyle;
	const textStyle = getTextStyleForElement(
		element,
		element.type === 'shape' && hasFill ? defaultTextColorForFill(fill) : DEFAULT_TEXT_COLOR,
	);
	const isImage = element.type === 'picture' || element.type === 'image';
	const letsTextOverflow =
		hasTextProperties(element) &&
		element.textStyle?.autoFitMode === 'shrink' &&
		(element.type === 'text' || element.locks?.txBox === true);
	const shapeType = hasShapeProperties(element) ? element.shapeType : undefined;
	const isCallout =
		isWedgeCalloutPresetShape(shapeType) ||
		String(shapeType ?? '')
			.toLowerCase()
			.includes('callout');

	return {
		hasFill,
		fill,
		strokeWidth,
		stroke,
		visualStyle,
		textStyle,
		isImage,
		letsTextOverflow,
		isCallout,
	};
}

/** Actionability / accessibility-contract state for a static element. */
export interface StaticElementInteractionState {
	action: PptxElement['actionClick'];
	isActionable: boolean;
	contractRole: string | undefined;
}

export function getStaticElementInteractionState(
	element: PptxElement,
	hasActionHandler: boolean,
	exposeElementId: boolean,
): StaticElementInteractionState {
	const action = element.actionClick;
	const isActionable = Boolean(action && hasActionHandler);
	// A node that exposes the element contract is a slide element in its own
	// right (a live-stage group child), so it carries the same shared role /
	// name model the other four bindings apply when they walk the flattened
	// element tree - otherwise a grouped shape is addressable but anonymous.
	// Overlay copies expose no id and stay on the plain actionable-only role.
	const contractRole = exposeElementId
		? getAriaRole(element, { actionable: isElementActionable(element) })
		: isActionable
			? 'button'
			: undefined;

	return { action, isActionable, contractRole };
}

export function getStaticElementWrapperClassName(
	element: PptxElement,
	visual: Pick<StaticElementVisualState, 'isImage' | 'letsTextOverflow' | 'isCallout'>,
	positioned: boolean,
	isActionable: boolean,
): string {
	// A straight connector has one extent of 0, so the wrapper below is
	// padded to 1px. Clipping that box throws away almost the whole
	// `non-scaling-stroke`, which is why connectors vanished from thumbnails
	// while the live stage (ConnectorElementRenderer, an unclipped
	// MIN_ELEMENT_SIZE box) drew them fine.
	const overflowClass =
		visual.isImage ||
		element.type === 'group' ||
		isConnectorOrLineElement(element) ||
		visual.isCallout ||
		visual.letsTextOverflow
			? ''
			: 'overflow-hidden';
	const pointerClass = isActionable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none';
	return `${positioned ? 'absolute' : 'relative'} ${overflowClass} ${pointerClass}`;
}
