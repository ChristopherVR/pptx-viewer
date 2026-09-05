import type { PptxElementAnimation, XmlObject } from '../types';
import { serializeBldPTemplates } from './animation-timing-templates';
import { buildSingleEffectNode, buildMotionPathNode } from './animation-write-node-builders';

/**
 * Build effect nodes for a single animation entry.
 * An animation can have entrance, emphasis, and exit effects,
 * each producing its own p:par node.
 */
export function buildEffectNodesForAnimation(
	anim: PptxElementAnimation,
	allocateId: () => number,
): XmlObject[] {
	const nodes: XmlObject[] = [];

	if (anim.entrance && anim.entrance !== 'none') {
		const node = buildSingleEffectNode(anim, anim.entrance, 'entr', allocateId);
		if (node) {
			nodes.push(node);
		}
	}

	if (anim.emphasis && anim.emphasis !== 'none') {
		const triggerForEmphasis = nodes.length > 0 ? 'afterPrevious' : (anim.trigger ?? 'onClick');
		const node = buildSingleEffectNode(
			{ ...anim, trigger: triggerForEmphasis },
			anim.emphasis,
			'emph',
			allocateId,
		);
		if (node) {
			nodes.push(node);
		}
	}

	if (anim.exit && anim.exit !== 'none') {
		const triggerForExit = nodes.length > 0 ? 'afterPrevious' : (anim.trigger ?? 'onClick');
		const node = buildSingleEffectNode(
			{ ...anim, trigger: triggerForExit },
			anim.exit,
			'exit',
			allocateId,
		);
		if (node) {
			nodes.push(node);
		}
	}

	if (anim.motionPath) {
		const triggerForPath = nodes.length > 0 ? 'withPrevious' : (anim.trigger ?? 'onClick');
		const node = buildMotionPathNode({ ...anim, trigger: triggerForPath }, allocateId);
		if (node) {
			nodes.push(node);
		}
	}

	return nodes;
}

/**
 * Build a single `p:bldP` node (CT_TLBuildParagraph) from an editor
 * animation's build-related fields (`sequence`, `buildTemplates`).
 *
 * Returns `undefined` when the animation has no paragraph-level build
 * (`sequence` unset or `"asOne"`), mirroring PowerPoint: a shape with no text
 * build gets no `p:bldP` entry at all.
 *
 * Shared by both write paths: the full-rebuild path
 * ({@link buildBuildListXml}) calls it once per animation to compose a fresh
 * `p:bldLst`, and the surgical path (`animation-timing-build-surgical.ts`)
 * calls it to re-derive one `p:bldP` entry in place when a slide already has
 * a `p:timing` tree, so an edited `sequence` or `buildTemplates` is not
 * silently dropped there too.
 */
export function buildBldPNode(anim: PptxElementAnimation): XmlObject | undefined {
	if (!anim.sequence || anim.sequence === 'asOne') {
		return undefined;
	}

	const bldType =
		anim.sequence === 'byParagraph' ? 'p' : anim.sequence === 'byWord' ? 'word' : 'char';

	const bldPNode: XmlObject = {
		'@_spid': anim.elementId,
		'@_grpId': '0',
		'@_build': bldType,
	};
	// Re-emit the loaded per-build-level `p:tmplLst` (issue: "buildTemplates
	// write wiring") so a full timing-tree rebuild does not silently drop it;
	// `serializeBldPTemplates` mirrors what `extractBldPTemplates` parses.
	if (anim.buildTemplates && anim.buildTemplates.length > 0) {
		const tmplLst = serializeBldPTemplates(anim.buildTemplates);
		if (tmplLst) {
			bldPNode['p:tmplLst'] = tmplLst;
		}
	}
	return bldPNode;
}

/**
 * Build the p:bldLst node for paragraph-level animation sequencing.
 */
export function buildBuildListXml(animations: PptxElementAnimation[]): XmlObject | undefined {
	const bldPNodes: XmlObject[] = [];

	for (const anim of animations) {
		const bldPNode = buildBldPNode(anim);
		if (bldPNode) {
			bldPNodes.push(bldPNode);
		}
	}

	if (bldPNodes.length === 0) {
		return undefined;
	}

	return {
		'p:bldP': bldPNodes.length === 1 ? bldPNodes[0] : bldPNodes,
	};
}

/**
 * Wrap effect nodes in the click-group `p:par` PowerPoint puts between the
 * main sequence and its effects: a `p:cTn` gated by a lone
 * `<p:cond delay="indefinite"/>`, which is what makes the group wait for a
 * click.
 */
export function buildClickGroupNode(effectNodes: XmlObject[], allocateId: () => number): XmlObject {
	return {
		'p:cTn': {
			'@_id': String(allocateId()),
			'@_fill': 'hold',
			'p:stCondLst': {
				'p:cond': {
					'@_delay': 'indefinite',
				},
			},
			'p:childTnLst': {
				'p:par': effectNodes.length === 1 ? effectNodes[0] : effectNodes,
			},
		},
	} as XmlObject;
}

/**
 * Build the `p:seq nodeType="interactiveSeq"` container PowerPoint uses for
 * effects triggered by clicking a specific shape.
 */
export function wrapInInteractiveSequence(
	effectNodes: XmlObject[],
	triggerShapeId: string,
	allocateId: () => number,
): XmlObject {
	const seqId = allocateId();
	const groupId = allocateId();

	const wrappedPar: XmlObject = {
		'p:cTn': {
			'@_id': String(groupId),
			'@_fill': 'hold',
			'p:stCondLst': {
				'p:cond': {
					'@_delay': '0',
				},
			},
			'p:childTnLst': {
				'p:par': effectNodes.length === 1 ? effectNodes[0] : effectNodes,
			},
		},
	};

	return {
		'p:cTn': {
			'@_id': String(seqId),
			'@_dur': 'indefinite',
			'@_nodeType': 'interactiveSeq',
			'p:stCondLst': {
				'p:cond': {
					'@_evt': 'onClick',
					'@_delay': '0',
					'p:tgtEl': {
						'p:spTgt': {
							'@_spid': triggerShapeId,
						},
					},
				},
			},
			'p:childTnLst': {
				'p:par': wrappedPar,
			},
		},
		'p:nextCondLst': {
			'p:cond': {
				'@_evt': 'onClick',
				'@_delay': '0',
				'p:tgtEl': {
					'p:spTgt': {
						'@_spid': triggerShapeId,
					},
				},
			},
		},
	} as XmlObject;
}

/**
 * Build the `p:seq nodeType="mainSeq"` container that holds a slide's
 * click-driven animation sequence.
 */
export function buildMainSequenceNode(mainSeqId: number, children: XmlObject[]): XmlObject {
	const node: XmlObject = {
		'@_concurrent': '1',
		'@_nextAc': 'seek',
		'p:cTn': {
			'@_id': String(mainSeqId),
			'@_dur': 'indefinite',
			'@_nodeType': 'mainSeq',
			...(children.length > 0
				? {
						'p:childTnLst': {
							'p:par': children.length === 1 ? children[0] : children,
						},
					}
				: {}),
		},
		'p:prevCondLst': {
			'p:cond': {
				'@_evt': 'onPrev',
				'@_delay': '0',
				'p:tgtEl': {
					'p:sldTgt': {},
				},
			},
		},
		'p:nextCondLst': {
			'p:cond': {
				'@_evt': 'onNext',
				'@_delay': '0',
				'p:tgtEl': {
					'p:sldTgt': {},
				},
			},
		},
	};
	return node;
}

/**
 * Build interactive sequence `p:seq` nodes for animations triggered by
 * clicking a specific shape. Groups animations by their `triggerShapeId`.
 */
export function buildInteractiveSequences(
	animations: PptxElementAnimation[],
	allocateId: () => number,
): XmlObject[] {
	if (animations.length === 0) {
		return [];
	}

	const byTrigger = new Map<string, PptxElementAnimation[]>();
	for (const anim of animations) {
		const key = anim.triggerShapeId ?? '';
		if (!key) {
			continue;
		}
		const existing = byTrigger.get(key) ?? [];
		existing.push(anim);
		byTrigger.set(key, existing);
	}

	const seqNodes: XmlObject[] = [];

	for (const [triggerShapeId, anims] of byTrigger) {
		const effectNodes = anims.flatMap((a) => buildEffectNodesForAnimation(a, allocateId));
		if (effectNodes.length === 0) {
			continue;
		}
		seqNodes.push(wrapInInteractiveSequence(effectNodes, triggerShapeId, allocateId));
	}

	return seqNodes;
}
