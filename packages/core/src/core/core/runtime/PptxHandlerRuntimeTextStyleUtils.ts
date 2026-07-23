import { TextSegment, TextStyle } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveImageEffects';

/**
 * ISO 15924 script tags (as used in `<a:font script="...">`) to try, in
 * priority order, for a detected dominant-script category. CJK ideographs are
 * ambiguous between simplified/traditional/Japanese, so several are tried.
 */
const SCRIPT_CANDIDATES: Record<string, readonly string[]> = {
	cjk: ['Hans', 'Hant', 'Jpan', 'Hang'],
	kana: ['Jpan', 'Hans', 'Hant'],
	hangul: ['Hang'],
	arabic: ['Arab'],
	hebrew: ['Hebr'],
	thai: ['Thai'],
};

/**
 * Flatten a per-theme-path script-override map (`themePath -> {script ->
 * typeface}`) into a single `{script -> typeface}` lookup. Earlier entries win
 * on collision, matching the primary-theme-first parse order (#83).
 */
function aggregateFontScriptOverrides(
	perPathMap: Map<string, Record<string, string>>,
): Record<string, string> {
	const aggregate: Record<string, string> = {};
	for (const overrides of perPathMap.values()) {
		for (const [script, typeface] of Object.entries(overrides)) {
			if (!(script in aggregate)) {
				aggregate[script] = typeface;
			}
		}
	}
	return aggregate;
}

/**
 * Detect the dominant non-Latin script category of a run's text so the theme's
 * per-script font override can be consulted (#83). Returns `undefined` when the
 * text is empty or predominantly Latin (no fallback needed).
 */
function detectDominantScript(text: string): string | undefined {
	const counts: Record<string, number> = {};
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		let cat: string | undefined;
		if (code >= 0x1100 && code <= 0x11ff) {
			cat = 'hangul';
		} else if (code >= 0xac00 && code <= 0xd7af) {
			cat = 'hangul';
		} else if (code >= 0x3040 && code <= 0x30ff) {
			cat = 'kana';
		} else if (
			(code >= 0x4e00 && code <= 0x9fff) ||
			(code >= 0x3400 && code <= 0x4dbf) ||
			(code >= 0xf900 && code <= 0xfaff)
		) {
			cat = 'cjk';
		} else if (code >= 0x0600 && code <= 0x06ff) {
			cat = 'arabic';
		} else if (code >= 0x0590 && code <= 0x05ff) {
			cat = 'hebrew';
		} else if (code >= 0x0e00 && code <= 0x0e7f) {
			cat = 'thai';
		}
		if (cat) {
			counts[cat] = (counts[cat] ?? 0) + 1;
		}
	}
	let best: string | undefined;
	let bestCount = 0;
	for (const [cat, count] of Object.entries(counts)) {
		if (count > bestCount) {
			best = cat;
			bestCount = count;
		}
	}
	return best;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Resolve the automatic per-script fallback face for a run's text from the
	 * theme's `<a:font script="...">` overrides (#83). Body (minor) fonts win
	 * over heading (major) fonts. Returns `undefined` when the deck declares no
	 * script overrides or the text needs no fallback.
	 */
	protected resolveScriptFallbackFont(text: string): string | undefined {
		if (!text) {
			return undefined;
		}
		if (
			this.masterThemeMinorFontScripts.size === 0 &&
			this.masterThemeMajorFontScripts.size === 0
		) {
			return undefined;
		}
		const category = detectDominantScript(text);
		if (!category) {
			return undefined;
		}
		const candidates = SCRIPT_CANDIDATES[category];
		if (!candidates) {
			return undefined;
		}
		const minor = aggregateFontScriptOverrides(this.masterThemeMinorFontScripts);
		for (const key of candidates) {
			if (minor[key]) {
				return minor[key];
			}
		}
		const major = aggregateFontScriptOverrides(this.masterThemeMajorFontScripts);
		for (const key of candidates) {
			if (major[key]) {
				return major[key];
			}
		}
		return undefined;
	}

	protected textStylesEqual(left: TextStyle | undefined, right: TextStyle | undefined): boolean {
		const keys: Array<keyof TextStyle> = [
			'fontFamily',
			'fontSize',
			'bold',
			'italic',
			'underline',
			'strikethrough',
			'rtl',
			'hyperlink',
			'color',
			'align',
			'vAlign',
			'textDirection',
			'columnCount',
		];
		return keys.every((key) => left?.[key] === right?.[key]);
	}

	protected hasMixedTextStyles(textSegments: TextSegment[]): boolean {
		if (textSegments.length <= 1) {
			return false;
		}
		const baseStyle = textSegments[0]?.style;
		return textSegments.some(
			(segment, index) => index > 0 && !this.textStylesEqual(segment.style, baseStyle),
		);
	}

	/**
	 * Whether a segment carries run-level content that the flat `el.text` string
	 * cannot represent: an OOXML field (`a:fld`), an inline equation, or a ruby
	 * (phonetic) annotation. Such segments must survive a save: collapsing them
	 * to the plain-text path silently downgrades a field to static text (e.g. a
	 * slide-number field becomes a frozen number) or drops the equation/ruby.
	 */
	protected isStructuralTextSegment(segment: TextSegment): boolean {
		return Boolean(segment.fieldType || segment.equationXml || segment.rubyText);
	}

	protected areTextSegmentsUniform(textSegments: TextSegment[] | undefined): boolean {
		if (!textSegments || textSegments.length === 0) {
			return true;
		}
		// Even a single segment can be a field/equation/ruby that the flat text
		// string cannot round-trip, so it must not be treated as uniform.
		if (textSegments.some((segment) => this.isStructuralTextSegment(segment))) {
			return false;
		}
		if (textSegments.length === 1) {
			return true;
		}
		return !this.hasMixedTextStyles(textSegments);
	}

	protected parseBooleanAttr(value: unknown): boolean {
		const normalized = String(value ?? '')
			.trim()
			.toLowerCase();
		return normalized === '1' || normalized === 'true';
	}

	protected parseOptionalBooleanAttr(value: unknown): boolean | undefined {
		if (value === undefined || value === null) {
			return undefined;
		}
		const normalized = String(value).trim();
		if (normalized.length === 0) {
			return undefined;
		}
		return this.parseBooleanAttr(normalized);
	}

	protected normalizeTypefaceToken(typeface: string): string | undefined {
		const normalized = typeface.trim();
		return normalized.length > 0 ? normalized : undefined;
	}

	protected resolveThemeTypeface(typeface: string | undefined): string | undefined {
		const normalized = this.normalizeTypefaceToken(typeface || '');
		if (!normalized) {
			return undefined;
		}

		if (normalized.startsWith('+')) {
			const token = normalized.slice(1).toLowerCase();
			const resolved = this.themeFontMap[token];
			if (resolved) {
				return resolved;
			}
		}

		return normalized;
	}

	protected cloneTextStyleValue(style: TextStyle | undefined): TextStyle {
		return style ? { ...style } : {};
	}

	protected compactTextSegments(
		textSegments: TextSegment[],
		fallbackStyle: TextStyle | undefined,
	): TextSegment[] {
		const compacted: TextSegment[] = [];
		textSegments.forEach((segment) => {
			const segmentText = String(segment.text || '');
			if (segmentText.length === 0) {
				return;
			}
			const segmentStyle = this.cloneTextStyleValue(segment.style);
			const previous = compacted[compacted.length - 1];
			if (previous && this.textStylesEqual(previous.style, segmentStyle)) {
				previous.text += segmentText;
				return;
			}
			compacted.push({
				text: segmentText,
				style: segmentStyle,
			});
		});

		if (compacted.length === 0) {
			return [
				{
					text: '',
					style: this.cloneTextStyleValue(fallbackStyle),
				},
			];
		}
		return compacted;
	}
}
