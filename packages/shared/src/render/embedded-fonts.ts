/**
 * embedded-fonts.ts: Pure (no DOM-injection) helpers for the embedded-font
 * subsystem, shared across the React, Vue, and Angular bindings.
 *
 * All DOM side effects (injecting the managed `<style>` element, minting /
 * revoking object URLs) stay in each binding; everything here is pure. The
 * managed `<style>` element id is binding-specific and stays in each binding.
 *
 * The core load pipeline (`PptxHandlerRuntimeEmbeddedFonts`) already
 * de-obfuscates the OOXML XOR layer and produces a ready-to-use `dataUrl` for
 * each style variant, so one {@link PptxEmbeddedFont} corresponds to a single
 * style variant (regular / bold / italic / boldItalic), distinguished by its
 * `bold` and `italic` flags. As a defence-in-depth fallback, an entry without a
 * usable `dataUrl` but carrying obfuscated `originalPartBytes` + `fontGuid`
 * (or clear-text `rawFontData`) is de-obfuscated here and minted into a `Blob`
 * object URL by the binding.
 */

import type { PptxEmbeddedFont } from 'pptx-viewer-core';
import { deobfuscateFont, detectFontFormat, getSubstituteFontFamily } from 'pptx-viewer-core';

/**
 * Characters that would let a PPTX-supplied font name escape the `@font-face`
 * block and inject arbitrary CSS. Names containing any of these are rejected.
 */
const FONT_NAME_UNSAFE_CHARS = /["\\\n\r;}<>]/u;

/** CSS `format()` hints we are willing to emit. */
const FONT_FORMAT_ALLOWED = new Set<string>(['truetype', 'opentype', 'woff', 'woff2']);

/** Whitelist of `data:`/`blob:` URLs safe to interpolate into `url("…")`. */
const FONT_DATA_URL_PATTERN =
	/^data:font\/[a-z0-9+.-]+(?:;charset=[a-z0-9-]+)?;base64,[a-z0-9+/=]+$/iu;

/** MIME type to stamp on a minted `Blob`, keyed by resolved CSS font format. */
const FONT_MIME_BY_FORMAT: Record<string, string> = {
	truetype: 'font/ttf',
	opentype: 'font/otf',
	woff: 'font/woff',
	woff2: 'font/woff2',
};

/** Default CSS `format()` hint when the entry's format is missing/unsupported. */
const DEFAULT_FONT_FORMAT = 'truetype';

/** Default MIME type when no format-specific mapping applies. */
const DEFAULT_FONT_MIME = 'font/ttf';

/**
 * True when `url` is safe to interpolate into `src: url("…")`.
 *
 * Accepts `blob:` URLs (minted by the binding from de-obfuscated bytes) and
 * base64 `data:font/…` URLs produced by the core loader; everything else is
 * rejected to prevent CSS-injection / exfiltration via a hostile PPTX.
 */
export function isInjectableUrl(url: string): boolean {
	if (typeof url !== 'string' || url.length === 0) {
		return false;
	}
	if (url.startsWith('blob:')) {
		return true;
	}
	return FONT_DATA_URL_PATTERN.test(url);
}

/** Map a resolved CSS font format to the MIME type for a minted `Blob`. */
export function fontMimeForFormat(format: string): string {
	return FONT_MIME_BY_FORMAT[format] ?? DEFAULT_FONT_MIME;
}

/**
 * Normalise an entry's declared format to one of the allowed `format()` hints,
 * falling back to `truetype`.
 */
export function normalizeFontFormat(format: string | undefined): string {
	return typeof format === 'string' && FONT_FORMAT_ALLOWED.has(format)
		? format
		: DEFAULT_FONT_FORMAT;
}

/** A single resolved variant ready to be emitted as a `@font-face` rule. */
export interface ResolvedFontVariant {
	name: string;
	url: string;
	format: string;
	weight: string;
	style: string;
	/** Object URL minted for this variant (must be revoked on cleanup). */
	objectUrl?: string;
}

/**
 * A font supplied by the host application. The package never ships fonts:
 * applications provide a licensed URL, data URL, or blob URL for their users.
 */
export interface ViewerFontSource {
	family: string;
	src: string;
	format?: 'truetype' | 'opentype' | 'woff' | 'woff2';
	weight?: string | number;
	style?: 'normal' | 'italic';
}

/**
 * Factory the (impure) object-URL minting is delegated to, so the resolution
 * logic stays pure and testable. The binding supplies a real implementation
 * backed by `Blob` + `URL.createObjectURL`; tests can stub it. Returning
 * `null` signals object URLs are unsupported in the current runtime.
 */
export type ObjectUrlFactory = (bytes: Uint8Array, mime: string) => string | null;

/**
 * Resolve a single embedded-font entry to an injectable variant.
 *
 * Prefers the de-obfuscated `dataUrl` produced by the core loader. Falls back
 * to de-obfuscating `originalPartBytes` with `fontGuid` (or using clear-text
 * `rawFontData` directly) and minting an object URL via `mintObjectUrl` when no
 * usable data URL is present. Returns `null` when the entry cannot be safely
 * rendered.
 *
 * Pure aside from the injected `mintObjectUrl` callback (which the binding owns).
 */
export function resolveFontVariant(
	font: PptxEmbeddedFont,
	mintObjectUrl: ObjectUrlFactory,
): ResolvedFontVariant | null {
	const name = typeof font.name === 'string' ? font.name.trim() : '';
	if (name.length === 0 || FONT_NAME_UNSAFE_CHARS.test(name)) {
		return null;
	}

	const weight = font.bold ? '700' : '400';
	const style = font.italic ? 'italic' : 'normal';

	// Strategy 1: ready-made, validated data URL from the core loader.
	if (isInjectableUrl(font.dataUrl)) {
		return { name, url: font.dataUrl, format: normalizeFontFormat(font.format), weight, style };
	}

	// Strategy 2: de-obfuscate raw bytes and mint an object URL.
	let clearBytes: Uint8Array | undefined;
	if (font.rawFontData && font.rawFontData.length > 0) {
		// Already clear-text (preserved by the loader for round-trip).
		clearBytes = font.rawFontData;
	} else if (font.originalPartBytes && font.originalPartBytes.length > 0 && font.fontGuid) {
		// Obfuscated bytes + GUID → XOR de-obfuscation (ECMA-376 Part 2 §14.2.1).
		clearBytes = deobfuscateFont(font.originalPartBytes, font.fontGuid);
	}

	if (!clearBytes || clearBytes.length < 4) {
		return null;
	}

	const detected = detectFontFormat(clearBytes);
	const format = FONT_FORMAT_ALLOWED.has(detected) ? detected : DEFAULT_FONT_FORMAT;
	const mime = fontMimeForFormat(format);
	const objectUrl = mintObjectUrl(clearBytes, mime);
	if (!objectUrl) {
		return null;
	}

	return { name, url: objectUrl, format, weight, style, objectUrl };
}

/** Build the `@font-face` rule text for one resolved variant. */
export function buildFontFaceRule(variant: ResolvedFontVariant): string {
	return [
		'@font-face {',
		`\tfont-family: "${variant.name}";`,
		`\tsrc: url("${variant.url}") format("${variant.format}");`,
		`\tfont-weight: ${variant.weight};`,
		`\tfont-style: ${variant.style};`,
		'\tfont-display: swap;',
		'}',
	].join('\n');
}

/** Build a safe `@font-face` stylesheet for host-provided font sources. */
export function buildUserFontFaceStyles(fonts: readonly ViewerFontSource[] | undefined): string {
	const rules: string[] = [];
	for (const font of fonts ?? []) {
		const family = typeof font.family === 'string' ? font.family.trim() : '';
		const src = typeof font.src === 'string' ? font.src.trim() : '';
		const isRemoteUrl = /^https?:\/\/[^"\\\n\r{};]+$/iu.test(src);
		if (!family || FONT_NAME_UNSAFE_CHARS.test(family) || !(isInjectableUrl(src) || isRemoteUrl)) {
			continue;
		}
		const format = normalizeFontFormat(font.format);
		const weight =
			typeof font.weight === 'number' || typeof font.weight === 'string' ? font.weight : '400';
		const style = font.style === 'italic' ? 'italic' : 'normal';
		rules.push(
			buildFontFaceRule({ name: family, url: src, format, weight: String(weight), style }),
		);
	}
	return rules.join('\n\n');
}

/** The product of resolving an embedded-font list: CSS, families, live URLs. */
export interface EmbeddedFontStyles {
	/** The generated `@font-face` stylesheet text. */
	fontFaceCss: string;
	/**
	 * Distinct CSS `font-family` strings for the embedded families, each with
	 * substitution fallbacks resolved (e.g. `'"Calibri", "Carlito", …'`).
	 */
	fontFamilies: string[];
	/** Object URLs minted while resolving (the caller must revoke these). */
	objectUrls: string[];
}

/**
 * Resolve a list of embedded fonts into the injectable `@font-face` stylesheet,
 * the distinct substitution-resolved family strings, and any object URLs minted
 * along the way (so the caller can track them for revocation).
 *
 * Pure aside from the injected `mintObjectUrl` callback.
 */
export function buildEmbeddedFontStyles(
	fonts: readonly PptxEmbeddedFont[] | null | undefined,
	mintObjectUrl: ObjectUrlFactory,
): EmbeddedFontStyles {
	const variants: ResolvedFontVariant[] = [];
	const objectUrls: string[] = [];
	for (const font of fonts ?? []) {
		const variant = resolveFontVariant(font, mintObjectUrl);
		if (!variant) {
			continue;
		}
		variants.push(variant);
		if (variant.objectUrl) {
			objectUrls.push(variant.objectUrl);
		}
	}

	const fontFaceCss = variants.map(buildFontFaceRule).join('\n\n');

	const seen = new Set<string>();
	const fontFamilies: string[] = [];
	for (const variant of variants) {
		if (seen.has(variant.name)) {
			continue;
		}
		seen.add(variant.name);
		fontFamilies.push(getSubstituteFontFamily(variant.name));
	}

	return { fontFaceCss, fontFamilies, objectUrls };
}
