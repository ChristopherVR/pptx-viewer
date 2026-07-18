import type { ViewerProofingOptions } from './viewer-options';

/**
 * AutoCorrect-as-you-type engine behind Options > Proofing, mirroring
 * PowerPoint's replacements: initial-capitals fixes, sentence and day-name
 * capitalization, smart quotes, double-hyphen to dash, fraction glyphs, and
 * superscript-style ordinals. Bindings run `applyAutoCorrect` over committed
 * text (word boundaries, blur, or Enter), never on every keystroke.
 */

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const FRACTIONS: ReadonlyArray<readonly [string, string]> = [
	['1/2', '½'],
	['1/4', '¼'],
	['3/4', '¾'],
];

const ORDINAL_SUFFIXES: Record<string, string> = {
	st: 'ˢᵗ',
	nd: 'ⁿᵈ',
	rd: 'ʳᵈ',
	th: 'ᵗʰ',
};

function fixTwoInitialCapitals(word: string): string {
	if (/^[A-Z]{2}[a-z]/.test(word) && !/^[A-Z]{3,}$/.test(word)) {
		const second = word.charAt(1).toLowerCase();
		return `${word.charAt(0)}${second}${word.slice(2)}`;
	}
	return word;
}

function capitalizeDayName(word: string): string {
	const bare = word.toLowerCase();
	if (DAY_NAMES.includes(bare) && word === bare) {
		return `${bare.charAt(0).toUpperCase()}${bare.slice(1)}`;
	}
	return word;
}

function replaceFractions(word: string): string {
	for (const [plain, glyph] of FRACTIONS) {
		if (word === plain) {
			return glyph;
		}
	}
	return word;
}

function replaceOrdinal(word: string): string {
	const match = /^(\d+)(st|nd|rd|th)$/i.exec(word);
	if (!match || match[1] === undefined || match[2] === undefined) {
		return word;
	}
	const superscript = ORDINAL_SUFFIXES[match[2].toLowerCase()];
	return superscript ? `${match[1]}${superscript}` : word;
}

function transformWord(word: string, proofing: ViewerProofingOptions): string {
	let result = word;
	if (proofing.autoCorrectTwoInitialCapitals) {
		result = fixTwoInitialCapitals(result);
	}
	if (proofing.autoCorrectCapitalizeDayNames) {
		result = capitalizeDayName(result);
	}
	if (proofing.autoCorrectFractions) {
		result = replaceFractions(result);
	}
	if (proofing.autoCorrectOrdinals) {
		result = replaceOrdinal(result);
	}
	return result;
}

function applySmartQuotes(text: string): string {
	let result = '';
	for (let i = 0; i < text.length; i += 1) {
		const char = text.charAt(i);
		if (char !== '"' && char !== "'") {
			result += char;
			continue;
		}
		const previous = i === 0 ? '' : text.charAt(i - 1);
		const opening = previous === '' || /[\s([{‘“-]/.test(previous);
		if (char === '"') {
			result += opening ? '“' : '”';
		} else {
			result += opening ? '‘' : '’';
		}
	}
	return result;
}

function applyHyphensToDash(text: string): string {
	return text.replace(/(\S)--(?=\S)/g, '$1—').replace(/ -- /g, ' – ');
}

function capitalizeSentences(text: string): string {
	return text.replace(
		/(^|[.!?]\s+)([a-z])/g,
		(_match, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`,
	);
}

/** Apply every enabled AutoCorrect rule to a committed run of text. */
export function applyAutoCorrect(text: string, proofing: ViewerProofingOptions): string {
	if (text.length === 0) {
		return text;
	}
	let result = text;
	if (proofing.autoCorrectSmartQuotes) {
		result = applySmartQuotes(result);
	}
	if (proofing.autoCorrectHyphensToDash) {
		result = applyHyphensToDash(result);
	}
	const needsWordPass =
		proofing.autoCorrectTwoInitialCapitals ||
		proofing.autoCorrectCapitalizeDayNames ||
		proofing.autoCorrectFractions ||
		proofing.autoCorrectOrdinals;
	if (needsWordPass) {
		result = result
			.split(/(\s+)/)
			.map((part) => (/^\s+$/.test(part) ? part : transformWord(part, proofing)))
			.join('');
	}
	if (proofing.autoCorrectCapitalizeFirstLetter) {
		result = capitalizeSentences(result);
	}
	return result;
}
