import {
	ConnectorArrowType,
	getConnectorAdjustment as getCoreConnectorAdjustment,
	getConnectorPathGeometry as getCoreConnectorPathGeometry,
	PptxElementWithShapeStyle,
} from 'pptx-viewer-core';
import React from 'react';

import { ConnectorPathGeometry } from '../types';

// Connection-site geometry + compound-line helpers now live in
// `pptx-viewer-shared`; re-export them here to preserve the historical import
// surface for downstream connector code.
export {
	getConnectionSites,
	getCompoundLineOffsets,
	getCompoundLineWidths,
} from 'pptx-viewer-shared';

export function getConnectorAdjustment(
	element: PptxElementWithShapeStyle,
	key: string,
	fallback: number,
): number {
	return getCoreConnectorAdjustment(element, key, fallback);
}

export function getConnectorPathGeometry(
	element: PptxElementWithShapeStyle,
): ConnectorPathGeometry {
	return getCoreConnectorPathGeometry(element);
}

/** Map OOXML arrow size tokens to numeric scale factors. */
const ARROW_SIZE_SCALE: Record<string, number> = {
	sm: 0.6,
	med: 1.0,
	lg: 1.5,
};

export function renderConnectorMarker(
	markerId: string,
	arrowType: ConnectorArrowType | undefined,
	color: string,
	arrowWidth?: 'sm' | 'med' | 'lg',
	arrowLength?: 'sm' | 'med' | 'lg',
): React.ReactNode {
	if (!arrowType || arrowType === 'none') {
		return null;
	}

	const wScale = ARROW_SIZE_SCALE[arrowWidth || 'med'] ?? 1;
	const lScale = ARROW_SIZE_SCALE[arrowLength || 'med'] ?? 1;

	// Base marker size is 10x10 viewBox; scale the actual marker dimensions
	const mw = Math.round(8 * lScale);
	const mh = Math.round(8 * wScale);

	return (
		<marker
			id={markerId}
			markerWidth={mw}
			markerHeight={mh}
			refX={8}
			refY={5}
			orient='auto-start-reverse'
			viewBox='0 0 10 10'
			markerUnits='strokeWidth'
		>
			{arrowType === 'triangle' ? (
				<polygon points='0,0 10,5 0,10' fill={color} />
			) : arrowType === 'stealth' ? (
				<polygon points='0,0 10,5 0,10 3.4,5' fill={color} />
			) : arrowType === 'diamond' ? (
				<polygon points='0,5 5,0 10,5 5,10' fill={color} />
			) : arrowType === 'oval' ? (
				<ellipse cx={5} cy={5} rx={4} ry={3.3} fill={color} />
			) : (
				<path d='M0 0 L10 5 L0 10' fill='none' stroke={color} strokeWidth={1.6} />
			)}
		</marker>
	);
}
