/**
 * Build the `mc:AlternateContent` envelope PowerPoint requires around a
 * transition that carries extension-namespace markup.
 *
 * MEASURED, not inferred. A p14/p15 transition written as a `p:extLst`
 * extension (`<p:ext uri="{CE6CE671..}"><p14:ferris/>`) reopens in PowerPoint
 * with `SlideShowTransition.EntryEffect = 0`: no transition at all. Writing the
 * extension element as a plain direct child instead is worse for p14 - the file
 * fails to open ("corrupted and unreadable") - even with an `mc:Ignorable`
 * declaration, though p15 survives that way. The only form PowerPoint accepts
 * for both is the one it writes itself:
 *
 * ```xml
 * <mc:AlternateContent xmlns:mc="...">
 *   <mc:Choice xmlns:p14="..." Requires="p14">
 *     <p:transition spd="slow" p14:dur="800" advTm="3000"><p14:flythrough/></p:transition>
 *   </mc:Choice>
 *   <mc:Fallback>
 *     <p:transition spd="slow" advTm="3000"><p:fade/></p:transition>
 *   </mc:Fallback>
 * </mc:AlternateContent>
 * ```
 *
 * The `mc:Fallback` shape above is taken verbatim from PowerPoint's own output
 * across `issue-132-gradient-fill.pptx`: every extended transition in that deck
 * falls back to `<p:fade/>` carrying the same base attributes minus the
 * extension-namespace duration. Fade is the right choice - it is the only
 * effect guaranteed to exist in every reader and it degrades an unavailable
 * cinematic effect to a neutral one rather than to a hard cut.
 *
 * @module core/runtime/slide-transition-envelope-build
 */
import type { XmlObject } from '../../types';

/** Markup Compatibility namespace. */
export const MCE_NAMESPACE_URI = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

/** Extension namespaces a `p:transition` can carry markup from. */
export const EXTENSION_NAMESPACE_URIS: Readonly<Record<string, string>> = {
	p14: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
	p15: 'http://schemas.microsoft.com/office/powerpoint/2012/main',
	p159: 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
};

/** The prefix of a namespaced key, or `undefined` when it has none. */
function prefixOf(key: string): string | undefined {
	const bare = key.startsWith('@_') ? key.slice(2) : key;
	const index = bare.indexOf(':');
	if (index < 0) {
		return undefined;
	}
	const prefix = bare.slice(0, index);
	return prefix in EXTENSION_NAMESPACE_URIS ? prefix : undefined;
}

/** Extension prefixes a rebuilt transition uses, split by element vs attribute. */
export interface ExtensionUsage {
	/** Prefixes used by ELEMENT children: these decide the `Requires` value. */
	elements: string[];
	/** Every extension prefix used, elements and attributes alike. */
	all: string[];
}

/**
 * Which extension namespaces a rebuilt transition node actually uses.
 *
 * Only an element child forces the envelope. An extension ATTRIBUTE on its own
 * (`p14:dur`) is legal on a plain `p:transition` through `mc:Ignorable`, which
 * PowerPoint honours, so it does not need the heavier wrapper.
 */
export function extensionUsageOf(transitionNode: XmlObject): ExtensionUsage {
	const elements = new Set<string>();
	const all = new Set<string>();
	for (const key of Object.keys(transitionNode)) {
		const prefix = prefixOf(key);
		if (!prefix) {
			continue;
		}
		all.add(prefix);
		if (!key.startsWith('@_')) {
			elements.add(prefix);
		}
	}
	return { elements: [...elements], all: [...all] };
}

/**
 * The `Requires` value for a Choice branch.
 *
 * PowerPoint names the namespace of the transition ELEMENT, not of the
 * duration attribute: an Origami transition is `Requires="p15"` even though the
 * same element carries `p14:dur`.
 */
export function requiresPrefixFor(usage: ExtensionUsage): string | undefined {
	// p159 (morph) outranks p15, which outranks p14, matching the order in which
	// PowerPoint introduced them; only one element prefix is ever present in
	// practice, so the ordering is a tie-break rather than a policy.
	for (const prefix of ['p159', 'p15', 'p14']) {
		if (usage.elements.includes(prefix)) {
			return prefix;
		}
	}
	return undefined;
}

/**
 * The legacy-reader branch: the same transition reduced to base markup.
 *
 * Extension elements and the extension duration are dropped (an older reader
 * would not understand either) and a `p:fade` child is supplied so the slide
 * still transitions rather than cutting.
 */
export function buildFallbackTransition(transitionNode: XmlObject): XmlObject {
	const fallback: XmlObject = {};
	for (const [key, value] of Object.entries(transitionNode)) {
		if (prefixOf(key)) {
			continue;
		}
		fallback[key] = value;
	}
	const hasChild = Object.keys(fallback).some((key) => !key.startsWith('@_'));
	if (!hasChild) {
		fallback['p:fade'] = {};
	}
	return fallback;
}

/** Wrap a transition in a fresh `mc:AlternateContent` Choice/Fallback pair. */
export function buildTransitionEnvelope(
	transitionNode: XmlObject,
	usage: ExtensionUsage,
	requiresPrefix: string,
): XmlObject {
	const choice: XmlObject = {};
	for (const prefix of usage.all) {
		choice[`@_xmlns:${prefix}`] = EXTENSION_NAMESPACE_URIS[prefix]!;
	}
	choice['@_Requires'] = requiresPrefix;
	choice['p:transition'] = transitionNode;

	return {
		'@_xmlns:mc': MCE_NAMESPACE_URI,
		'mc:Choice': choice,
		'mc:Fallback': { 'p:transition': buildFallbackTransition(transitionNode) },
	};
}

/**
 * Bring an EXISTING Choice branch up to date with the markup being written
 * into it, so an edit from one extension family to another (Reveal to Origami)
 * does not leave a `Requires` naming a namespace the branch no longer uses.
 */
export function refreshChoiceRequirements(
	branch: XmlObject,
	usage: ExtensionUsage,
	requiresPrefix: string,
	getLocalName: (key: string) => string,
): void {
	for (const prefix of usage.all) {
		branch[`@_xmlns:${prefix}`] ??= EXTENSION_NAMESPACE_URIS[prefix]!;
	}
	const requiresKey =
		Object.keys(branch).find(
			(key) => key.startsWith('@_') && getLocalName(key.slice(2)) === 'Requires',
		) ?? '@_Requires';
	branch[requiresKey] = requiresPrefix;
}
