import type {
	PptxCommonSlideViewProperties,
	PptxGridSpacing,
	PptxViewGuide,
	PptxViewOrigin,
	PptxViewScale,
	XmlObject,
} from '../../types';

const localName = (key: string) => key.replace(/^.*:/u, '');

export function findViewKey(node: XmlObject, name: string): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function qualifiedKey(node: XmlObject, name: string, fallback: string): string {
	const existing = findViewKey(node, name);
	if (existing) {
		return existing;
	}
	const sibling = Object.keys(node).find((key) => !key.startsWith('@_') && key.includes(':'));
	return sibling ? `${sibling.slice(0, sibling.indexOf(':'))}:${name}` : fallback;
}

export function viewChild(node: XmlObject, name: string): XmlObject | undefined {
	const key = findViewKey(node, name);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function parseInteger(value: unknown): number | undefined {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseRatio(node: XmlObject | undefined): { n: number; d: number } | undefined {
	if (!node) {
		return undefined;
	}
	const n = parseInteger(node['@_n']);
	const d = parseInteger(node['@_d']);
	return n !== undefined && d !== undefined && d !== 0 ? { n, d } : undefined;
}

export function parseCommonView(node: XmlObject): {
	origin?: PptxViewOrigin;
	scale?: PptxViewScale;
	variableScale?: boolean;
} {
	const common = viewChild(node, 'cViewPr') ?? node;
	const originNode = viewChild(common, 'origin');
	const x = parseInteger(originNode?.['@_x']);
	const y = parseInteger(originNode?.['@_y']);
	const scaleNode = viewChild(common, 'scale');
	const sx = parseRatio(scaleNode ? viewChild(scaleNode, 'sx') : undefined);
	const sy = parseRatio(scaleNode ? viewChild(scaleNode, 'sy') : undefined);
	const variable = common['@_varScale'];
	return {
		origin: x !== undefined && y !== undefined ? { x, y } : undefined,
		scale: sx ? { ...sx, ...(sy && (sy.n !== sx.n || sy.d !== sx.d) ? { sy } : {}) } : undefined,
		variableScale: variable === undefined ? undefined : String(variable) !== '0',
	};
}

function parseGuides(node: XmlObject): PptxViewGuide[] | undefined {
	const list = viewChild(node, 'guideLst');
	if (!list) {
		return undefined;
	}
	const key = findViewKey(list, 'guide');
	const raw = key ? list[key] : undefined;
	const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
	return entries.map((value) => {
		const guide = value as XmlObject;
		const orientation = guide['@_orient'];
		return {
			orientation: orientation === 'horz' || orientation === 'vert' ? orientation : undefined,
			position: parseInteger(guide['@_pos']),
		};
	});
}

export function parseCommonSlideView(node: XmlObject): PptxCommonSlideViewProperties {
	const common = parseCommonView(node);
	return {
		...common,
		snapToGrid: parseBoolean(node['@_snapToGrid']),
		snapToObjects: parseBoolean(node['@_snapToObjects']),
		showGuides: parseBoolean(node['@_showGuides']),
		guides: parseGuides(node),
	};
}

function parseBoolean(value: unknown): boolean | undefined {
	return value === undefined ? undefined : value !== '0' && value !== false;
}

export function parseGridSpacing(root: XmlObject): PptxGridSpacing | undefined {
	const node = viewChild(root, 'gridSpacing');
	const cx = parseInteger(node?.['@_cx']);
	const cy = parseInteger(node?.['@_cy']);
	return cx !== undefined && cx > 0 && cy !== undefined && cy > 0 ? { cx, cy } : undefined;
}

function assertRatio(ratio: { n: number; d: number }, field: string): void {
	if (!Number.isSafeInteger(ratio.n) || !Number.isSafeInteger(ratio.d) || ratio.d === 0) {
		throw new RangeError(`${field} must contain safe integer n and non-zero d values`);
	}
}

function buildCommonView(props: PptxCommonSlideViewProperties, base: XmlObject): XmlObject {
	const node = { ...base };
	if (props.variableScale !== undefined) {
		node['@_varScale'] = props.variableScale ? '1' : '0';
	}
	if (props.scale) {
		assertRatio(props.scale, 'scale');
		if (props.scale.sy) {
			assertRatio(props.scale.sy, 'scale.sy');
		}
		const scaleKey = qualifiedKey(node, 'scale', 'p:scale');
		const scale = { ...(node[scaleKey] as XmlObject | undefined) };
		scale[findViewKey(scale, 'sx') ?? 'a:sx'] = attrs(props.scale);
		scale[findViewKey(scale, 'sy') ?? 'a:sy'] = attrs(props.scale.sy ?? props.scale);
		node[scaleKey] = scale;
	}
	if (props.origin) {
		if (!Number.isSafeInteger(props.origin.x) || !Number.isSafeInteger(props.origin.y)) {
			throw new RangeError('origin coordinates must be safe integers');
		}
		const key = qualifiedKey(node, 'origin', 'p:origin');
		node[key] = {
			...((node[key] as XmlObject | undefined) ?? {}),
			'@_x': `${props.origin.x}`,
			'@_y': `${props.origin.y}`,
		};
	}
	return node;
}

const attrs = (ratio: { n: number; d: number }): XmlObject => ({
	'@_n': `${ratio.n}`,
	'@_d': `${ratio.d}`,
});

export function buildCommonSlideView(
	props: PptxCommonSlideViewProperties,
	base: XmlObject = {},
): XmlObject {
	const node = { ...base };
	setBoolean(node, 'snapToGrid', props.snapToGrid);
	setBoolean(node, 'snapToObjects', props.snapToObjects);
	setBoolean(node, 'showGuides', props.showGuides);
	const commonKey = qualifiedKey(node, 'cViewPr', 'p:cViewPr');
	node[commonKey] = buildCommonView(props, viewChild(node, 'cViewPr') ?? {});
	if (props.guides) {
		const key = qualifiedKey(node, 'guideLst', 'p:guideLst');
		const list = { ...((node[key] as XmlObject | undefined) ?? {}) };
		list[qualifiedKey(list, 'guide', 'p:guide')] = props.guides.map(buildGuide);
		node[key] = list;
	}
	return node;
}

function setBoolean(node: XmlObject, name: string, value: boolean | undefined): void {
	if (value !== undefined) {
		node[`@_${name}`] = value ? '1' : '0';
	}
}

function buildGuide(guide: PptxViewGuide): XmlObject {
	if (guide.position !== undefined && !Number.isSafeInteger(guide.position)) {
		throw new RangeError('guide position must be a safe integer');
	}
	return {
		...(guide.orientation ? { '@_orient': guide.orientation } : {}),
		...(guide.position !== undefined ? { '@_pos': `${guide.position}` } : {}),
	};
}

export function applyGridSpacing(root: XmlObject, spacing: PptxGridSpacing | undefined): void {
	if (!spacing) {
		return;
	}
	if (
		!Number.isSafeInteger(spacing.cx) ||
		spacing.cx <= 0 ||
		!Number.isSafeInteger(spacing.cy) ||
		spacing.cy <= 0
	) {
		throw new RangeError('grid spacing cx and cy must be positive safe integers');
	}
	const key = qualifiedKey(root, 'gridSpacing', 'p:gridSpacing');
	root[key] = {
		...((root[key] as XmlObject | undefined) ?? {}),
		'@_cx': `${spacing.cx}`,
		'@_cy': `${spacing.cy}`,
	};
}
