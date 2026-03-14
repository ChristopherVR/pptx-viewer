import type { TextSegment } from '../core';

/** Extracted bullet information type, guaranteed non-null. */
export type SegmentBulletInfo = NonNullable<TextSegment['bulletInfo']>;

/** Resolves the nesting level for a bulleted/numbered list item. */
export function resolveListLevel(
	bulletInfo: SegmentBulletInfo,
	paragraphIndex: number,
	paragraphIndents:
		| Array<{ marginLeft?: number; indent?: number }>
		| undefined
): number {
	const explicitLevel = readNumericProp(bulletInfo, 'level');
	if (typeof explicitLevel === 'number') {
		return Math.max(0, Math.floor(explicitLevel));
	}

	const indentInfo = paragraphIndents?.[paragraphIndex];
	const marginLeft = indentInfo?.marginLeft ?? 0;
	const indent = indentInfo?.indent ?? 0;
	const spacingPoints = Math.max(0, marginLeft + Math.max(indent, 0));
	if (spacingPoints <= 0) return 0;

	return Math.max(0, Math.round(spacingPoints / 24));
}

/** Resolves the marker string (e.g. `-`, `1.`, `a)`) for a list item. */
export function resolveListMarker(
	bulletInfo: SegmentBulletInfo,
	paragraphIndex: number
): string {
	if (bulletInfo.autoNumType) {
		const startAt = bulletInfo.autoNumStartAt ?? 1;
		const offset = bulletInfo.paragraphIndex ?? paragraphIndex;
		const value = Math.max(1, startAt + offset);
		return formatAutoNumber(value, bulletInfo.autoNumType);
	}

	// Picture bullets: use a standard bullet character in Markdown output
	// since images cannot be rendered inline as list markers.
	if (bulletInfo.imageRelId || bulletInfo.imageDataUrl) {
		return '-';
	}

	if (bulletInfo.char) {
		const marker = bulletInfo.char.trim();
		if (/^[-*+>]$/.test(marker)) {
			return marker;
		}
	}

	return '-';
}

function formatAutoNumber(value: number, autoNumType: string): string {
	const normalized = autoNumType.toLowerCase();
	let token = String(value);
	if (normalized.includes('roman')) {
		token = toRoman(value);
		if (normalized.includes('lc')) token = token.toLowerCase();
	}
	if (normalized.includes('alpha')) {
		token = toAlphabetic(value);
		if (normalized.includes('uc')) token = token.toUpperCase();
		if (normalized.includes('lc')) token = token.toLowerCase();
	}
	if (normalized.includes('parenboth')) {
		return `(${token})`;
	}
	if (normalized.includes('parenr')) {
		return `${token})`;
	}
	if (normalized.includes('minus')) {
		return `${token}-`;
	}
	return `${token}.`;
}

function toAlphabetic(value: number): string {
	let remaining = Math.max(1, value);
	let result = '';
	while (remaining > 0) {
		remaining -= 1;
		result = String.fromCharCode(97 + (remaining % 26)) + result;
		remaining = Math.floor(remaining / 26);
	}
	return result;
}

function toRoman(value: number): string {
	const numerals: Array<[number, string]> = [
		[1000, 'M'],
		[900, 'CM'],
		[500, 'D'],
		[400, 'CD'],
		[100, 'C'],
		[90, 'XC'],
		[50, 'L'],
		[40, 'XL'],
		[10, 'X'],
		[9, 'IX'],
		[5, 'V'],
		[4, 'IV'],
		[1, 'I'],
	];
	let remaining = Math.max(1, value);
	let result = '';
	for (const [numeric, literal] of numerals) {
		while (remaining >= numeric) {
			result += literal;
			remaining -= numeric;
		}
	}
	return result;
}

function readNumericProp(
	source: unknown,
	key: string
): number | undefined {
	if (!source || typeof source !== 'object') return undefined;
	const value = (source as Record<string, unknown>)[key];
	if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
	return value;
}

/** Common monospace font family patterns used for code detection. */
const MONOSPACE_PATTERNS: ReadonlyArray<string> = [
	'mono', 'courier', 'consolas', 'code', 'menlo', 'fira',
	'hack', 'inconsolata', 'jetbrains', 'source code', 'cascadia',
	'sf mono', 'roboto mono', 'iosevka', 'dejavu sans mono',
	'droid sans mono', 'ubuntu mono', 'liberation mono', 'noto mono',
	'ibm plex mono', 'lucida console', 'fixedsys',
];

/** Returns true if the segment's font family looks like a code/monospace font. */
export function isCodeLikeFont(segment: TextSegment): boolean {
	if (segment.style.hyperlink) return false;
	const family = segment.style.fontFamily?.toLowerCase() ?? '';
	return MONOSPACE_PATTERNS.some((pattern) => family.includes(pattern));
}
