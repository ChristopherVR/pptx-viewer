import type { PptxEmbeddedFont, PptxSlide } from 'pptx-viewer-core';
import { collectUsedFonts } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
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
}

/**
 * useFontEmbedding: File ▸ Embed Fonts panel. Derives the set of font
 * families actually used across the deck (recursing into groups) so the panel
 * can flag which ones are missing from the embedded set. Extracted verbatim
 * from `PowerPointViewer.vue`.
 */
export function useFontEmbedding(input: UseFontEmbeddingInput): UseFontEmbeddingResult {
	const { slides, embeddedFonts } = input;

	const showFontEmbedding = ref(false);
	const embedFontsEnabled = ref(false);
	const usedFontFamilies = computed<string[]>(() => collectUsedFonts(slides.value));
	const embeddedFontNames = computed(() => embeddedFonts.value.map((f) => f.name));

	return { showFontEmbedding, embedFontsEnabled, usedFontFamilies, embeddedFontNames };
}
