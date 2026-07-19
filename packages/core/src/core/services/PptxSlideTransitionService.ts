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
import { parseP14FromExtLst, buildP14ExtLst, P14_TRANSITION_TYPES } from './p14-transition-parser';
import {
	parseP15FromExtLst,
	buildP15ExtLst,
	P15_TRANSITION_PRESETS,
} from './p15-transition-parser';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';
import {
	applyTransitionAttributes,
	buildStandardTransitionChild,
	buildTransitionSound,
	createPreservedTransitionNode,
	parseTransitionAttributes,
	parseTransitionDetails,
	parseTransitionSound,
} from './slide-transition-xml';

/**
 * Extension URI for the PowerPoint 2016+ `morph` slide transition.
 * Stored in `p:transition/p:extLst/p:ext[@uri="{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}"]/p159:morph`.
 */
const MORPH_EXT_URI = '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}';

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
			this.findTransitionInAlternateContent(slideRoot);
		if (!transitionNode) {
			return undefined;
		}

		const details = parseTransitionDetails(transitionNode, this.getXmlLocalName);
		let transitionType = details.type;
		let { direction, orient, pattern } = details;
		const { spokes, thruBlk, rawSoundAction, rawExtLst } = details;

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
			} else if (this.parseMorphFromExtLst(rawExtLst)) {
				// PowerPoint 2016+ `morph` lives in a p159 extension.
				transitionType = 'morph';
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
			...sound,
			rawSoundAction,
			rawExtLst,
			rawTransition: transitionNode,
		};
	}

	/**
	 * Locate a `<p:transition>` wrapped in a slide-root `mc:AlternateContent`
	 * envelope.
	 *
	 * Real PowerPoint (verified via COM-authored fixtures) wraps the
	 * transition in `mc:AlternateContent` whenever it carries an Office
	 * 2010+ attribute such as `p14:dur` (sub-second transition duration):
	 * an `mc:Choice Requires="p14"` branch carries the richer transition,
	 * and `mc:Fallback` carries a plain one for older readers. Without this
	 * unwrap, `p:sld`'s direct-child lookup for `transition` finds nothing
	 * and the whole transition (including plain ones falling back with no
	 * p14 data) is silently dropped, even though `mc:Choice` is otherwise a
	 * complete, directly usable `p:transition` node.
	 */
	private findTransitionInAlternateContent(
		slideRoot: XmlObject | undefined,
	): XmlObject | undefined {
		const altContent = this.xmlLookupService.getChildByLocalName(slideRoot, 'AlternateContent');
		if (!altContent) {
			return undefined;
		}
		const choices = this.xmlLookupService.getChildrenArrayByLocalName(altContent, 'Choice');
		for (const choice of choices) {
			const transitionNode = this.xmlLookupService.getChildByLocalName(choice, 'transition');
			if (transitionNode) {
				return transitionNode;
			}
		}
		const fallback = this.xmlLookupService.getChildByLocalName(altContent, 'Fallback');
		return this.xmlLookupService.getChildByLocalName(fallback, 'transition');
	}

	/**
	 * Detects the PowerPoint 2016+ `morph` transition stored as a p159 extension
	 * inside the transition's extLst.
	 */
	private parseMorphFromExtLst(extLstNode: XmlObject): boolean {
		const extEntries = this.xmlLookupService.getChildrenArrayByLocalName(extLstNode, 'ext');
		for (const ext of extEntries) {
			if (!ext) {
				continue;
			}
			const uri = String(ext['@_uri'] || '').trim();
			const matchesUri = uri.toUpperCase() === MORPH_EXT_URI.toUpperCase();
			for (const key of Object.keys(ext)) {
				if (key.startsWith('@_')) {
					continue;
				}
				if (this.getXmlLocalName(key) === 'morph') {
					// Accept either matching uri or just the morph element (be lenient on URI casing/whitespace).
					if (matchesUri || uri.length === 0) {
						return true;
					}
					return true;
				}
			}
		}
		return false;
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

		if (isP14Type) {
			// p14 transitions are stored in the extLst, not as direct children
			node['p:extLst'] = buildP14ExtLst(
				transitionType,
				transition.direction,
				transition.orient,
				transition.pattern,
				transition.rawExtLst,
				this.xmlLookupService,
				this.getXmlLocalName,
			);
		} else if (isP15Type) {
			// PowerPoint 2013+/365 preset transitions live in a `p15:prstTrans`
			// extension, not as a direct child of `p:transition`. Emitting a
			// standard child (or the historical `<p:cut/>` fallback) corrupts the
			// file. Preserve the real extLst bytes when present; otherwise
			// fabricate a minimal `p15:prstTrans` extension.
			node['p:extLst'] = transition.rawExtLst ?? buildP15ExtLst(transitionType);
		} else if (isMorphType) {
			// PowerPoint 2016+ `morph` lives in the p159 extension list, not as a
			// direct child of `p:transition`. Emitting `<p:morph/>` is silently
			// dropped by PowerPoint.
			node['p:extLst'] = this.buildMorphExtLst(transition.rawExtLst);
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
		// Only write rawExtLst when we did not already build our own extLst.
		// p14, p15 and morph types build (or preserve) their own extLst.
		if (transition.rawExtLst && !isP14Type && !isP15Type && !isMorphType) {
			node['p:extLst'] = transition.rawExtLst;
		}

		return node;
	}

	/**
	 * Build the extLst XML node for a morph (p159) transition, preserving any
	 * non-morph extensions from rawExtLst.
	 */
	private buildMorphExtLst(rawExtLst: XmlObject | undefined): XmlObject {
		const morphExt: XmlObject = {
			'@_uri': MORPH_EXT_URI,
			'p159:morph': {
				'@_xmlns:p159': 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
			},
		};

		if (!rawExtLst) {
			return { 'p:ext': morphExt };
		}

		const existing = this.xmlLookupService.getChildrenArrayByLocalName(rawExtLst, 'ext');
		const otherExts = existing.filter((ext) => {
			if (!ext) {
				return false;
			}
			const uri = String(ext['@_uri'] || '').trim();
			if (uri.toUpperCase() === MORPH_EXT_URI.toUpperCase()) {
				return false;
			}
			for (const key of Object.keys(ext)) {
				if (key.startsWith('@_')) {
					continue;
				}
				if (this.getXmlLocalName(key) === 'morph') {
					return false;
				}
			}
			return true;
		});
		const allExts = [morphExt, ...otherExts];
		return { 'p:ext': allExts.length === 1 ? allExts[0] : allExts };
	}
}
