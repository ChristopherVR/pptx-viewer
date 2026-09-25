/**
 * `a:r > a:ruby` serialisation, the inverse of `ruby-element-parsing.ts`.
 *
 * A parsed ruby segment carries one flat `style` (outer over base, for
 * rendering) plus what the outer `a:rPr` and the `a:rubyBase` run's `a:rPr`
 * each authored on their own (`rubyRunAuthoredStyles`). Each of the two is
 * written from a projection of the flat style onto its OWN authored half:
 * a key keeps the sub-run's own value unless the flat style no longer
 * matches what it loaded with, which is how a later edit is recognised
 * (the same "authored, or differs from the load-time value" rule as
 * `authored-run-style.ts`). The `a:rt` run is written from `rubyStyle`,
 * which carries its own split, and `a:rubyPr` is re-emitted verbatim.
 *
 * @module ruby-run-writing
 */

import type { TextSegment, TextStyle, XmlObject } from '../../types';

/** Builds one run's `a:rPr` (the runtime's `createRunPropertiesFromTextStyle`). */
export type RubyRunPropsBuilder = (style: TextStyle) => XmlObject | undefined;

const SPLIT_KEYS: ReadonlySet<string> = new Set(['authoredRunStyle', 'inheritedRunStyle']);

/**
 * Project a ruby segment's flat style onto one of its sub-runs. Without a
 * recorded split (SDK-built ruby) the flat style is returned unchanged.
 */
export function projectRubySubRunStyle(
	style: TextStyle,
	ownAuthored: TextStyle | undefined,
): TextStyle {
	const inherited = style.inheritedRunStyle;
	if (!inherited) {
		return style;
	}
	const loaded = style.authoredRunStyle;
	const own = ownAuthored ?? {};
	const projected: Record<string, unknown> = { ...inherited, ...own };
	for (const [key, value] of Object.entries(style)) {
		if (SPLIT_KEYS.has(key)) {
			continue;
		}
		const styleKey = key as keyof TextStyle;
		const loadedValue = loaded?.[styleKey] ?? inherited[styleKey];
		if (value !== loadedValue) {
			projected[key] = value;
		}
	}
	projected['authoredRunStyle'] = own;
	projected['inheritedRunStyle'] = inherited;
	return projected as TextStyle;
}

/** Build `a:rubyPr`, keeping the parsed node's attributes verbatim. */
function buildRubyPr(segment: TextSegment): XmlObject {
	const source = segment.rubyPropertiesXml;
	if (source) {
		const rubyPr: XmlObject = { ...source };
		const loadedAlign = String(
			source['@_algn'] ?? (source['a:rubyAlign'] as XmlObject | undefined)?.['@_val'] ?? 'ctr',
		).trim();
		if (segment.rubyAlignment && segment.rubyAlignment !== loadedAlign) {
			rubyPr['@_algn'] = segment.rubyAlignment;
		}
		return rubyPr;
	}
	const rubyPr: XmlObject = {};
	if (segment.rubyAlignment) {
		rubyPr['@_algn'] = segment.rubyAlignment;
	}
	if (segment.rubyFontSize !== undefined) {
		// Store as half-point size (hps)
		rubyPr['@_hps'] = String(Math.round(segment.rubyFontSize * 2));
	}
	return rubyPr;
}

function textRun(runProps: XmlObject | undefined, text: string): XmlObject {
	const run: XmlObject = {};
	if (runProps) {
		run['a:rPr'] = runProps;
	}
	run['a:t'] = text;
	return run;
}

/**
 * Build the `a:r` carrying `a:ruby` (`a:rubyPr`, `a:rt`, `a:rubyBase`) for a
 * ruby segment whose base text is `segment.text`.
 */
export function buildRubyRunXml(
	segment: TextSegment,
	style: TextStyle,
	buildRunProps: RubyRunPropsBuilder,
): XmlObject {
	const authored = segment.rubyRunAuthoredStyles;
	const outerStyle = authored ? projectRubySubRunStyle(style, authored.outer) : style;
	const baseStyle = authored ? projectRubySubRunStyle(style, authored.base) : style;
	const rubyRun: XmlObject = {};
	const outerRPr = buildRunProps(outerStyle);
	if (outerRPr) {
		rubyRun['a:rPr'] = outerRPr;
	}
	rubyRun['a:ruby'] = {
		'a:rubyPr': buildRubyPr(segment),
		'a:rt': { 'a:r': textRun(buildRunProps(segment.rubyStyle ?? style), segment.rubyText ?? '') },
		'a:rubyBase': { 'a:r': textRun(buildRunProps(baseStyle), segment.text) },
	};
	return rubyRun;
}
