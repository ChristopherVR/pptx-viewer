/**
 * VML shape type mapping.
 *
 * Maps VML `spt` (shape type) numbers and VML tag names to DrawingML
 * preset geometry names used by the viewer.
 *
 * @module vml-shape-type-map
 */

// ── SPT number → preset name ─────────────────────────────────────────

/**
 * Mapping from VML SPT (shape type) numbers to DrawingML preset
 * geometry names.
 */
const SPT_MAP: Record<number, string> = {
	1: 'rect',
	2: 'parallelogram',
	3: 'trapezoid',
	4: 'diamond',
	5: 'pentagon',
	6: 'hexagon',
	7: 'heptagon',
	8: 'octagon',
	9: 'decagon',
	10: 'dodecagon',
	13: 'cube',
	16: 'can',
	20: 'straightConnector1',
	21: 'bentConnector3',
	22: 'curvedConnector3',
	23: 'line',
	24: 'line',
	32: 'rect',
	33: 'rect',
	34: 'rect',
	75: 'rect', // text box
	109: 'cloudCallout',
	110: 'borderCallout1',
	172: 'ellipse',
	173: 'rect',
	183: 'sun',
	184: 'moon',
	185: 'bracketPair',
	186: 'bracePair',
	187: 'star4',
	188: 'star5',
	189: 'star8',
	202: 'rect', // text box
};

/**
 * Map a VML `spt` (shape type) number or `type` reference to a
 * DrawingML preset geometry name.
 *
 * Handles numeric SPT values directly as well as type references of the
 * form `"#_x0000_t75"`.
 *
 * @param sptValue - Raw SPT number string (e.g. `"75"`).
 * @param typeRef - VML type reference (e.g. `"#_x0000_t75"`).
 * @returns DrawingML preset geometry name (defaults to `"rect"`).
 */
export function mapVmlShapeType(sptValue: string | undefined, typeRef: string | undefined): string {
	if (sptValue) {
		const spt = parseInt(sptValue, 10);
		if (Number.isFinite(spt)) {
			return SPT_MAP[spt] || 'rect';
		}
	}

	// type="#_x0000_t75" -> extract number
	if (typeRef) {
		const match = typeRef.match(/_x0000_t(\d+)/);
		if (match) {
			return mapVmlShapeType(match[1], undefined);
		}
	}

	return 'rect';
}

/**
 * Map a VML tag name to a DrawingML preset geometry name.
 *
 * @param tag - VML tag name (e.g. `"v:rect"`, `"v:oval"`).
 * @returns DrawingML preset geometry name.
 */
export function vmlTagToShapeType(tag: string): string {
	switch (tag) {
		case 'v:rect':
			return 'rect';
		case 'v:oval':
			return 'ellipse';
		case 'v:roundrect':
			return 'roundRect';
		case 'v:line':
			return 'line';
		case 'v:polyline':
			return 'custom';
		case 'v:arc':
			return 'arc';
		default:
			return 'rect';
	}
}
