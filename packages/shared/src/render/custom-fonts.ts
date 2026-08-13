/**
 * custom-fonts.ts: registering a user-supplied font file with the document.
 *
 * Backs the opt-in "Custom fonts" pane under File > Options. The viewer cannot
 * render a family the browser has never heard of, so a deck authored with a
 * corporate face falls back to a substitute; letting the user hand the font
 * file over fixes that for the session.
 *
 * Nothing here is persisted: the registration lives in the page's font set and
 * disappears on reload. That is deliberate, because keeping a licensed font
 * binary in local storage is not ours to decide.
 *
 * @module render/custom-fonts
 */

/** Recognised font file extensions, in the order the file input advertises. */
export const CUSTOM_FONT_EXTENSIONS: readonly string[] = ['.ttf', '.otf', '.woff', '.woff2'];

/** `accept` attribute for a font file input. */
export const CUSTOM_FONT_ACCEPT = [
	...CUSTOM_FONT_EXTENSIONS,
	'font/ttf',
	'font/otf',
	'font/woff',
	'font/woff2',
].join(',');

/** Style axes recovered from a font file's name. */
export interface CustomFontDescriptor {
	/** Family name, with the style suffix and separators stripped. */
	family: string;
	/** CSS `font-weight` for the face. */
	weight: string;
	/** CSS `font-style` for the face. */
	style: string;
}

/** Suffixes that name a weight rather than part of the family. */
const WEIGHT_SUFFIXES: ReadonlyArray<[RegExp, string]> = [
	[/thin|hairline/iu, '100'],
	[/extralight|ultralight/iu, '200'],
	[/light/iu, '300'],
	[/medium/iu, '500'],
	[/semibold|demibold/iu, '600'],
	[/extrabold|ultrabold/iu, '800'],
	[/black|heavy/iu, '900'],
	[/bold/iu, '700'],
];

/** Style tokens stripped from the family name once interpreted. */
const STYLE_TOKEN =
	/[-_\s]*(?:thin|hairline|extralight|ultralight|light|regular|normal|book|medium|semibold|demibold|extrabold|ultrabold|black|heavy|bold|italic|oblique)+$/giu;

/**
 * Derive a family name, weight and style from a font file's name.
 *
 * Foundries encode the face in the filename (`Inter-SemiBoldItalic.woff2`),
 * and registering every file under its full filename would give the user a
 * dropdown of near-duplicate families that never combine with the bold and
 * italic buttons. Splitting the axes out means the four files of a family all
 * register as one selectable name.
 *
 * @param fileName - The uploaded file's name, extension included.
 * @returns The descriptor; `family` is empty when the name carried nothing but
 *   style tokens, which callers should treat as unusable.
 *
 * @example
 * ```ts
 * deriveCustomFontDescriptor("Inter-SemiBoldItalic.woff2");
 * // => { family: "Inter", weight: "600", style: "italic" }
 * ```
 */
export function deriveCustomFontDescriptor(fileName: string): CustomFontDescriptor {
	const stem = fileName.replace(/\.[^.]+$/u, '');
	// Foundries run the axes together ("Inter-SemiBoldItalic"), so this cannot
	// require a separator before the token. The trailing guard keeps a family
	// whose name merely starts with these letters from reading as a style.
	const italic = /(?:italic|oblique)(?![a-z])/iu.test(stem);

	let weight = '400';
	for (const [pattern, value] of WEIGHT_SUFFIXES) {
		if (pattern.test(stem)) {
			weight = value;
			break;
		}
	}

	// Strip repeatedly: "Inter-SemiBold-Italic" sheds one token per pass.
	let family = stem;
	let previous: string;
	do {
		previous = family;
		family = family.replace(STYLE_TOKEN, '');
	} while (family !== previous);

	family = family.replace(/[-_]+/gu, ' ').replace(/\s+/gu, ' ').trim();

	return { family, weight, style: italic ? 'italic' : 'normal' };
}

/** Outcome of a registration attempt. */
export interface CustomFontRegistration {
	family: string;
	descriptor: CustomFontDescriptor;
}

/**
 * Load a font file and add it to the document's font set.
 *
 * @param file - The user-selected font file.
 * @param target - Font set to add to; defaults to the ambient `document`.
 *   Injectable so tests and non-browser hosts can supply their own.
 * @returns The registered family, or `null` when the environment has no
 *   `FontFace` support or the filename yields no usable family.
 * @throws Whatever `FontFace.load` rejects with when the file is not a font,
 *   so callers can surface a message instead of silently doing nothing.
 */
export async function registerCustomFont(
	file: File,
	target?: FontFaceSet,
): Promise<CustomFontRegistration | null> {
	const fontSet = target ?? (typeof document === 'undefined' ? undefined : document.fonts);
	if (!fontSet || typeof FontFace === 'undefined') {
		return null;
	}

	const descriptor = deriveCustomFontDescriptor(file.name);
	if (!descriptor.family) {
		return null;
	}

	const face = new FontFace(descriptor.family, await file.arrayBuffer(), {
		weight: descriptor.weight,
		style: descriptor.style,
	});
	await face.load();
	fontSet.add(face);

	return { family: descriptor.family, descriptor };
}
