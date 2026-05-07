/**
 * Service for parsing and building OOXML slide transition XML.
 *
 * Handles both standard OOXML transitions (fade, push, wipe, etc.) and
 * Office 2010+ (p14 namespace) extended transitions (conveyor, doors,
 * prism, etc.) stored in extension lists.
 *
 * @module PptxSlideTransitionService
 */
import type {
	PptxSlideTransition,
	PptxSplitOrientation,
	PptxTransitionType,
	XmlObject,
} from '../types';
import { parseP14FromExtLst, buildP14ExtLst, P14_TRANSITION_TYPES } from './p14-transition-parser';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';

/**
 * Extension URI for the PowerPoint 2016+ `morph` slide transition.
 * Stored in `p:transition/p:extLst/p:ext[@uri="{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}"]/p159:morph`.
 */
const MORPH_EXT_URI = '{C7C9D14B-FE2A-4D35-B620-AB07D5B017F4}';

/** Set of standard OOXML slide transition type names (ISO/IEC 29500-1). */
const TRANSITION_TYPES: Set<string> = new Set([
	'fade',
	'push',
	'wipe',
	'split',
	'randomBar',
	'cut',
	'blinds',
	'checker',
	'circle',
	'comb',
	'cover',
	'diamond',
	'dissolve',
	'plus',
	'pull',
	'random',
	'strips',
	'uncover',
	'wedge',
	'wheel',
	'zoom',
	'newsflash',
]);

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
		const transitionNode = this.xmlLookupService.getChildByLocalName(slideRoot, 'transition');
		if (!transitionNode) {
			return undefined;
		}

		let transitionType: PptxTransitionType = 'cut';
		let direction: string | undefined;
		let orient: PptxSplitOrientation | undefined;
		let spokes: number | undefined;
		let pattern: string | undefined;
		let thruBlk: boolean | undefined;
		let rawSoundAction: XmlObject | undefined;
		let rawExtLst: XmlObject | undefined;

		for (const [key, value] of Object.entries(transitionNode)) {
			if (key.startsWith('@_')) {
				continue;
			}
			const localName = this.getXmlLocalName(key);
			if (localName === 'sndAc') {
				rawSoundAction = value as XmlObject;
				continue;
			}
			if (localName === 'extLst') {
				rawExtLst = value as XmlObject;
				continue;
			}

			if (TRANSITION_TYPES.has(localName)) {
				transitionType = localName as PptxTransitionType;
			}

			if (value && typeof value === 'object' && !Array.isArray(value)) {
				const detail = value as XmlObject;

				// Direction attribute (@_dir)
				const rawDir = String(detail['@_dir'] || '').trim();
				if (rawDir.length > 0) {
					direction = rawDir;
				}

				// Orientation attribute (@_orient) for split/blinds/checker/comb/randomBar
				const rawOrient = String(detail['@_orient'] || '').trim();
				if (rawOrient === 'horz' || rawOrient === 'vert') {
					orient = rawOrient;
				}

				// Spokes count for wheel transition (@_spokes)
				const rawSpokes = String(detail['@_spokes'] || '').trim();
				if (rawSpokes.length > 0) {
					const parsedSpokes = Number.parseInt(rawSpokes, 10);
					// ST_WheelTransition/@spokes is xsd:unsignedInt (no upper bound in schema).
					if (Number.isFinite(parsedSpokes) && parsedSpokes >= 1) {
						spokes = parsedSpokes;
					}
				}

				// Pattern for shred transition (@_pattern)
				const rawPattern = String(detail['@_pattern'] || '').trim();
				if (rawPattern.length > 0) {
					pattern = rawPattern;
				}

				// Through-black flag (@_thruBlk) for blinds/checker
				const rawThruBlk = String(detail['@_thruBlk'] || '').trim();
				if (rawThruBlk.length > 0) {
					thruBlk = !['0', 'false', 'off'].includes(rawThruBlk.toLowerCase());
				}
			}
		}

		// Parse p14 (Office 2010+) transitions from extLst if no standard
		// transition type was found or if there is an extLst to parse
		if (rawExtLst && transitionType === 'cut') {
			const p14Result = parseP14FromExtLst(rawExtLst, this.xmlLookupService, this.getXmlLocalName);
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
			} else if (this.parseMorphFromExtLst(rawExtLst)) {
				// PowerPoint 2016+ `morph` lives in a p159 extension.
				transitionType = 'morph';
			}
		}

		const parsedDuration = Number.parseInt(String(transitionNode['@_dur'] || ''), 10);
		const durationMs =
			Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : undefined;

		const advanceOnClickToken = String(transitionNode['@_advClick'] || '').trim();
		const advanceOnClick =
			advanceOnClickToken.length > 0
				? !['0', 'false', 'off'].includes(advanceOnClickToken.toLowerCase())
				: undefined;

		const parsedAdvanceAfter = Number.parseInt(String(transitionNode['@_advTm'] || ''), 10);
		const advanceAfterMs =
			Number.isFinite(parsedAdvanceAfter) && parsedAdvanceAfter >= 0
				? parsedAdvanceAfter
				: undefined;

		// Extract sound relationship ID and endSnd flag from rawSoundAction.
		// CT_TransitionSoundAction is a choice: either p:stSnd (start sound) or p:endSnd (stop sound).
		let soundRId: string | undefined;
		let stopSound: boolean | undefined;
		if (rawSoundAction) {
			const stSnd = this.xmlLookupService.getChildByLocalName(rawSoundAction, 'stSnd');
			if (stSnd) {
				const snd = this.xmlLookupService.getChildByLocalName(stSnd, 'snd');
				if (snd) {
					const embed = snd['@_r:embed'] ?? snd['@_embed'];
					if (embed) {
						soundRId = String(embed);
					}
				}
			}
			// `endSnd` is CT_Empty; presence alone signals "stop currently-playing sound".
			let hasEndSnd = false;
			for (const key of Object.keys(rawSoundAction)) {
				if (key.startsWith('@_')) {
					continue;
				}
				if (this.getXmlLocalName(key) === 'endSnd') {
					hasEndSnd = true;
					break;
				}
			}
			if (hasEndSnd) {
				stopSound = true;
			}
		}

		return {
			type: transitionType,
			direction,
			orient,
			spokes,
			pattern,
			thruBlk,
			durationMs,
			advanceOnClick,
			advanceAfterMs,
			soundRId,
			stopSound,
			rawSoundAction,
			rawExtLst,
		};
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
		const isMorphType = transitionType === 'morph';
		const node: XmlObject = {};

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
		} else if (isMorphType) {
			// PowerPoint 2016+ `morph` lives in the p159 extension list, not as a
			// direct child of `p:transition`. Emitting `<p:morph/>` is silently
			// dropped by PowerPoint.
			node['p:extLst'] = this.buildMorphExtLst(transition.rawExtLst);
		} else if (transitionType === 'cut' || transitionType === 'fade') {
			// Both `cut` and `fade` use CT_OptionalBlackTransition, which carries the
			// `thruBlk` attribute. Build the child object so `thruBlk` round-trips.
			const childNode: XmlObject = {};
			if (typeof transition.thruBlk === 'boolean') {
				childNode['@_thruBlk'] = transition.thruBlk ? '1' : '0';
			}
			node[`p:${transitionType}`] = childNode;
		} else {
			const childNode: XmlObject = {};
			const direction = String(transition.direction || '').trim();
			if (direction.length > 0) {
				childNode['@_dir'] = direction;
			}
			if (transition.orient) {
				childNode['@_orient'] = transition.orient;
			}
			if (typeof transition.spokes === 'number' && transition.spokes >= 1) {
				childNode['@_spokes'] = String(transition.spokes);
			}
			if (transition.pattern) {
				childNode['@_pattern'] = transition.pattern;
			}
			if (typeof transition.thruBlk === 'boolean') {
				childNode['@_thruBlk'] = transition.thruBlk ? '1' : '0';
			}
			node[`p:${transitionType}`] = childNode;
		}

		if (
			typeof transition.durationMs === 'number' &&
			Number.isFinite(transition.durationMs) &&
			transition.durationMs > 0
		) {
			node['@_dur'] = String(Math.round(transition.durationMs));
		}

		if (typeof transition.advanceOnClick === 'boolean') {
			node['@_advClick'] = transition.advanceOnClick ? '1' : '0';
		}

		if (
			typeof transition.advanceAfterMs === 'number' &&
			Number.isFinite(transition.advanceAfterMs) &&
			transition.advanceAfterMs >= 0
		) {
			node['@_advTm'] = String(Math.round(transition.advanceAfterMs));
		}

		// Sound action: prefer typed `stopSound` (emits `<p:endSnd/>`), otherwise
		// pass through any preserved rawSoundAction (which may carry `p:stSnd`).
		if (transition.stopSound) {
			node['p:sndAc'] = { 'p:endSnd': {} };
		} else if (transition.rawSoundAction) {
			node['p:sndAc'] = transition.rawSoundAction;
		}
		// Only write rawExtLst when we did not already build our own extLst.
		// p14 and morph types build their own extLst (and merge the rest of rawExtLst).
		if (transition.rawExtLst && !isP14Type && !isMorphType) {
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
