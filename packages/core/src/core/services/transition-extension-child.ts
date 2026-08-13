/**
 * Emit an extension transition as the DIRECT child of `p:transition` that
 * PowerPoint actually reads.
 *
 * The `p:extLst` form these transitions used to be written in
 * (`<p:ext uri="{CE6CE671..}"><p14:ferris/></p:ext>`) is inert: measured
 * through COM, such a deck reopens with `EntryEffect = 0`, so every extended
 * transition the picker offered saved as no transition at all. PowerPoint
 * writes the element straight onto `p:transition` inside an
 * `mc:Choice Requires="p14"` instead, and the envelope is added by
 * `slide-transition-reconcile` once the node is built.
 *
 * Attributes the typed model does not carry (`p14:flythrough/@hasBounce`,
 * `p15:prstTrans/@invX`) are lifted off whatever copy of the element the deck
 * already had, so re-serialising a real file is not a downgrade.
 *
 * @module services/transition-extension-child
 */
import type { PptxMorphOption, XmlObject } from '../types';
import { prismFamilyFlags } from './p14-prism-family';
import type { IPptxXmlLookupService } from './PptxXmlLookupService';

const P14_NAMESPACE_URI = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
const P15_NAMESPACE_URI = 'http://schemas.microsoft.com/office/powerpoint/2012/main';
const P159_NAMESPACE_URI = 'http://schemas.microsoft.com/office/powerpoint/2015/09/main';

/** Shared inputs for reading the deck's own extension markup. */
export interface ExtensionChildContext {
	/** The transition's preserved `p:extLst`, when it had one. */
	rawExtLst: XmlObject | undefined;
	xmlLookupService: IPptxXmlLookupService;
	getXmlLocalName: (xmlKey: string) => string;
}

/** A transition element plus the key it must be stored under. */
export interface ExtensionChild {
	key: string;
	node: XmlObject;
}

function elementKeys(node: XmlObject): string[] {
	return Object.keys(node).filter((key) => !key.startsWith('@_'));
}

/** The first element with `localName` found among the extLst's `p:ext` entries. */
function findInExtensions(
	context: ExtensionChildContext,
	localName: string,
): XmlObject | undefined {
	if (!context.rawExtLst) {
		return undefined;
	}
	for (const ext of context.xmlLookupService.getChildrenArrayByLocalName(
		context.rawExtLst,
		'ext',
	)) {
		if (!ext) {
			continue;
		}
		for (const key of elementKeys(ext)) {
			if (context.getXmlLocalName(key) !== localName) {
				continue;
			}
			const value = ext[key];
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				return value as XmlObject;
			}
			return {};
		}
	}
	return undefined;
}

/** Attributes of a preserved element, minus its namespace declarations. */
function inheritedAttributes(source: XmlObject | undefined): XmlObject {
	const out: XmlObject = {};
	if (!source) {
		return out;
	}
	for (const [key, value] of Object.entries(source)) {
		if (key.startsWith('@_') && !key.startsWith('@_xmlns')) {
			out[key] = value as XmlObject[string];
		}
	}
	return out;
}

/**
 * p14 elements PowerPoint never writes without a `dir`, and refuses to open
 * without one: authoring Conveyor, Ferris Wheel, Flip, Gallery or Switch with
 * a bare `<p14:conveyor/>` produced "The file or directory is corrupted and
 * unreadable" (measured). Their `dir` is `ST_TransitionLeftRightDirectionType`,
 * so anything that is not `r` becomes `l`.
 */
const P14_REQUIRED_LEFT_RIGHT: ReadonlySet<string> = new Set([
	'conveyor',
	'ferris',
	'flip',
	'gallery',
	'switch',
]);

/** `<p14:ferris dir="l"/>`, `<p14:reveal dir="r"/>`, ... for an Office 2010 transition. */
export function buildP14DirectChild(
	transitionType: string,
	details: { direction?: string; orient?: string; pattern?: string; spokes?: number },
	context: ExtensionChildContext,
): ExtensionChild {
	// Cube, Rotate, Box and Orbit are all `<p14:prism/>`; only the flags differ.
	// Emitting `<p14:cube/>` instead left PowerPoint with no transition at all.
	const prismFlags = prismFamilyFlags(transitionType);
	const elementName = prismFlags ? 'prism' : transitionType;
	const node: XmlObject = {
		'@_xmlns:p14': P14_NAMESPACE_URI,
		...inheritedAttributes(findInExtensions(context, elementName)),
	};
	if (prismFlags) {
		// The inherited copy carries the flags of whichever family member the
		// deck used to hold. They select the effect, so keeping a stale pair
		// would silently rewrite the type the caller asked for.
		delete node['@_isContent'];
		delete node['@_isInverted'];
	}
	const direction = String(details.direction ?? '').trim();
	if (P14_REQUIRED_LEFT_RIGHT.has(elementName)) {
		node['@_dir'] = direction === 'r' ? 'r' : 'l';
	} else if (direction.length > 0) {
		node['@_dir'] = direction;
	}
	if (details.orient) {
		node['@_orient'] = details.orient;
	}
	if (details.pattern) {
		node['@_pattern'] = details.pattern;
	}
	if (elementName === 'wheelReverse') {
		// PowerPoint always states the spoke count on this element.
		node['@_spokes'] = String(details.spokes && details.spokes > 0 ? details.spokes : 1);
	}
	if (prismFlags?.isContent) {
		node['@_isContent'] = '1';
	}
	if (prismFlags?.isInverted) {
		node['@_isInverted'] = '1';
	}
	return { key: `p14:${elementName}`, node };
}

/** `<p15:prstTrans prst="origami"/>` for a PowerPoint 2013+/365 preset. */
export function buildP15DirectChild(
	transitionType: string,
	context: ExtensionChildContext,
): ExtensionChild {
	return {
		key: 'p15:prstTrans',
		node: {
			'@_xmlns:p15': P15_NAMESPACE_URI,
			...inheritedAttributes(findInExtensions(context, 'prstTrans')),
			'@_prst': transitionType,
		},
	};
}

/**
 * `<p159:morph option="byObject"/>` for the PowerPoint 2016+ Morph transition.
 *
 * The `option` is not optional in practice: PowerPoint writes one of
 * byObject/byWord/byChar every time, and a bare `<p159:morph/>` made the file
 * unopenable (measured). byObject is PowerPoint's own default.
 */
export function buildMorphDirectChild(
	morphOption: PptxMorphOption | undefined,
	context: ExtensionChildContext,
): ExtensionChild {
	const node: XmlObject = {
		'@_xmlns:p159': P159_NAMESPACE_URI,
		...inheritedAttributes(findInExtensions(context, 'morph')),
	};
	// The typed value wins, then whatever the deck's own element said, then
	// PowerPoint's default. Defaulting ahead of the inherited value would
	// silently coarsen a byWord/byChar morph the model did not happen to carry.
	node['@_option'] = morphOption ?? node['@_option'] ?? 'byObject';
	return { key: 'p159:morph', node };
}

/**
 * The deck's other extensions, with every transition-declaring entry removed.
 *
 * Once the transition is written as a direct child, a leftover extension
 * declaring the same (or a stale) transition would be a second, contradictory
 * declaration on the element.
 */
export function retainNonTransitionExtensions(
	context: ExtensionChildContext,
	isTransitionElement: (localName: string) => boolean,
): XmlObject | undefined {
	if (!context.rawExtLst) {
		return undefined;
	}
	const retained = context.xmlLookupService
		.getChildrenArrayByLocalName(context.rawExtLst, 'ext')
		.filter(
			(ext): ext is XmlObject =>
				Boolean(ext) &&
				!elementKeys(ext).some((key) => isTransitionElement(context.getXmlLocalName(key))),
		);
	if (retained.length === 0) {
		return undefined;
	}
	return { 'p:ext': retained.length === 1 ? retained[0]! : retained };
}
