/**
 * `a:ruby` (phonetic guide) parsing into a {@link TextSegment}.
 *
 * A ruby run carries THREE run-property sets: the containing `a:r`'s
 * `a:rPr` (outer), the `a:rt` run's (the annotation) and the `a:rubyBase`
 * run's (the base text). The segment's flat `style` merges outer over base
 * for rendering, but each set is also recorded on its own, split into its
 * authored half and the paragraph's inherited baseline exactly like an
 * ordinary run (see `authored-run-style.ts`), so the writer can give each
 * `a:rPr` back only what it authored. Without the split every one of the
 * three was re-emitted with the whole resolved cascade (`a:solidFill`,
 * `a:latin`, `a:rtl`, a fabricated `dirty`), and the base run inherited the
 * outer run's `lang`.
 *
 * @module ruby-element-parsing
 */

import type { TextSegment, TextStyle, XmlObject } from '../../types';
import { xmlText } from '../../utils';

/** Extracts a run's own style from its `a:rPr` (the runtime's `extractTextRunStyle`). */
export type RubyRunStyleExtractor = (runProps: XmlObject | undefined) => TextStyle;

function asRuns(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]).filter(
		(run): run is XmlObject => typeof run === 'object' && run !== null,
	);
}

function withSplit(authored: TextStyle, inherited: TextStyle): TextStyle {
	return { ...inherited, ...authored, authoredRunStyle: authored, inheritedRunStyle: inherited };
}

/** Joined text plus the FIRST run's own authored style. */
function readRuns(
	container: XmlObject | undefined,
	extract: RubyRunStyleExtractor,
): { text: string; authored: TextStyle | undefined } {
	const runs = asRuns(container?.['a:r']);
	const text = runs
		.map((run) => (run['a:t'] !== undefined ? (xmlText(run['a:t']) ?? '') : ''))
		.join('');
	const first = runs[0];
	return {
		text,
		authored: first ? extract(first['a:rPr'] as XmlObject | undefined) : undefined,
	};
}

/**
 * Parse an `a:ruby` element into a ruby {@link TextSegment}, or `undefined`
 * when it carries neither base nor annotation text.
 *
 * @param inherited - The paragraph's merged default run style (the baseline).
 */
export function parseRubyElement(
	rubyNode: XmlObject,
	outerRunProps: XmlObject | undefined,
	inherited: TextStyle,
	extract: RubyRunStyleExtractor,
): TextSegment | undefined {
	const rubyPr = rubyNode['a:rubyPr'] as XmlObject | undefined;
	const rubyAlignment =
		String(
			rubyPr?.['@_algn'] ?? (rubyPr?.['a:rubyAlign'] as XmlObject | undefined)?.['@_val'] ?? 'ctr',
		).trim() || 'ctr';

	const rt = readRuns(rubyNode['a:rt'] as XmlObject | undefined, extract);
	const base = readRuns(rubyNode['a:rubyBase'] as XmlObject | undefined, extract);
	if (!base.text && !rt.text) {
		return undefined;
	}
	const outerAuthored = outerRunProps ? extract(outerRunProps) : undefined;

	const rubyStyle = rt.authored ? withSplit(rt.authored, inherited) : undefined;
	let rubyFontSize = rubyStyle?.fontSize || undefined;
	// `hps` fallback, only when the annotation run itself set no size.
	if (rubyFontSize === undefined && rubyPr?.['@_hps'] !== undefined) {
		const hps = Number.parseInt(String(rubyPr['@_hps']), 10);
		if (Number.isFinite(hps)) {
			rubyFontSize = hps / 2;
		}
	}

	const segment: TextSegment = {
		text: base.text,
		style: withSplit({ ...base.authored, ...outerAuthored }, inherited),
		rubyText: rt.text,
		rubyAlignment,
		rubyFontSize,
		rubyStyle,
		rubyRunAuthoredStyles: { outer: outerAuthored, base: base.authored },
	};
	if (rubyPr && typeof rubyPr === 'object') {
		segment.rubyPropertiesXml = { ...rubyPr };
	}
	return segment;
}
