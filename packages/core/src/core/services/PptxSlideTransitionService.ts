/**
 * Service for parsing and building OOXML slide transition XML.
 *
 * Handles both standard OOXML transitions (fade, push, wipe, etc.) and
 * Office 2010+ (p14 namespace) extended transitions (conveyor, doors,
 * prism, etc.) stored in extension lists.
 *
 * @module PptxSlideTransitionService
 */
import type { PptxSlideTransition, XmlObject } from '../types';
import {
	parseP14DirectChild,
	parseP14FromExtLst,
	P14_TRANSITION_TYPES,
} from './p14-transition-parser';
import {
	parseP15DirectChild,
	parseP15FromExtLst,
	P15_TRANSITION_PRESETS,
} from './p15-transition-parser';
import { hasDirectMorphChild, parseMorphFromExtLst } from './p159-morph-transition';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';
import {
	findTransitionInAlternateContent,
	preservedP14ChildKey,
	preservedP15ChildKey,
	pruneDirectExtensionChildren,
} from './slide-transition-envelope';
import {
	applyTransitionAttributes,
	buildStandardTransitionChild,
	buildTransitionSound,
	createPreservedTransitionNode,
	parseTransitionAttributes,
	parseTransitionDetails,
	parseTransitionSound,
} from './slide-transition-xml';
import type { ExtensionChildContext } from './transition-extension-child';
import {
	buildMorphDirectChild,
	buildP14DirectChild,
	buildP15DirectChild,
	retainNonTransitionExtensions,
} from './transition-extension-child';

/**
 * Configuration options for creating a {@link PptxSlideTransitionService}.
 */
export interface PptxSlideTransitionServiceOptions {
	/** Service for namespace-aware XML child lookups. */
	xmlLookupService: IPptxXmlLookupService;
	/** Utility to extract the local name portion from a namespaced XML key. */
	getXmlLocalName: (xmlKey: string) => string;
}

/**
 * Interface for parsing and building slide transition XML.
 */
export interface IPptxSlideTransitionService {
	/**
	 * Parse the `p:transition` element from a slide's XML.
	 * @param slideXml - The full slide XML object.
	 * @returns Parsed transition data, or `undefined` if no transition is defined.
	 */
	parseSlideTransition(slideXml: XmlObject | undefined): PptxSlideTransition | undefined;
	/**
	 * Build a `p:transition` XML object from transition data.
	 * @param transition - Transition configuration to serialize.
	 * @returns XML object suitable for writing, or `undefined` for "none" transitions.
	 */
	buildSlideTransitionXml(transition: PptxSlideTransition): XmlObject | undefined;
}

/**
 * Concrete service for parsing slide transition XML from OOXML presentations
 * and serializing transition data back to XML.
 *
 * Supports both standard transitions and p14 (Office 2010+) extended
 * transitions stored in extension lists.
 */
export class PptxSlideTransitionService implements IPptxSlideTransitionService {
	private readonly xmlLookupService: IPptxXmlLookupService;

	private readonly getXmlLocalName: (xmlKey: string) => string;

	public constructor(options: PptxSlideTransitionServiceOptions) {
		this.xmlLookupService = options.xmlLookupService;
		this.getXmlLocalName = options.getXmlLocalName;
	}

	public parseSlideTransition(slideXml: XmlObject | undefined): PptxSlideTransition | undefined {
		const slideRoot = this.xmlLookupService.getChildByLocalName(slideXml, 'sld');
		const transitionNode =
			this.xmlLookupService.getChildByLocalName(slideRoot, 'transition') ||
			findTransitionInAlternateContent(slideRoot, this.xmlLookupService);
		if (!transitionNode) {
			return undefined;
		}

		const details = parseTransitionDetails(transitionNode, this.getXmlLocalName);
		let transitionType = details.type;
		let { direction, orient, pattern } = details;
		const { spokes, thruBlk, rawSoundAction, rawExtLst } = details;
		let { morphOption } = details;

		// In the `mc:Choice Requires="p14"/"p15"` form the extension element is
		// a DIRECT child of `p:transition` (`<p14:reveal dir="r"/>`,
		// `<p15:prstTrans prst="origami"/>`), exactly like the direct
		// `p159:morph` form: the envelope already declares the requirement, so
		// PowerPoint skips the `p:extLst` escape hatch. Without this branch
		// those transitions fell through to the `cut` default.
		if (transitionType === 'cut') {
			const p14Direct = parseP14DirectChild(transitionNode, this.getXmlLocalName);
			const p15Direct = p14Direct
				? undefined
				: parseP15DirectChild(transitionNode, this.getXmlLocalName);
			if (p14Direct) {
				transitionType = p14Direct.type;
				direction = p14Direct.direction ?? direction;
				orient = p14Direct.orient ?? orient;
				pattern = p14Direct.pattern ?? pattern;
			} else if (p15Direct) {
				transitionType = p15Direct.type;
			}
		}

		// Parse p14 (Office 2010+) transitions from extLst if no standard
		// transition type was found or if there is an extLst to parse
		if (rawExtLst && transitionType === 'cut') {
			const p14Result = parseP14FromExtLst(rawExtLst, this.xmlLookupService, this.getXmlLocalName);
			const p15Result = p14Result
				? undefined
				: parseP15FromExtLst(rawExtLst, this.xmlLookupService, this.getXmlLocalName);
			if (p14Result) {
				transitionType = p14Result.type;
				if (p14Result.direction) {
					direction = p14Result.direction;
				}
				if (p14Result.orient) {
					orient = p14Result.orient;
				}
				if (p14Result.pattern) {
					pattern = p14Result.pattern;
				}
			} else if (p15Result) {
				// PowerPoint 2013+/365 preset transitions (Fracture, Peel Off,
				// Page Curl, etc.) live in a `p15:prstTrans` extension.
				transitionType = p15Result.type;
			} else {
				const morphResult = parseMorphFromExtLst(
					rawExtLst,
					this.xmlLookupService,
					this.getXmlLocalName,
				);
				if (morphResult) {
					// PowerPoint 2016+ `morph` lives in a p159 extension.
					transitionType = 'morph';
					morphOption = morphResult.morphOption;
				}
			}
		}

		// `@_dur` is the standard millisecond duration; PowerPoint's Office
		// 2010+ `p14:dur` attribute (only present on the `mc:Choice
		// Requires="p14"` copy of the transition) carries the same
		// millisecond precision when the standard attribute is absent.
		const attributes = parseTransitionAttributes(transitionNode);
		const sound = parseTransitionSound(rawSoundAction, this.xmlLookupService, this.getXmlLocalName);

		return {
			type: transitionType,
			...attributes,
			direction,
			orient,
			spokes,
			pattern,
			thruBlk,
			morphOption,
			...sound,
			rawSoundAction,
			rawExtLst,
			rawTransition: transitionNode,
		};
	}

	public buildSlideTransitionXml(transition: PptxSlideTransition): XmlObject | undefined {
		if (!transition || transition.type === 'none') {
			return undefined;
		}

		const transitionType = transition.type || 'cut';
		const isP14Type = P14_TRANSITION_TYPES.has(transitionType);
		const isP15Type = P15_TRANSITION_PRESETS.has(transitionType);
		const isMorphType = transitionType === 'morph';
		const node = createPreservedTransitionNode(transition.rawTransition, this.getXmlLocalName);

		// The mc:Choice form writes p14/p15 elements as DIRECT children of
		// `p:transition`; `createPreservedTransitionNode` keeps those children
		// verbatim (mirroring morph). When the preserved child still matches
		// the transition being written, fabricating the extLst form on top of
		// it would declare the transition twice, so we keep the child and skip
		// the extLst. A preserved child that no longer matches (the type was
		// edited) is pruned instead.
		const p14ChildKey = isP14Type
			? preservedP14ChildKey(node, transitionType, this.getXmlLocalName)
			: undefined;
		const p15ChildKey = isP15Type
			? preservedP15ChildKey(node, transitionType, this.getXmlLocalName)
			: undefined;
		pruneDirectExtensionChildren(node, this.getXmlLocalName, p14ChildKey ?? p15ChildKey);

		// An extension transition goes out as the DIRECT child PowerPoint reads;
		// `slide-transition-reconcile` then wraps the whole element in the
		// `mc:Choice Requires="..."` envelope that makes the child legal. The
		// `p:extLst` form written here previously was silently ignored by
		// PowerPoint, so every extended transition saved as no transition at all.
		const extensionContext: ExtensionChildContext = {
			rawExtLst: transition.rawExtLst,
			xmlLookupService: this.xmlLookupService,
			getXmlLocalName: this.getXmlLocalName,
		};
		const isExtensionType = isP14Type || isP15Type || isMorphType;

		if (isP14Type) {
			if (!p14ChildKey) {
				const child = buildP14DirectChild(
					transitionType,
					{
						direction: transition.direction,
						orient: transition.orient,
						pattern: transition.pattern,
						spokes: transition.spokes,
					},
					extensionContext,
				);
				node[child.key] = child.node;
			}
		} else if (isP15Type) {
			if (!p15ChildKey) {
				const child = buildP15DirectChild(transitionType, extensionContext);
				node[child.key] = child.node;
			}
		} else if (isMorphType) {
			// `createPreservedTransitionNode` keeps an existing direct
			// `<p159:morph/>` verbatim (with its `option`), so only fabricate one
			// when the deck did not already have it.
			if (!hasDirectMorphChild(node, this.getXmlLocalName)) {
				const child = buildMorphDirectChild(transition.morphOption, extensionContext);
				node[child.key] = child.node;
			}
		} else {
			node[`p:${transitionType}`] = buildStandardTransitionChild(transition);
		}

		applyTransitionAttributes(node, transition);

		// Sound action: prefer typed `stopSound` (emits `<p:endSnd/>`), otherwise
		// pass through any preserved rawSoundAction (which may carry `p:stSnd`).
		const soundAction = buildTransitionSound(transition, this.getXmlLocalName);
		if (soundAction) {
			node['p:sndAc'] = soundAction;
		}
		// Extensions the deck carried survive, minus any that declared a
		// transition: that declaration now lives on the element itself, and a
		// leftover copy would contradict it (a stale preset, in the worst case).
		const preservedExtensions = isExtensionType
			? retainNonTransitionExtensions(extensionContext, isTransitionElementName)
			: transition.rawExtLst;
		if (preservedExtensions) {
			node['p:extLst'] = preservedExtensions;
		}

		return node;
	}
}

/** Element local names that declare a transition inside a `p:ext`. */
function isTransitionElementName(localName: string): boolean {
	return P14_TRANSITION_TYPES.has(localName) || localName === 'prstTrans' || localName === 'morph';
}
