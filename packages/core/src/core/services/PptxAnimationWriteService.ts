import type { PptxElementAnimation, XmlObject } from '../types';
import { writeOwnedEffectKeys } from './animation-timing-ownership';
import { ownedEffectKeysFor, surgicallyUpdateTimingTree } from './animation-timing-surgical';
import type { IPptxAnimationWriteService } from './animation-write-mappings';
import {
	buildEffectNodesForAnimation,
	buildBuildListXml,
	buildClickGroupNode,
	buildInteractiveSequences,
	buildMainSequenceNode,
} from './animation-write-sequence-builders';

export type { IPptxAnimationWriteService } from './animation-write-mappings';

/**
 * Add the condition PowerPoint writes for a click step that begins with the
 * slide instead of waiting for a click: the indefinite gate stays (a click may
 * still start it early) and an `onBegin` tie to the main sequence makes it fire
 * as soon as the show reaches this slide. See `animation-group-context` for the
 * reading side.
 */
function markGroupAutoStart(groupNode: XmlObject | undefined, mainSeqId: number): void {
	const cTn = groupNode?.['p:cTn'] as XmlObject | undefined;
	if (!cTn) {
		return;
	}
	cTn['p:stCondLst'] = {
		'p:cond': [
			{ '@_delay': 'indefinite' },
			{ '@_evt': 'onBegin', '@_delay': '0', 'p:tn': { '@_val': String(mainSeqId) } },
		],
	};
}

/**
 * Service that serializes `PptxElementAnimation[]` into valid OOXML
 * `p:timing` XML structures for writing back to .pptx files.
 */
export class PptxAnimationWriteService implements IPptxAnimationWriteService {
	private nextId: number = 1;

	/**
	 * Build a complete `p:timing` XML object from editor animations.
	 *
	 * When `existingRawTiming` is provided, performs surgical updates on
	 * the existing timing tree rather than regenerating it. This preserves
	 * complex structures (endCondLst, nested sequences, etc.) that would
	 * be destroyed by a full rebuild.
	 *
	 * Falls back to full regeneration when no existing tree is available.
	 */
	public buildTimingXml(
		animations: PptxElementAnimation[],
		existingRawTiming: XmlObject | undefined,
	): XmlObject | undefined {
		// Filter to animations that have at least one effect
		const validAnimations = animations
			.filter((a) => a.entrance || a.exit || a.emphasis || a.motionPath)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

		// When an existing timing tree is available, reconcile into it rather
		// than regenerating: a rebuild would drop every structure the typed
		// model does not carry. An EMPTY list still goes down this path, because
		// "the user deleted the effects we added" has to reach the tree too.
		if (existingRawTiming) {
			const cloned = (
				typeof structuredClone === 'function'
					? structuredClone(existingRawTiming)
					: JSON.parse(JSON.stringify(existingRawTiming))
			) as XmlObject;
			return surgicallyUpdateTimingTree(cloned, validAnimations);
		}

		if (validAnimations.length === 0) {
			return undefined;
		}

		this.nextId = 1;

		// Separate regular and interactive (onShapeClick) animations
		const regularAnimations = validAnimations.filter((a) => a.trigger !== 'onShapeClick');
		const interactiveAnimations = validAnimations.filter(
			(a) => a.trigger === 'onShapeClick' && a.triggerShapeId,
		);

		// Build the animation sequence nodes grouped by trigger
		const { nodes: animationNodes, firstGroupAutoStarts } =
			this.buildAnimationSequence(regularAnimations);
		if (animationNodes.length === 0 && interactiveAnimations.length === 0) {
			return existingRawTiming;
		}

		// Build the root p:timing structure
		const rootParId = this.allocateId();
		const mainSeqId = this.allocateId();

		// PowerPoint gates a click step with a lone `<p:cond delay="indefinite"/>`.
		// A deck whose FIRST effect is "With/After Previous" starts on slide entry
		// instead, which PowerPoint records by also tying the step to the main
		// sequence beginning. Writing only the indefinite gate turned every such
		// deck into a click-gated one on save, so the reloaded file showed a blank
		// slide until the viewer clicked (issue #106).
		if (firstGroupAutoStarts) {
			markGroupAutoStart(animationNodes[0], mainSeqId);
		}

		const mainSeqNode = buildMainSequenceNode(mainSeqId, [...animationNodes]);

		// Build interactive sequence nodes
		const interactiveSeqNodes = buildInteractiveSequences(
			interactiveAnimations,
			this.allocateId.bind(this),
		);

		// Combine main seq + interactive sequences into the child list
		const seqNodes: XmlObject | XmlObject[] =
			interactiveSeqNodes.length === 0 ? mainSeqNode : [mainSeqNode, ...interactiveSeqNodes];

		const timingXml: XmlObject = {
			'p:tnLst': {
				'p:par': {
					'p:cTn': {
						'@_id': String(rootParId),
						'@_dur': 'indefinite',
						'@_restart': 'never',
						'@_nodeType': 'tmRoot',
						'p:childTnLst': {
							'p:seq': seqNodes,
						},
					},
				},
			},
		};

		// Build the build list for paragraph-level animations
		const buildList = buildBuildListXml(validAnimations);
		if (buildList) {
			timingXml['p:bldLst'] = buildList;
		}

		// Record what this tree owns, exactly as the reconcile path does: on the
		// next save the whole tree is "existing", and without the registry the
		// reconciler could not tell these effects from a deck's own and so could
		// never delete one the user removed.
		writeOwnedEffectKeys(timingXml, ownedEffectKeysFor(validAnimations));

		return timingXml;
	}

	/**
	 * Build animation sequence nodes -- each onClick trigger starts a new
	 * click-group (p:par container), while afterPrevious/withPrevious
	 * animations are nested within the current group.
	 */
	private buildAnimationSequence(animations: PptxElementAnimation[]): {
		nodes: XmlObject[];
		firstGroupAutoStarts: boolean;
	} {
		const clickGroups: XmlObject[][] = [];
		let currentGroup: XmlObject[] = [];
		/** Trigger of the effect that opened the first click group. */
		let firstTrigger: PptxElementAnimation['trigger'];

		for (const anim of animations) {
			const effectNodes = this.buildEffectNodesForAnimation(anim);
			if (effectNodes.length === 0) {
				continue;
			}

			const trigger = anim.trigger ?? 'onClick';
			firstTrigger ??= trigger;

			if (trigger === 'onClick' || currentGroup.length === 0) {
				if (currentGroup.length > 0) {
					clickGroups.push(currentGroup);
				}
				currentGroup = [];
			}

			for (const effectNode of effectNodes) {
				currentGroup.push(effectNode);
			}
		}

		if (currentGroup.length > 0) {
			clickGroups.push(currentGroup);
		}

		// Wrap each click group in a p:par container
		const nodes = clickGroups.map((group) =>
			buildClickGroupNode(group, this.allocateId.bind(this)),
		);

		return {
			nodes,
			firstGroupAutoStarts: firstTrigger !== undefined && firstTrigger !== 'onClick',
		};
	}

	private buildEffectNodesForAnimation(anim: PptxElementAnimation): XmlObject[] {
		return buildEffectNodesForAnimation(anim, this.allocateId.bind(this));
	}

	private allocateId(): number {
		return this.nextId++;
	}
}
