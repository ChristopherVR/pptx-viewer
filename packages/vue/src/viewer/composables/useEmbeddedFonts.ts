import type { PptxEmbeddedFont } from 'pptx-viewer-core';
import { deobfuscateFont, detectFontFormat, getSubstituteFontFamily } from 'pptx-viewer-core';
import { computed, onScopeDispose, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

/**
 * `useEmbeddedFonts` — Vue port of the embedded-font injection logic in the
 * React `useFontInjection` hook (the `@font-face` half).
 *
 * Given the embedded fonts parsed out of a `.pptx` by `pptx-viewer-core`, this
 * composable builds `@font-face` CSS rules and injects them into the document
 * so that slides render with the typefaces the author embedded. The injected
 * `<style>` element is appended to `<head>` and removed on scope dispose.
 *
 * The core load pipeline (`PptxHandlerRuntimeEmbeddedFonts`) already
 * de-obfuscates the OOXML XOR layer and produces a ready-to-use `dataUrl` for
 * each style variant. One {@link PptxEmbeddedFont} therefore corresponds to a
 * single style variant (regular / bold / italic / boldItalic), distinguished by
 * its `bold` and `italic` flags — a font with regular + bold data yields two
 * entries and two `@font-face` rules.
 *
 * As a defence-in-depth fallback, if an entry arrives without a usable
 * `dataUrl` but carries the obfuscated `originalPartBytes` plus a `fontGuid`,
 * this composable de-obfuscates the bytes itself (via core's `deobfuscateFont`)
 * and mints an object URL so the variant can still be registered.
 *
 * @param fonts - Reactive source of the parsed embedded fonts (the host feeds
 *   these from `PptxData.embeddedFonts`).
 * @returns Reactive `fontFaceCss` (the generated stylesheet text) and
 *   `fontFamilies` (the distinct embedded family names, with substitution
 *   fallbacks resolved for downstream `font-family` use).
 */
export interface UseEmbeddedFontsResult {
	/** The generated `@font-face` stylesheet text (also injected into `<head>`). */
	fontFaceCss: ComputedRef<string>;
	/**
	 * Distinct CSS `font-family` strings for the embedded families, each with
	 * substitution fallbacks resolved (e.g. `'"Calibri", "Carlito", …'`).
	 */
	fontFamilies: ComputedRef<string[]>;
}

const STYLE_ELEMENT_ID = 'pptx-vue-embedded-fonts';

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

function isInjectableUrl(url: string): boolean {
	if (typeof url !== 'string' || url.length === 0) {
		return false;
	}
	if (url.startsWith('blob:')) {
		return true;
	}
	return FONT_DATA_URL_PATTERN.test(url);
}

/** True when the runtime exposes the DOM + object-URL APIs we need. */
function hasDomSupport(): boolean {
	return (
		typeof document !== 'undefined' &&
		typeof document.createElement === 'function' &&
		typeof document.head !== 'undefined'
	);
}

function hasObjectUrlSupport(): boolean {
	return (
		typeof URL !== 'undefined' &&
		typeof URL.createObjectURL === 'function' &&
		typeof URL.revokeObjectURL === 'function' &&
		typeof Blob !== 'undefined'
	);
}

const FONT_MIME_BY_FORMAT: Record<string, string> = {
	truetype: 'font/ttf',
	opentype: 'font/otf',
	woff: 'font/woff',
	woff2: 'font/woff2',
};

/** A single resolved variant ready to be emitted as a `@font-face` rule. */
interface ResolvedFontVariant {
	name: string;
	url: string;
	format: string;
	weight: string;
	style: string;
	/** Object URL minted for this variant (must be revoked on cleanup). */
	objectUrl?: string;
}

/**
 * Resolve a single embedded-font entry to an injectable variant.
 *
 * Prefers the de-obfuscated `dataUrl` produced by the core loader. Falls back
 * to de-obfuscating `originalPartBytes` with `fontGuid` (or `rawFontData`
 * directly) and minting an object URL when no usable data URL is present.
 * Returns `null` when the entry cannot be safely rendered.
 */
function resolveVariant(font: PptxEmbeddedFont): ResolvedFontVariant | null {
	const name = typeof font.name === 'string' ? font.name.trim() : '';
	if (name.length === 0 || FONT_NAME_UNSAFE_CHARS.test(name)) {
		return null;
	}

	const weight = font.bold ? '700' : '400';
	const style = font.italic ? 'italic' : 'normal';

	// ── Strategy 1: ready-made, validated data URL from the core loader ──
	if (isInjectableUrl(font.dataUrl)) {
		const format = font.format && FONT_FORMAT_ALLOWED.has(font.format) ? font.format : 'truetype';
		return { name, url: font.dataUrl, format, weight, style };
	}

	// ── Strategy 2: de-obfuscate raw bytes and mint an object URL ──
	if (!hasObjectUrlSupport()) {
		return null;
	}

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
	const format = FONT_FORMAT_ALLOWED.has(detected) ? detected : 'truetype';
	const mime = FONT_MIME_BY_FORMAT[format] ?? 'font/ttf';
	// Copy into a fresh, plain-`ArrayBuffer`-backed view so the `Blob` part type
	// is satisfied (a `Uint8Array` over a `SharedArrayBuffer` is not a `BlobPart`).
	const blobBytes = new Uint8Array(clearBytes.length);
	blobBytes.set(clearBytes);
	const blob = new Blob([blobBytes], { type: mime });
	const objectUrl = URL.createObjectURL(blob);

	return { name, url: objectUrl, format, weight, style, objectUrl };
}

function buildFontFaceRule(variant: ResolvedFontVariant): string {
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

export function useEmbeddedFonts(
	fonts: MaybeRefOrGetter<PptxEmbeddedFont[]>,
): UseEmbeddedFontsResult {
	// Object URLs minted on the most recent computation; revoked when superseded.
	let liveObjectUrls: string[] = [];
	let styleEl: HTMLStyleElement | null = null;

	const revokeObjectUrls = (urls: string[]): void => {
		if (!hasObjectUrlSupport()) {
			return;
		}
		for (const url of urls) {
			URL.revokeObjectURL(url);
		}
	};

	// The set of injectable variants, recomputed whenever the source changes.
	// NOTE: object URLs from the *previous* run are revoked here as a side
	// effect so they don't leak across re-parses.
	const resolvedVariants = computed<ResolvedFontVariant[]>(() => {
		const source = toValue(fonts) ?? [];
		const previousUrls = liveObjectUrls;
		const nextUrls: string[] = [];
		const variants: ResolvedFontVariant[] = [];
		for (const font of source) {
			const variant = resolveVariant(font);
			if (!variant) {
				continue;
			}
			variants.push(variant);
			if (variant.objectUrl) {
				nextUrls.push(variant.objectUrl);
			}
		}
		liveObjectUrls = nextUrls;
		revokeObjectUrls(previousUrls);
		return variants;
	});

	const fontFaceCss = computed<string>(() =>
		resolvedVariants.value.map(buildFontFaceRule).join('\n\n'),
	);

	const fontFamilies = computed<string[]>(() => {
		const seen = new Set<string>();
		const families: string[] = [];
		for (const variant of resolvedVariants.value) {
			if (seen.has(variant.name)) {
				continue;
			}
			seen.add(variant.name);
			families.push(getSubstituteFontFamily(variant.name));
		}
		return families;
	});

	// ── Side effect: inject / update the <style> element ──
	const syncStyleElement = (css: string): void => {
		if (!hasDomSupport()) {
			return;
		}
		if (css.length === 0) {
			if (styleEl && styleEl.parentNode) {
				styleEl.parentNode.removeChild(styleEl);
			}
			styleEl = null;
			return;
		}
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = STYLE_ELEMENT_ID;
			document.head.appendChild(styleEl);
		}
		styleEl.textContent = css;
	};

	// Drive the injection off the computed CSS. The watcher reads `fontFaceCss`
	// (which in turn drives `resolvedVariants`, including object-URL lifecycle),
	// then mirrors the result into a `<style>` element. `immediate: true`
	// performs the initial injection; the DOM is only touched inside
	// `syncStyleElement`, which feature-detects `document`, keeping the
	// composable SSR-safe.
	const stopWatch = watch(fontFaceCss, syncStyleElement, { immediate: true });

	onScopeDispose(() => {
		stopWatch();
		if (styleEl && styleEl.parentNode) {
			styleEl.parentNode.removeChild(styleEl);
		}
		styleEl = null;
		revokeObjectUrls(liveObjectUrls);
		liveObjectUrls = [];
	});

	return { fontFaceCss, fontFamilies };
}
