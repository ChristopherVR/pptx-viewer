/**
 * SmartArt DiagramML interpreter - `dgm:rule/@forName` scoped overrides.
 *
 * ECMA-376's `CT_Rule` (`dgm:rule`) carries the same target attributes as
 * `CT_Constraint` (`dgm:constr`): `for`, `forName`, `ptType`. `forName` names
 * a `dgm:layoutNode` by its `name=` attribute - it is a reference to a
 * structural ROLE in the layout tree, not to a data-point modelId. This is
 * confirmed against a genuine PowerPoint-authored diagram: `ppt/diagrams/
 * layout1.xml` inside `e2e/fixtures/animation-builds-color.pptx` uses
 * `forName="node"` and `forName="sibTrans"` on `dgm:constr` elements declared
 * on the ROOT layoutNode, each referring to one of its two differently-named
 * CHILD layoutNodes (the per-item template and the sibling-transition
 * spacer). A `dgm:rule` with `forName` scopes the same way: it clamps/sets a
 * numeric field (`w` / `h` / `primFontSz`) for every data point rendered
 * through the layoutNode of that name, uniformly. It cannot target one
 * specific instance among repeated siblings sharing a template, because
 * DiagramML gives the TEMPLATE a name, not the individual data points -
 * `forName` never appeared on a `dgm:rule` in that sample, and no
 * PowerPoint-authored layout names a data point in the first place.
 *
 * The previous (deleted) `smartart-layout-rule-evaluator.ts` matched
 * `forName` against a data-point id instead, and its fallback applied an
 * unmatched name to EVERY node rather than to none. Both were wrong against
 * the spec and against genuine content, so this module does not reproduce
 * that matching: it resolves by layoutNode NAME, and a name that matches
 * nothing overrides nothing.
 *
 * `ruleLst` can be declared at any ancestor in the tree (the root, in the
 * genuine sample above) and still name a descendant role, so
 * `collectNamedRules` gathers every rule from the whole definition once; the
 * caller looks them up by the role name it is currently rendering.
 *
 * Scope: wired only for the flat single-role arrangers (`lin` / `snake` /
 * `cycle` / `pyra`), where one item layoutNode template covers every
 * rendered point (see `smartart-layout-interpreter.ts`). `hierarchy`
 * (parent/child roles) and `composite` (heterogeneous named children) do not
 * reduce to one uniform role name, so applying this there would be a guess
 * rather than a resolved reference; they keep their existing approximation.
 * Pure geometry; no framework code, no DOM.
 */

import type {
	PptxSmartArtLayoutDefinition,
	PptxSmartArtLayoutNode,
	PptxSmartArtNumericRule,
} from '../types';
import type { BoundingBox, RenderedNode, SmartArtLayoutResult } from './smartart-layout-types';

/** Depth-first collection of every `dgm:rule` anywhere in the layout tree. */
export function collectNamedRules(
	definition: PptxSmartArtLayoutDefinition,
): PptxSmartArtNumericRule[] {
	const out: PptxSmartArtNumericRule[] = [];
	const walk = (node: PptxSmartArtLayoutNode): void => {
		if (node.rules) {
			out.push(...node.rules);
		}
		for (const child of node.children ?? []) {
			walk(child);
		}
	};
	walk(definition.rootNode);
	return out;
}

function finite(value: number | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** Resolve a rule's value: `val` (or `max` when `val` is absent), `*fact`, clamped to `max`. */
function ruleValue(rule: PptxSmartArtNumericRule): number | undefined {
	let value = finite(rule.value) ? rule.value : rule.max;
	if (!finite(value)) {
		return undefined;
	}
	if (finite(rule.factor)) {
		value *= rule.factor;
	}
	if (finite(rule.max)) {
		value = Math.min(value, rule.max);
	}
	return Number.isFinite(value) ? value : undefined;
}

/** Resolved `forName`-scoped overrides for one layoutNode role. */
export interface NamedRuleOverride {
	/** Width, as a ratio (0..1) of the bounding box width. */
	width?: number;
	/** Height, as a ratio (0..1) of the bounding box height. */
	height?: number;
	/** Absolute font size in points. */
	fontSize?: number;
}

const OVERRIDE_KEY: Readonly<Record<string, keyof NamedRuleOverride>> = {
	w: 'width',
	h: 'height',
	primFontSz: 'fontSize',
};

/**
 * Resolve the `forName`-scoped overrides for the layoutNode named `name`, or
 * `undefined` when no rule names it (including when `name` itself is
 * `undefined` - an unnamed template cannot be a `forName` target).
 */
export function resolveNamedRuleOverride(
	rules: PptxSmartArtNumericRule[],
	name: string | undefined,
): NamedRuleOverride | undefined {
	if (!name) {
		return undefined;
	}
	const override: NamedRuleOverride = {};
	for (const rule of rules) {
		if (rule.forName !== name) {
			continue;
		}
		const key = OVERRIDE_KEY[rule.type];
		if (!key) {
			continue;
		}
		const value = ruleValue(rule);
		if (value !== undefined) {
			override[key] = value;
		}
	}
	return Object.keys(override).length > 0 ? override : undefined;
}

/** Apply a resolved override to one rendered node's size/font, kind-aware. */
function applyToNode(
	node: RenderedNode,
	override: NamedRuleOverride,
	box: BoundingBox,
): RenderedNode {
	if (node.kind !== 'rect') {
		// Circle / polygon geometry is derived from the whole arrangement (ring
		// radius, band stack); resizing one node's `w`/`h` in isolation would
		// desync it from its neighbours, so only the font size is honoured.
		return override.fontSize === undefined ? node : { ...node, fontSize: override.fontSize };
	}
	const width = override.width !== undefined ? override.width * box.width : node.width;
	const height = override.height !== undefined ? override.height * box.height : node.height;
	const x = node.x + (node.width - width) / 2;
	const y = node.y + (node.height - height) / 2;
	return {
		...node,
		x,
		y,
		width,
		height,
		textX: x + width / 2,
		textY: y + height / 2,
		fontSize: override.fontSize ?? node.fontSize,
	};
}

/**
 * Apply a `forName`-scoped rule override to every rendered node in a layout
 * result. An `undefined` override is a no-op, so callers can resolve-then-
 * apply unconditionally.
 */
export function applyNamedRuleOverride(
	result: SmartArtLayoutResult,
	override: NamedRuleOverride | undefined,
	box: BoundingBox,
): SmartArtLayoutResult {
	if (!override) {
		return result;
	}
	return { ...result, nodes: result.nodes.map((node) => applyToNode(node, override, box)) };
}
