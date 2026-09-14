import { directChildren, elementXml, rootTag } from './pptx-validator-conformance-xml';
import { issue, validateOrder } from './pptx-validator-content-order';
import type { ValidationIssue } from './pptx-validator-types';

/** `CT_Slide` (ECMA-376 Part 1 §19.3.1.38) child sequence. */
const SLIDE_ORDER = ['cSld', 'clrMapOvr', 'transition', 'timing', 'extLst'];
/** `CT_SlideLayout` (§19.3.1.39) child sequence. */
const LAYOUT_ORDER = ['cSld', 'clrMapOvr', 'transition', 'timing', 'hf', 'extLst'];
/** `CT_SlideMaster` (§19.3.1.42) child sequence. */
const MASTER_ORDER = [
	'cSld',
	'clrMap',
	'sldLayoutIdLst',
	'transition',
	'timing',
	'hf',
	'txStyles',
	'extLst',
];
/** `CT_CommonSlideData` (§19.3.1.16) child sequence. */
const COMMON_SLIDE_ORDER = ['bg', 'spTree', 'custDataLst', 'controls', 'extLst'];
/** `CT_GroupShape` (§19.3.1.22): the two children every shape tree opens with. */
const SHAPE_TREE_START = ['nvGrpSpPr', 'grpSpPr'];

/**
 * A `<p:sp>` whose first child is `<p:nvGrpSpPr>`. `CT_Shape` (§19.3.1.43)
 * must begin with `p:nvSpPr`; a group payload wrapped in a `p:sp` tag is
 * well-formed XML that desktop PowerPoint either repairs or rejects. The
 * back-reference keeps the prefix consistent so `<p:sp>` is never paired with
 * an `nvGrpSpPr` from a different namespace.
 */
const GROUP_PAYLOAD_IN_SHAPE = /<((?:[\w.-]+:)?)sp(\s[^>]*)?>\s*<\1nvGrpSpPr\b/g;

function validateShapeTree(xml: string, path: string, issues: ValidationIssue[]): void {
	const tree = elementXml(xml, 'spTree');
	if (!tree) {
		issue(issues, path, 'MISSING_REQUIRED_ELEMENT', '<p:cSld> must contain <p:spTree>');
		return;
	}
	const children = directChildren(tree);
	for (let i = 0; i < SHAPE_TREE_START.length; i++) {
		if (children[i] !== SHAPE_TREE_START[i]) {
			issue(
				issues,
				path,
				'INVALID_SHAPE_TREE',
				`<p:spTree> child ${i + 1} must be <p:${SHAPE_TREE_START[i]}>`,
			);
		}
	}
	for (const match of tree.matchAll(GROUP_PAYLOAD_IN_SHAPE)) {
		if (match[2]?.trimEnd().endsWith('/')) {
			continue;
		}
		issue(
			issues,
			path,
			'INVALID_SHAPE_CONTAINER',
			'<p:sp> must start with <p:nvSpPr>; a <p:nvGrpSpPr> payload belongs in <p:grpSp>',
		);
	}
}

/**
 * The `p:cSld` rules shared by slides, slide layouts and slide masters
 * (`CT_CommonSlideData`): presence, child order, and the shape tree.
 * `parent` names the enclosing root for the message. `elementXml` matches
 * the element by local name, so the root tag does not matter.
 */
function validateCommonSlidePart(
	xml: string,
	path: string,
	parent: string,
	issues: ValidationIssue[],
): void {
	const common = elementXml(xml, 'cSld');
	if (!common) {
		issue(issues, path, 'MISSING_REQUIRED_ELEMENT', `${parent} must contain <p:cSld>`);
		return;
	}
	validateOrder(common, COMMON_SLIDE_ORDER, path, '<p:cSld>', issues);
	validateShapeTree(common, path, issues);
}

export function validateSlide(xml: string, path: string, issues: ValidationIssue[]): void {
	if (!/:sld\b/.test(rootTag(xml) ?? '')) {
		issue(issues, path, 'INVALID_SLIDE_ROOT', 'Slide part must have a p:sld root');
		return;
	}
	validateOrder(xml, SLIDE_ORDER, path, '<p:sld>', issues);
	validateCommonSlidePart(xml, path, '<p:sld>', issues);
}

/**
 * Layout and master roots are contracted by the part-model check, so a wrong
 * root is reported there; these only add the content-model rules.
 */
export function validateSlideLayout(xml: string, path: string, issues: ValidationIssue[]): void {
	if (!/:sldLayout\b/.test(rootTag(xml) ?? '')) {
		return;
	}
	validateOrder(xml, LAYOUT_ORDER, path, '<p:sldLayout>', issues);
	validateCommonSlidePart(xml, path, '<p:sldLayout>', issues);
}

export function validateSlideMaster(xml: string, path: string, issues: ValidationIssue[]): void {
	if (!/:sldMaster\b/.test(rootTag(xml) ?? '')) {
		return;
	}
	validateOrder(xml, MASTER_ORDER, path, '<p:sldMaster>', issues);
	validateCommonSlidePart(xml, path, '<p:sldMaster>', issues);
}
