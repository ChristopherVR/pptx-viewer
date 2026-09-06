import { XmlObject } from '../../types';
import type { InkPptxElement } from '../../types';

/**
 * Build a p:sp XML object for an ink annotation element.
 * Each ink path becomes a separate a:path within a:pathLst,
 * serialized as a freeform (a:custGeom) shape with moveTo/lnTo.
 */
export function buildInkShapeXml(el: InkPptxElement, emuPerPx: number): XmlObject {
	const offX = String(Math.round(el.x * emuPerPx));
	const offY = String(Math.round(el.y * emuPerPx));
	const extCx = String(Math.round(Math.max(el.width, 1) * emuPerPx));
	const extCy = String(Math.round(Math.max(el.height, 1) * emuPerPx));

	// Build one a:path per ink stroke
	const xmlPaths: XmlObject[] = el.inkPaths.map((svgPath) => {
		const moveToList: XmlObject[] = [];
		const lnToList: XmlObject[] = [];
		// SVG separates a coordinate pair with whitespace OR a comma, and both
		// forms reach here: the Draw tool writes `M x y`, while an SDK caller
		// (and `pathToTrace` in the ink writer, which always accepted both)
		// writes `M0,0 L50,25`. Requiring whitespace silently matched nothing
		// on the comma form, so the stroke was emitted as an EMPTY `a:path`
		// and the ink vanished from the saved shape.
		const tokens = svgPath.matchAll(/(?<cmd>[ML])\s*(?<x>[\d.eE+-]+)[,\s]+(?<y>[\d.eE+-]+)/giu);
		for (const token of tokens) {
			const x = parseFloat(String(token.groups?.x));
			const y = parseFloat(String(token.groups?.y));
			if (!Number.isFinite(x) || !Number.isFinite(y)) {
				continue;
			}
			const pt = {
				'@_x': String(Math.round(x * emuPerPx)),
				'@_y': String(Math.round(y * emuPerPx)),
			};
			if (token.groups?.cmd?.toUpperCase() === 'M') {
				moveToList.push({ 'a:pt': pt });
			} else {
				lnToList.push({ 'a:pt': pt });
			}
		}

		const pathXml: XmlObject = {
			'@_w': extCx,
			'@_h': extCy,
			'@_stroke': '1',
			'@_fill': 'none',
		};
		if (moveToList.length > 0) {
			pathXml['a:moveTo'] = moveToList.length === 1 ? moveToList[0] : moveToList;
		}
		if (lnToList.length > 0) {
			pathXml['a:lnTo'] = lnToList.length === 1 ? lnToList[0] : lnToList;
		}
		return pathXml;
	});

	const strokeColor = el.inkColors?.[0] ?? '#000000';
	const strokeWidth = el.inkWidths?.[0] ?? 2;
	const strokeOpacity = el.inkOpacities?.[0] ?? 1;
	const cleanColor = strokeColor.replace('#', '');

	const shape: XmlObject = {
		'p:nvSpPr': {
			'p:cNvPr': {
				'@_id': '0',
				'@_name': el.id,
			},
			'p:cNvSpPr': {},
			'p:nvPr': {},
		},
		'p:spPr': {
			'a:xfrm': {
				'a:off': { '@_x': offX, '@_y': offY },
				'a:ext': { '@_cx': extCx, '@_cy': extCy },
			},
			'a:custGeom': {
				'a:avLst': {},
				'a:gdLst': {},
				'a:ahLst': {},
				'a:cxnLst': {},
				'a:rect': {
					'@_l': '0',
					'@_t': '0',
					'@_r': extCx,
					'@_b': extCy,
				},
				'a:pathLst': {
					'a:path': xmlPaths.length === 1 ? xmlPaths[0] : xmlPaths,
				},
			},
			'a:noFill': {},
			'a:ln': {
				'@_w': String(Math.round(strokeWidth * emuPerPx)),
				'@_cap': 'rnd',
				'a:solidFill': {
					'a:srgbClr': {
						'@_val': cleanColor,
						...(strokeOpacity < 1
							? {
									'a:alpha': {
										'@_val': String(Math.round(strokeOpacity * 100000)),
									},
								}
							: {}),
					},
				},
				'a:round': {},
			},
		},
	};

	return shape;
}
