/**
 * VML (Vector Markup Language) shape parser.
 *
 * Converts legacy VML elements (`v:shape`, `v:rect`, `v:oval`, `v:line`,
 * `v:roundrect`, `v:polyline`, `v:arc`, `v:group`) found in older PPTX
 * files into the standard {@link PptxElement} types used by the viewer.
 *
 * VML is defined in ECMA-376 Part 4 and was the primary shape format
 * before DrawingML. Older .pptx files (pre-Office 2010) may contain VML
 * shapes as fallback content or as primary shape definitions.
 *
 * @module vml-parser
 */

import type {
	PptxElement,
	ShapePptxElement,
	GroupPptxElement,
	ShapeStyle,
	XmlObject,
} from '../types';
import { extractVmlFill, extractVmlStroke } from './vml-fill-stroke-parser';
import { convertVmlPathToSvg, parseVmlLine, parseVmlPolylinePoints } from './vml-path-converter';
import { mapVmlShapeType, vmlTagToShapeType } from './vml-shape-type-map';
import {
	parseVmlStyle,
	extractVmlBounds,
	extractVmlRotation,
	extractVmlFlip,
} from './vml-style-parser';
import { extractVmlText } from './vml-text-parser';

// ── Re-exports from sub-modules (backward compatibility) ─────────────

export {
	parseCssDimension,
	parseVmlStyle,
	extractVmlBounds,
	extractVmlRotation,
	extractVmlFlip,
} from './vml-style-parser';
export { parseVmlColor, parseVmlOpacity } from './vml-color-parser';
export { extractVmlFill, extractVmlStroke } from './vml-fill-stroke-parser';
export { convertVmlPathToSvg, parseVmlLine, parseVmlPolylinePoints } from './vml-path-converter';
export { mapVmlShapeType, vmlTagToShapeType } from './vml-shape-type-map';
export { extractVmlText, extractTextFromXmlNode } from './vml-text-parser';

/** VML element tag names we recognise as renderable shapes. */
export const VML_SHAPE_TAGS = new Set([
	'v:shape',
	'v:rect',
	'v:oval',
	'v:line',
	'v:roundrect',
	'v:polyline',
	'v:arc',
	'v:group',
	'v:image',
]);

/**
 * Parse a single VML shape element into a {@link PptxElement}.
 *
 * @param tag - The VML tag name (e.g. "v:shape", "v:rect")
 * @param node - The parsed XML node
 * @param idPrefix - ID prefix for the generated element
 * @param index - Index within this tag type (for unique IDs)
 */
export function parseVmlElement(
	tag: string,
	node: XmlObject,
	idPrefix: string,
	index: number,
): PptxElement | null {
	try {
		if (tag === 'v:group') {
			return parseVmlGroup(node, idPrefix, index);
		}

		const id = `${idPrefix}vml-${index}`;
		const styleMap = parseVmlStyle(String(node['@_style'] || ''));

		// Position and size
		let bounds: { x: number; y: number; width: number; height: number };
		if (tag === 'v:line') {
			bounds = parseVmlLine(node);
		} else {
			bounds = extractVmlBounds(styleMap);
		}

		// coordsize for path scaling
		const coordsize = String(node['@_coordsize'] || '').trim();
		let coordW = bounds.width;
		let coordH = bounds.height;
		if (coordsize.length > 0) {
			const parts = coordsize.split(/[\s,]+/);
			if (parts.length >= 2) {
				coordW = parseInt(parts[0], 10) || bounds.width;
				coordH = parseInt(parts[1], 10) || bounds.height;
			}
		}

		// Rotation and flip
		const rotation = extractVmlRotation(styleMap);
		const { flipHorizontal, flipVertical } = extractVmlFlip(styleMap);

		// Shape type
		let shapeType: string;
		if (tag === 'v:shape' || tag === 'v:image') {
			shapeType = mapVmlShapeType(
				String(node['@_o:spt'] || node['@_spt'] || ''),
				String(node['@_type'] || ''),
			);
		} else {
			shapeType = vmlTagToShapeType(tag);
		}

		// For v:roundrect, extract arc size as adjustment
		let shapeAdjustments: Record<string, number> | undefined;
		if (tag === 'v:roundrect') {
			const arcsize = String(node['@_arcsize'] || '').trim();
			if (arcsize.length > 0) {
				let pct = parseFloat(arcsize);
				if (arcsize.endsWith('%')) {
					pct = parseFloat(arcsize) / 100;
				}
				if (Number.isFinite(pct)) {
					shapeAdjustments = { adj: Math.round(pct * 50000) };
				}
			}
		}

		// Path data
		let pathData: string | undefined;
		let pathWidth: number | undefined;
		let pathHeight: number | undefined;

		if (tag === 'v:shape') {
			const vmlPath = String(node['@_path'] || '').trim();
			if (vmlPath.length > 0) {
				pathData = convertVmlPathToSvg(vmlPath, coordW, coordH, bounds.width, bounds.height);
				if (pathData) {
					shapeType = 'custom';
					pathWidth = bounds.width;
					pathHeight = bounds.height;
				}
			}
		} else if (tag === 'v:polyline') {
			pathData = parseVmlPolylinePoints(node, bounds.width, bounds.height);
			if (pathData) {
				shapeType = 'custom';
				pathWidth = bounds.width;
				pathHeight = bounds.height;
			}
		}

		// Fill and stroke
		const fillStyle = extractVmlFill(node);
		const strokeStyle = extractVmlStroke(node);
		const shapeStyle: ShapeStyle = { ...fillStyle, ...strokeStyle };

		// Visibility
		const visibilityHidden = styleMap['visibility'] === 'hidden' || styleMap['display'] === 'none';

		// Text
		const textResult = extractVmlText(node);

		const element: ShapePptxElement = {
			type: 'shape',
			id,
			x: bounds.x,
			y: bounds.y,
			width: bounds.width || 100,
			height: bounds.height || 100,
			shapeType,
			shapeStyle,
			shapeAdjustments,
			pathData,
			pathWidth,
			pathHeight,
			rotation,
			flipHorizontal,
			flipVertical,
			hidden: visibilityHidden || undefined,
			text: textResult?.text,
			textStyle: textResult?.textStyle,
			textSegments: textResult?.textSegments,
			rawXml: node,
		};

		return element;
	} catch (e) {
		console.warn(`[pptx] Skipping VML element (${tag}):`, e);
		return null;
	}
}

/**
 * Parse a `v:group` element as a {@link GroupPptxElement}.
 * Groups contain nested VML shapes and apply a coordinate transform.
 */
function parseVmlGroup(node: XmlObject, idPrefix: string, index: number): GroupPptxElement | null {
	try {
		const id = `${idPrefix}vml-group-${index}`;
		const styleMap = parseVmlStyle(String(node['@_style'] || ''));
		const bounds = extractVmlBounds(styleMap);

		const coordOrigin = String(node['@_coordorigin'] || '0,0');
		const coordSize = String(node['@_coordsize'] || '');
		const [originX, originY] = coordOrigin.split(/[\s,]+/).map((s) => parseFloat(s) || 0);

		let childScaleX = 1;
		let childScaleY = 1;
		if (coordSize.length > 0) {
			const [csW, csH] = coordSize.split(/[\s,]+/).map((s) => parseFloat(s) || 0);
			if (csW > 0) {
				childScaleX = bounds.width / csW;
			}
			if (csH > 0) {
				childScaleY = bounds.height / csH;
			}
		}

		const children: PptxElement[] = [];
		for (const childTag of VML_SHAPE_TAGS) {
			const childNodes = node[childTag];
			if (!childNodes) {
				continue;
			}
			const arr = Array.isArray(childNodes) ? childNodes : [childNodes];
			for (let ci = 0; ci < arr.length; ci++) {
				const child = parseVmlElement(childTag, arr[ci] as XmlObject, `${id}-`, ci);
				if (child) {
					child.x = (child.x - originX) * childScaleX;
					child.y = (child.y - originY) * childScaleY;
					child.width *= childScaleX;
					child.height *= childScaleY;
					children.push(child);
				}
			}
		}

		if (children.length === 0) {
			return null;
		}
		const rotation = extractVmlRotation(styleMap);

		return {
			type: 'group',
			id,
			x: bounds.x,
			y: bounds.y,
			width: bounds.width || Math.max(...children.map((c) => c.x + c.width)),
			height: bounds.height || Math.max(...children.map((c) => c.y + c.height)),
			children,
			rotation,
			rawXml: node,
		};
	} catch (e) {
		console.warn(`[pptx] Skipping VML group:`, e);
		return null;
	}
}

/**
 * Scan a parsed XML container (such as a shape tree) for any VML
 * shape elements and convert them to {@link PptxElement} instances.
 *
 * This is called from the shape tree parsing code to pick up VML
 * shapes that exist alongside (or instead of) DrawingML shapes.
 *
 * @param container - The parsed XML object to scan for VML elements
 * @param idPrefix - ID prefix for generated element IDs
 * @returns Array of parsed VML elements
 */
export function parseVmlElements(
	container: Record<string, unknown>,
	idPrefix: string = '',
): PptxElement[] {
	const elements: PptxElement[] = [];

	for (const tag of VML_SHAPE_TAGS) {
		const nodes = container[tag];
		if (!nodes) {
			continue;
		}
		const arr = Array.isArray(nodes) ? nodes : [nodes];
		for (let i = 0; i < arr.length; i++) {
			const element = parseVmlElement(tag, arr[i] as XmlObject, idPrefix, i);
			if (element) {
				elements.push(element);
			}
		}
	}

	return elements;
}
