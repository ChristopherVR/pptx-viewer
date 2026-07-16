import type { PptxSmartArtNode } from '../types';
import type {
	LayoutConstraints,
	LayoutEngineShape,
	LayoutRule,
} from './smartart-layout-engine-types';

export interface EvaluatedLayoutRules {
	constraints: LayoutConstraints;
	nodeConstraints: Map<string, LayoutConstraints>;
}

type NumericConstraint = Exclude<keyof LayoutConstraints, 'dir'>;

const TYPES: Record<string, NumericConstraint | 'dir'> = {
	w: 'w',
	h: 'h',
	primfontsz: 'primFontSz',
	sp: 'sp',
	sibsp: 'sibSp',
	secsibsp: 'secSibSp',
	begpad: 'begPad',
	endpad: 'endPad',
	cols: 'cols',
	aspectratio: 'aspectRatio',
	ar: 'aspectRatio',
	dir: 'dir',
};

function finite(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function nextValue(current: number | undefined, rule: LayoutRule): number | undefined {
	let value = finite(rule.val) ? rule.val : current;
	if (!finite(value) && finite(rule.max)) {
		value = rule.max;
	}
	if (!finite(value)) {
		return undefined;
	}
	if (finite(rule.fact)) {
		value *= rule.fact;
	}
	if (finite(rule.max)) {
		value = Math.min(value, rule.max);
	}
	return Number.isFinite(value) ? value : undefined;
}

function pointTypeMatches(node: PptxSmartArtNode, filter: string | undefined): boolean {
	if (!filter || filter === 'all') {
		return true;
	}
	const values = new Set(filter.split(/\s+/u).map((value) => value.toLowerCase()));
	const type = (node.nodeType || 'node').toLowerCase();
	if (values.has(type)) {
		return true;
	}
	if (values.has('node') && (type === 'node' || type === 'norm')) {
		return true;
	}
	if (values.has('nonasst') && type !== 'asst') {
		return true;
	}
	return values.has('nonnorm') && type !== 'norm' && type !== 'node';
}

function relationshipMatches(node: PptxSmartArtNode, rule: LayoutRule): boolean {
	const relation = rule.for?.toLowerCase();
	if (!relation) {
		return true;
	}
	if (relation === 'self') {
		return !node.parentId;
	}
	if (relation === 'ch' || relation === 'des') {
		return Boolean(node.parentId);
	}
	return true;
}

function matchingNodes(rule: LayoutRule, nodes: PptxSmartArtNode[]): PptxSmartArtNode[] {
	const named = rule.forName?.trim();
	const exactName = named ? nodes.some((node) => node.id === named) : false;
	return nodes.filter(
		(node) =>
			(!exactName || node.id === named) &&
			pointTypeMatches(node, rule.ptType) &&
			relationshipMatches(node, rule),
	);
}

function applyNumeric(
	target: LayoutConstraints,
	type: NumericConstraint,
	rule: LayoutRule,
	fallback?: number,
): void {
	const value = nextValue(target[type] ?? fallback, rule);
	if (value === undefined) {
		return;
	}
	target[type] = type === 'cols' ? Math.max(1, Math.round(value)) : Math.max(0, value);
}

/** Evaluate modeled DiagramML numeric rules without discarding unknown entries. */
export function evaluateLayoutRules(
	base: LayoutConstraints,
	rules: LayoutRule[],
	nodes: PptxSmartArtNode[],
): EvaluatedLayoutRules {
	const constraints = { ...base };
	const nodeConstraints = new Map<string, LayoutConstraints>();
	for (const rule of rules) {
		const type = TYPES[rule.type.toLowerCase()];
		if (!type) {
			continue;
		}
		const matches = matchingNodes(rule, nodes);
		const canTargetNode = type === 'w' || type === 'h' || type === 'primFontSz';
		const targeted = canTargetNode && Boolean(rule.for || rule.forName || rule.ptType);
		if (targeted && matches.length > 0) {
			for (const node of matches) {
				const override = nodeConstraints.get(node.id) ?? {};
				applyNumeric(override, type, rule, constraints[type]);
				nodeConstraints.set(node.id, override);
			}
		} else if (type === 'dir') {
			const value = nextValue(constraints.dir === 'rev' ? 1 : 0, rule);
			if (value !== undefined) {
				constraints.dir = value > 0 ? 'rev' : 'norm';
			}
		} else {
			applyNumeric(constraints, type, rule);
		}
	}
	if (constraints.sp !== undefined && constraints.sibSp === undefined) {
		constraints.sibSp = constraints.sp;
	}
	return { constraints, nodeConstraints };
}

/** Apply per-node size/font rules after the deterministic base algorithm. */
export function applyNodeLayoutRules(
	shapes: LayoutEngineShape[],
	overrides: Map<string, LayoutConstraints>,
	bounds: { width: number; height: number },
	global: LayoutConstraints,
): LayoutEngineShape[] {
	return shapes.map((shape) => {
		const rule = overrides.get(shape.nodeId);
		const widthRule = rule?.w ?? global.w;
		const heightRule = rule?.h ?? global.h;
		const width = widthRule !== undefined ? widthRule * bounds.width : shape.width;
		const height = heightRule !== undefined ? heightRule * bounds.height : shape.height;
		return {
			...shape,
			x: Math.round(shape.x + (shape.width - width) / 2),
			y: Math.round(shape.y + (shape.height - height) / 2),
			width: Math.round(width),
			height: Math.round(height),
			fontSize: rule?.primFontSz ?? global.primFontSz,
		};
	});
}
