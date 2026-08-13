/**
 * Where the transition duration goes, and what has to be declared for it.
 *
 * `CT_SlideTransition` (S19.3.1.50) declares only `spd`, `advClick` and
 * `advTm`: the millisecond duration is `p14:dur`, from the Office 2010
 * extension namespace. PowerPoint does not merely tolerate the bare spelling,
 * it IGNORES it - measured through COM, a deck saved with `dur="2000"` reopens
 * at the 0.5s default, so the authored duration is silently lost. Written as
 * `p14:dur` with an `mc:Ignorable` declaration on the slide root, the same deck
 * reopens at 2s.
 *
 * @module core/runtime/slide-transition-duration-ns
 */
import type { XmlObject } from '../../types';

/** Office 2010 PresentationML extension namespace, home of `p14:dur`. */
const P14_NAMESPACE_URI = 'http://schemas.microsoft.com/office/powerpoint/2010/main';

/** Markup Compatibility namespace, needed for the `mc:Ignorable` declaration. */
const MC_NAMESPACE_URI = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

/** Default spelling for the transition duration when the source had none. */
const DEFAULT_DURATION_KEY = '@_p14:dur';

/**
 * Re-key the rebuilt transition's `@dur` to the extension-namespace spelling.
 *
 * `CT_SlideTransition` (S19.3.1.50) declares only `spd`, `advClick` and
 * `advTm`: the millisecond duration is `p14:dur`, which is exactly why
 * PowerPoint wraps such a transition in an `mc:Choice Requires="p14"`. The
 * typed model flattens both spellings into `durationMs`, so emitting the
 * rebuilt node verbatim smuggles an undeclared attribute onto the element -
 * and PowerPoint does not merely tolerate it, it IGNORES it: a deck saved with
 * `dur="2000"` reopens at the 0.5s default, measured through COM. The rename
 * is positional so the attribute keeps its original slot.
 */
export function preserveNamespacedDuration(
	source: XmlObject | undefined,
	rebuilt: XmlObject,
): XmlObject {
	if (rebuilt['@_dur'] === undefined) {
		return rebuilt;
	}
	const namespaced =
		(source &&
			Object.keys(source).find(
				(key) => key.startsWith('@_') && key !== '@_dur' && key.endsWith(':dur'),
			)) ||
		DEFAULT_DURATION_KEY;
	if (rebuilt[namespaced] !== undefined) {
		return rebuilt;
	}
	const result: XmlObject = {};
	for (const [key, value] of Object.entries(rebuilt)) {
		result[key === '@_dur' ? namespaced : key] = value;
	}
	return result;
}

/**
 * Declare the `p14` prefix on the slide root and mark it ignorable.
 *
 * An extension-namespace attribute is only legal on a strict element through
 * Markup Compatibility: `mc:Ignorable` tells a consumer that does not know the
 * namespace to skip the attribute rather than reject the part. PowerPoint
 * honours `p14:dur` written this way on a plain (un-enveloped) `p:transition`,
 * which is what lets the duration survive without fabricating an
 * `mc:AlternateContent` around every transition the editor touches.
 */
function declareIgnorableDurationNamespace(
	slideNode: XmlObject,
	getLocalName: (key: string) => string,
): void {
	slideNode['@_xmlns:p14'] ??= P14_NAMESPACE_URI;
	const mcPrefix = Object.keys(slideNode)
		.filter((key) => key.startsWith('@_xmlns:') && slideNode[key] === MC_NAMESPACE_URI)
		.map((key) => key.slice('@_xmlns:'.length))[0];
	if (!mcPrefix) {
		slideNode['@_xmlns:mc'] ??= MC_NAMESPACE_URI;
	}
	const ignorableKey =
		Object.keys(slideNode).find(
			(key) => key.startsWith('@_') && getLocalName(key.slice(2)) === 'Ignorable',
		) ?? `@_${mcPrefix ?? 'mc'}:Ignorable`;
	const declared = String(slideNode[ignorableKey] ?? '')
		.split(/\s+/)
		.filter((token) => token.length > 0);
	if (!declared.includes('p14')) {
		declared.push('p14');
	}
	slideNode[ignorableKey] = declared.join(' ');
}

/** Declare the duration namespace when the rebuilt node actually carries it. */
export function declareDurationNamespaceIfUsed(
	slideNode: XmlObject,
	sourceNode: XmlObject | undefined,
	rebuilt: XmlObject,
	getLocalName: (key: string) => string,
): void {
	if (rebuilt[DEFAULT_DURATION_KEY] === undefined) {
		return;
	}
	if (sourceNode?.[DEFAULT_DURATION_KEY] !== undefined) {
		// The file already wrote `p14:dur` here, so it already declares p14.
		return;
	}
	declareIgnorableDurationNamespace(slideNode, getLocalName);
}
