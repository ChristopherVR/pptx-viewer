import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { collectUsedFonts, describeFontEmbedding } from 'pptx-viewer-shared';
import type { FontEmbeddingDescriptor } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

export interface UseFontEmbeddingInput {
	slides: Ref<PptxSlide[]>;
	embeddedFonts: Ref<PptxEmbeddedFont[]>;
}

export interface UseFontEmbeddingResult {
	showFontEmbedding: Ref<boolean>;
	embedFontsEnabled: Ref<boolean>;
	/** Unique font families used across every slide, sorted (mirrors React collectUsedFonts). */
	usedFontFamilies: ComputedRef<string[]>;
	embeddedFontNames: ComputedRef<string[]>;
	/**
	 * Shared decision behind the toggle: whether it accepts input at all, and
	 * the position it must sit in for the deck that is currently loaded.
	 */
	fontEmbedding: ComputedRef<FontEmbeddingDescriptor>;
}

/**
 * useFontEmbedding: File ▸ Embed Fonts panel. Derives the set of font
 * families actually used across the deck (recursing into groups) so the panel
 * can flag which ones are missing from the embedded set. Extracted verbatim
 * from `PowerPointViewer.vue`.
 *
 * `embedFontsEnabled` is now read at save time (`useLoadContent` spreads
 * `embeddedFontSaveOptions` into the save options), so it must START in the
 * position that describes what save would do right now: ON for a deck that
 * arrived with embedded fonts, because core re-embeds them by default. The
 * hardcoded `false` this replaces would have stripped the embedded fonts of
 * every such deck the moment the flag was wired up.
 */
export function useFontEmbedding(input: UseFontEmbeddingInput): UseFontEmbeddingResult {
	const { slides, embeddedFonts } = input;

	const showFontEmbedding = ref(false);
	const usedFontFamilies = computed<string[]>(() => collectUsedFonts(slides.value));
	const embeddedFontNames = computed(() => embeddedFonts.value.map((f) => f.name));
	const fontEmbedding = computed(() => describeFontEmbedding(embeddedFontNames.value));

	const embedFontsEnabled = ref(fontEmbedding.value.initialEnabled);
	// Re-seed whenever a new deck lands: the previous deck's answer says nothing
	// about this one, and an unattended `true` would be a promise the viewer
	// cannot keep on a deck that embeds nothing.
	watch(fontEmbedding, (descriptor) => {
		embedFontsEnabled.value = descriptor.initialEnabled;
	});

	return {
		showFontEmbedding,
		embedFontsEnabled,
		usedFontFamilies,
		embeddedFontNames,
		fontEmbedding,
	};
}
