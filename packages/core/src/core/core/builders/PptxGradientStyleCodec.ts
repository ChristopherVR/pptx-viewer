import type { ShapeStyle, XmlObject } from '../../types';
import { drawingChild, drawingChildren, mergeDrawingFillXml } from './drawing-fill-xml';

/**
 * Parse `a:gradFill/a:tileRect` LTRB insets into 0..1 fractions.
 *
 * Values are stored in 1/100000 units and may be negative. Standalone (no
 * codec context) so the shape-style extractor can populate the typed field
 * without threading a new context dependency.
 */
export function extractGradientTileRect(
	gradFill: XmlObject,
): NonNullable<ShapeStyle['fillGradientTileRect']> | undefined {
	const tileRect = drawingChild(gradFill, 'tileRect');
	if (!tileRect) {
		return undefined;
	}
	const toFraction = (raw: unknown): number => {
		const parsed = Number.parseInt(String(raw ?? '0'), 10);
		return Number.isFinite(parsed) ? parsed / 100000 : 0;
	};
	return {
		l: toFraction(tileRect['@_l']),
		t: toFraction(tileRect['@_t']),
		r: toFraction(tileRect['@_r']),
		b: toFraction(tileRect['@_b']),
	};
}

export interface PptxGradientStyleCodecContext {
	ensureArray: (value: unknown) => unknown[];
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
	extractColorOpacity: (colorNode: XmlObject | undefined) => number | undefined;
	clampUnitInterval: (value: number) => number;
	hexToRgb: (hex: string) => { r: number; g: number; b: number } | undefined;
	rgbToHex: (r: number, g: number, b: number) => string;
}

export interface IPptxGradientStyleCodec {
	extractGradientOpacity(gradFill: XmlObject): number | undefined;
	extractGradientStops(gradFill: XmlObject): NonNullable<ShapeStyle['fillGradientStops']>;
	extractGradientType(gradFill: XmlObject): NonNullable<ShapeStyle['fillGradientType']>;
	extractGradientAngle(gradFill: XmlObject): number;
	extractGradientPathType(gradFill: XmlObject): ShapeStyle['fillGradientPathType'];
	extractGradientFocalPoint(gradFill: XmlObject): ShapeStyle['fillGradientFocalPoint'];
	extractGradientFillToRect(gradFill: XmlObject): ShapeStyle['fillGradientFillToRect'];
	extractGradientTileRect(gradFill: XmlObject): ShapeStyle['fillGradientTileRect'];
	extractGradientFlip(gradFill: XmlObject): ShapeStyle['fillGradientFlip'];
	extractGradientRotWithShape(gradFill: XmlObject): boolean | undefined;
	extractGradientScaled(gradFill: XmlObject): boolean | undefined;
	buildGradientCssFromStops(
		stops: NonNullable<ShapeStyle['fillGradientStops']>,
		type: NonNullable<ShapeStyle['fillGradientType']>,
		angle: number,
		focalPoint?: ShapeStyle['fillGradientFocalPoint'],
		pathType?: ShapeStyle['fillGradientPathType'],
		fillToRect?: ShapeStyle['fillGradientFillToRect'],
	): string | undefined;
	extractGradientFillCss(gradFill: XmlObject): string | undefined;
	buildGradientFillXml(shapeStyle: ShapeStyle): XmlObject | undefined;
	extractGradientFillColor(gradFill: XmlObject): string | undefined;
}

export class PptxGradientStyleCodec implements IPptxGradientStyleCodec {
	private readonly context: PptxGradientStyleCodecContext;

	public constructor(context: PptxGradientStyleCodecContext) {
		this.context = context;
	}

	public extractGradientOpacity(gradFill: XmlObject): number | undefined {
		const gradientStops = drawingChildren(drawingChild(gradFill, 'gsLst'), 'gs');
		if (gradientStops.length === 0) {
			return undefined;
		}

		const opacities = gradientStops
			.map((stop) => this.context.extractColorOpacity(stop))
			.filter((opacity): opacity is number => opacity !== undefined);
		if (opacities.length === 0) {
			return undefined;
		}

		const opacityTotal = opacities.reduce((sum, value) => sum + value, 0);
		return this.context.clampUnitInterval(opacityTotal / opacities.length);
	}

	public extractGradientStops(gradFill: XmlObject): NonNullable<ShapeStyle['fillGradientStops']> {
		const gradientStops = drawingChildren(drawingChild(gradFill, 'gsLst'), 'gs');
		if (gradientStops.length === 0) {
			return [];
		}

		const sortedStops = [...gradientStops].sort((left, right) => {
			const leftPos = Number.parseInt(String(left['@_pos'] || '0'), 10);
			const rightPos = Number.parseInt(String(right['@_pos'] || '0'), 10);
			if (!Number.isFinite(leftPos) && !Number.isFinite(rightPos)) {
				return 0;
			}
			if (!Number.isFinite(leftPos)) {
				return 1;
			}
			if (!Number.isFinite(rightPos)) {
				return -1;
			}
			return leftPos - rightPos;
		});

		const stops: NonNullable<ShapeStyle['fillGradientStops']> = [];
		sortedStops.forEach((stop) => {
			const color = this.context.parseColor(stop);
			if (!color) {
				return;
			}

			const positionRaw = Number.parseInt(String(stop['@_pos'] || '0'), 10);
			const position = Number.isFinite(positionRaw)
				? this.context.clampUnitInterval(positionRaw / 100000) * 100
				: 0;
			const opacity = this.context.extractColorOpacity(stop);

			// Preserve original color XML for round-trip (scheme colors + transforms)
			const originalColorXml = this.extractColorSubNode(stop);

			stops.push({
				color,
				position,
				opacity,
				...(originalColorXml ? { originalColorXml } : {}),
			});
		});
		return stops;
	}

	public extractGradientType(gradFill: XmlObject): NonNullable<ShapeStyle['fillGradientType']> {
		return drawingChild(gradFill, 'path') ? 'radial' : 'linear';
	}

	public extractGradientPathType(gradFill: XmlObject): ShapeStyle['fillGradientPathType'] {
		const pathNode = drawingChild(gradFill, 'path');
		if (!pathNode) {
			return undefined;
		}
		const pathValue = String(pathNode['@_path'] || '')
			.trim()
			.toLowerCase();
		if (pathValue === 'circle' || pathValue === 'rect' || pathValue === 'shape') {
			return pathValue;
		}
		// Default to "circle" when a:path exists but path attr is missing
		return 'circle';
	}

	public extractGradientFocalPoint(gradFill: XmlObject): ShapeStyle['fillGradientFocalPoint'] {
		const pathNode = drawingChild(gradFill, 'path');
		if (!pathNode) {
			return undefined;
		}
		const fillToRect = drawingChild(pathNode, 'fillToRect');
		if (!fillToRect) {
			return undefined;
		}

		// a:fillToRect has @l, @t, @r, @b as percentages in 1/100000 units.
		// The focal point is the center of the fillToRect.
		const l = Number.parseInt(String(fillToRect['@_l'] || '0'), 10);
		const t = Number.parseInt(String(fillToRect['@_t'] || '0'), 10);
		const r = Number.parseInt(String(fillToRect['@_r'] || '0'), 10);
		const b = Number.parseInt(String(fillToRect['@_b'] || '0'), 10);

		const safeL = Number.isFinite(l) ? l / 100000 : 0;
		const safeT = Number.isFinite(t) ? t / 100000 : 0;
		const safeR = Number.isFinite(r) ? r / 100000 : 0;
		const safeB = Number.isFinite(b) ? b / 100000 : 0;

		// Focal point is the center of the rectangle formed by (l, t) to (1-r, 1-b)
		const x = this.context.clampUnitInterval((safeL + (1 - safeR)) / 2);
		const y = this.context.clampUnitInterval((safeT + (1 - safeB)) / 2);

		return { x, y };
	}

	public extractGradientFillToRect(gradFill: XmlObject): ShapeStyle['fillGradientFillToRect'] {
		const pathNode = drawingChild(gradFill, 'path');
		if (!pathNode) {
			return undefined;
		}
		const fillToRect = drawingChild(pathNode, 'fillToRect');
		if (!fillToRect) {
			return undefined;
		}

		const l = Number.parseInt(String(fillToRect['@_l'] || '0'), 10);
		const t = Number.parseInt(String(fillToRect['@_t'] || '0'), 10);
		const r = Number.parseInt(String(fillToRect['@_r'] || '0'), 10);
		const b = Number.parseInt(String(fillToRect['@_b'] || '0'), 10);

		return {
			l: Number.isFinite(l) ? this.context.clampUnitInterval(l / 100000) : 0,
			t: Number.isFinite(t) ? this.context.clampUnitInterval(t / 100000) : 0,
			r: Number.isFinite(r) ? this.context.clampUnitInterval(r / 100000) : 0,
			b: Number.isFinite(b) ? this.context.clampUnitInterval(b / 100000) : 0,
		};
	}

	public extractGradientTileRect(gradFill: XmlObject): ShapeStyle['fillGradientTileRect'] {
		return extractGradientTileRect(gradFill);
	}

	public extractGradientFlip(gradFill: XmlObject): ShapeStyle['fillGradientFlip'] {
		const flipRaw = String(gradFill['@_flip'] || '')
			.trim()
			.toLowerCase();
		if (flipRaw === 'x' || flipRaw === 'y' || flipRaw === 'xy' || flipRaw === 'none') {
			return flipRaw;
		}
		return undefined;
	}

	public extractGradientRotWithShape(gradFill: XmlObject): boolean | undefined {
		const rot = gradFill['@_rotWithShape'];
		if (rot === undefined || rot === null) {
			return undefined;
		}
		const token = String(rot).trim().toLowerCase();
		if (token === '1' || token === 'true') {
			return true;
		}
		if (token === '0' || token === 'false') {
			return false;
		}
		return undefined;
	}

	public extractGradientScaled(gradFill: XmlObject): boolean | undefined {
		const lin = drawingChild(gradFill, 'lin');
		if (!lin) {
			return undefined;
		}
		const scaled = lin['@_scaled'];
		if (scaled === undefined || scaled === null) {
			return undefined;
		}
		const token = String(scaled).trim().toLowerCase();
		if (token === '1' || token === 'true') {
			return true;
		}
		if (token === '0' || token === 'false') {
			return false;
		}
		return undefined;
	}

	public extractGradientAngle(gradFill: XmlObject): number {
		const angleRaw = Number.parseInt(String(drawingChild(gradFill, 'lin')?.['@_ang'] || ''), 10);
		return Number.isFinite(angleRaw) ? (((angleRaw / 60000) % 360) + 360) % 360 : 90;
	}

	public buildGradientCssFromStops(
		stops: NonNullable<ShapeStyle['fillGradientStops']>,
		type: NonNullable<ShapeStyle['fillGradientType']>,
		angle: number,
		focalPoint?: ShapeStyle['fillGradientFocalPoint'],
		pathType?: ShapeStyle['fillGradientPathType'],
		fillToRect?: ShapeStyle['fillGradientFillToRect'],
	): string | undefined {
		if (stops.length === 0) {
			return undefined;
		}

		const stopTokens = stops.map((stop) => {
			const colorToken = this.colorWithOpacity(stop.color, stop.opacity);
			const normalizedPosition =
				typeof stop.position === 'number' && Number.isFinite(stop.position)
					? `${this.context.clampUnitInterval(stop.position / 100) * 100}%`
					: undefined;
			return normalizedPosition ? `${colorToken} ${normalizedPosition}` : colorToken;
		});

		if (type === 'radial') {
			const stopStr = stopTokens.join(', ');
			const resolvedPathType = pathType || 'circle';

			// Compute center from fillToRect if available
			let cx = 50;
			let cy = 50;
			if (fillToRect) {
				cx = ((fillToRect.l + (1 - fillToRect.r)) / 2) * 100;
				cy = ((fillToRect.t + (1 - fillToRect.b)) / 2) * 100;
			} else if (focalPoint) {
				cx = focalPoint.x * 100;
				cy = focalPoint.y * 100;
			}
			const posX = `${Math.round(cx)}%`;
			const posY = `${Math.round(cy)}%`;

			if (resolvedPathType === 'rect') {
				const semiX = Math.max(cx, 100 - cx);
				const semiY = Math.max(cy, 100 - cy);
				return `radial-gradient(${Math.round(semiX)}% ${Math.round(semiY)}% at ${posX} ${posY}, ${stopStr})`;
			}

			if (resolvedPathType === 'shape') {
				return `radial-gradient(farthest-side at ${posX} ${posY}, ${stopStr})`;
			}

			return `radial-gradient(circle at ${posX} ${posY}, ${stopStr})`;
		}
		return `linear-gradient(${angle.toFixed(2)}deg, ${stopTokens.join(', ')})`;
	}

	public extractGradientFillCss(gradFill: XmlObject): string | undefined {
		const stops = this.extractGradientStops(gradFill);
		if (stops.length === 0) {
			return undefined;
		}

		return this.buildGradientCssFromStops(
			stops,
			this.extractGradientType(gradFill),
			this.extractGradientAngle(gradFill),
			this.extractGradientFocalPoint(gradFill),
			this.extractGradientPathType(gradFill),
			this.extractGradientFillToRect(gradFill),
		);
	}

	public buildGradientFillXml(shapeStyle: ShapeStyle): XmlObject | undefined {
		const stops = (shapeStyle.fillGradientStops || [])
			.filter((stop) => Boolean(stop?.color))
			.map((stop) => {
				const positionRaw =
					typeof stop.position === 'number' && Number.isFinite(stop.position) ? stop.position : 0;
				const position = Math.round(this.context.clampUnitInterval(positionRaw / 100) * 100000);

				// Prefer original color XML to preserve scheme colors and transforms
				if (
					stop.originalColorXml &&
					this.context.parseColor(stop.originalColorXml) === String(stop.color).trim()
				) {
					const stopXml: XmlObject = {
						'@_pos': String(position),
						...stop.originalColorXml,
					};
					return stopXml;
				}

				const normalizedColor = String(stop.color || '').trim();
				const normalizedOpacity =
					typeof stop.opacity === 'number' && Number.isFinite(stop.opacity)
						? this.context.clampUnitInterval(stop.opacity)
						: undefined;
				const stopXml: XmlObject = {
					'@_pos': String(position),
					'a:srgbClr': {
						'@_val': normalizedColor.replace('#', ''),
					},
				};
				if (normalizedOpacity !== undefined) {
					(stopXml['a:srgbClr'] as XmlObject)['a:alpha'] = {
						'@_val': String(Math.round(normalizedOpacity * 100000)),
					};
				}
				return stopXml;
			});
		if (stops.length === 0) {
			return undefined;
		}

		const gradientType = shapeStyle.fillGradientType || 'linear';
		const gradientXml: XmlObject = {};
		// `@flip` and `@rotWithShape` attach to the `<a:gradFill>` element
		// and must be set before the child `<a:gsLst>` is inserted —
		// fast-xml-parser preserves insertion order, but attributes always
		// serialise on the parent regardless. We assign them up-front for
		// readability.
		if (shapeStyle.fillGradientFlip && shapeStyle.fillGradientFlip !== 'none') {
			gradientXml['@_flip'] = shapeStyle.fillGradientFlip;
		} else if (shapeStyle.fillGradientFlip === 'none' && shapeStyle.fillGradientXml) {
			// An explicit edit back to the default must remove a preserved non-default value.
			gradientXml['@_flip'] = undefined;
		}
		if (shapeStyle.fillGradientRotWithShape !== undefined) {
			gradientXml['@_rotWithShape'] = shapeStyle.fillGradientRotWithShape ? '1' : '0';
		}
		gradientXml['a:gsLst'] = { 'a:gs': stops };
		if (gradientType === 'radial') {
			const pathType = shapeStyle.fillGradientPathType || 'circle';
			const pathXml: XmlObject = {
				'@_path': pathType,
			};
			if (shapeStyle.fillGradientFillToRect) {
				const ftr = shapeStyle.fillGradientFillToRect;
				pathXml['a:fillToRect'] = {
					'@_l': String(Math.round(ftr.l * 100000)),
					'@_t': String(Math.round(ftr.t * 100000)),
					'@_r': String(Math.round(ftr.r * 100000)),
					'@_b': String(Math.round(ftr.b * 100000)),
				};
			} else if (shapeStyle.fillGradientFocalPoint) {
				const fp = shapeStyle.fillGradientFocalPoint;
				// Convert focal point back to fillToRect LTRB values
				const l = Math.round(fp.x * 100000);
				const t = Math.round(fp.y * 100000);
				const r = Math.round((1 - fp.x) * 100000);
				const b = Math.round((1 - fp.y) * 100000);
				pathXml['a:fillToRect'] = {
					'@_l': String(l),
					'@_t': String(t),
					'@_r': String(r),
					'@_b': String(b),
				};
			}
			gradientXml['a:path'] = pathXml;
		} else {
			const normalizedAngle =
				typeof shapeStyle.fillGradientAngle === 'number' &&
				Number.isFinite(shapeStyle.fillGradientAngle)
					? shapeStyle.fillGradientAngle
					: 90;
			const linNode: XmlObject = {
				'@_ang': String(Math.round(normalizedAngle * 60000)),
			};
			// `@scaled` defaults to "1" per the schema, but we only emit
			// the explicit value the parser captured to avoid lying about
			// what the source authored.
			if (shapeStyle.fillGradientScaled !== undefined) {
				linNode['@_scaled'] = shapeStyle.fillGradientScaled ? '1' : '0';
			} else {
				linNode['@_scaled'] = '1';
			}
			gradientXml['a:lin'] = linNode;
		}
		if (shapeStyle.fillGradientTileRect) {
			const tr = shapeStyle.fillGradientTileRect;
			gradientXml['a:tileRect'] = {
				'@_l': String(Math.round(tr.l * 100000)),
				'@_t': String(Math.round(tr.t * 100000)),
				'@_r': String(Math.round(tr.r * 100000)),
				'@_b': String(Math.round(tr.b * 100000)),
			};
		}
		return mergeDrawingFillXml(
			shapeStyle.fillGradientXml,
			gradientXml,
			['gsLst', 'lin', 'path'],
			['gsLst', 'lin', 'path', 'tileRect', 'extLst'],
		);
	}

	public extractGradientFillColor(gradFill: XmlObject): string | undefined {
		const sortedStops = this.extractStopsSorted(gradFill);
		if (sortedStops.length === 0) {
			return undefined;
		}

		const firstColor = this.context.parseColor(sortedStops[0]);
		const lastColor =
			sortedStops.length > 1
				? this.context.parseColor(sortedStops[sortedStops.length - 1])
				: undefined;

		if (!firstColor) {
			return lastColor;
		}
		if (!lastColor) {
			return firstColor;
		}

		const firstRgb = this.context.hexToRgb(firstColor);
		const lastRgb = this.context.hexToRgb(lastColor);
		if (!firstRgb || !lastRgb) {
			return firstColor;
		}

		return this.context.rgbToHex(
			(firstRgb.r + lastRgb.r) / 2,
			(firstRgb.g + lastRgb.g) / 2,
			(firstRgb.b + lastRgb.b) / 2,
		);
	}

	private extractStopsSorted(gradFill: XmlObject): XmlObject[] {
		const gradientStops = drawingChildren(drawingChild(gradFill, 'gsLst'), 'gs');
		if (gradientStops.length === 0) {
			return [];
		}

		return [...gradientStops].sort((left, right) => {
			const leftPos = Number.parseInt(String(left['@_pos'] || '0'), 10);
			const rightPos = Number.parseInt(String(right['@_pos'] || '0'), 10);
			if (!Number.isFinite(leftPos) && !Number.isFinite(rightPos)) {
				return 0;
			}
			if (!Number.isFinite(leftPos)) {
				return 1;
			}
			if (!Number.isFinite(rightPos)) {
				return -1;
			}
			return leftPos - rightPos;
		});
	}

	/**
	 * Extract the raw color sub-node from a gradient stop for round-trip preservation.
	 * Returns the color choice node (e.g. a:schemeClr with transforms, a:srgbClr, etc.).
	 */
	private extractColorSubNode(stop: XmlObject): XmlObject | undefined {
		const colorNames = new Set(['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr']);
		for (const [key, value] of Object.entries(stop)) {
			if (colorNames.has(key.split(':').at(-1) ?? key)) {
				return { [key]: value } as XmlObject;
			}
		}
		return undefined;
	}

	private colorWithOpacity(color: string, opacity: number | undefined): string {
		if (opacity === undefined) {
			return color;
		}
		const rgb = this.context.hexToRgb(color);
		if (!rgb) {
			return color;
		}
		return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${this.context.clampUnitInterval(opacity)})`;
	}
}
