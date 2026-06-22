/**
 * Element utility functions for the PowerPoint viewer/editor.
 *
 * The framework-agnostic helpers (template detection, inline-text eligibility,
 * labels, comment timestamp/marker, connection sites) live in
 * `pptx-viewer-shared` and are re-exported here. `isConnectorOrLineElement`
 * stays local because it depends on this binding's shape-type classifier
 * (`getShapeType`), which is not a core export.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import { getShapeType } from './shape-types';

export {
	isTemplateElement,
	isTemplateElementId,
	isEditableTextElement,
	getElementLabel,
	formatCommentTimestamp,
	getCommentMarkerPosition,
	getConnectionSitePosition,
} from 'pptx-viewer-shared';

/**
 * Returns true if the element is a connector or line, i.e. it renders
 * as an SVG path rather than a filled rectangular box.  These elements
 * need special hit-testing and selection treatment.
 */
export function isConnectorOrLineElement(element: PptxElement): boolean {
	if (element.type === 'connector') {
		return true;
	}
	if (!hasShapeProperties(element)) {
		return false;
	}
	const st = getShapeType(element.shapeType);
	return st === 'connector' || st === 'line' || element.shapeType === 'line';
}
