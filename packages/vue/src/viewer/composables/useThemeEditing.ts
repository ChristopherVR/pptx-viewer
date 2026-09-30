import { applyThemeToData, reResolveElementColors, reResolveElementFonts } from 'pptx-viewer-core';
import type {
	PptxData,
	PptxElement,
	PptxSlide,
	PptxTheme,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemePreset,
	PptxHandler,
} from 'pptx-viewer-core';
import { ref } from 'vue';
import type { Ref, ShallowRef } from 'vue';

export interface UseThemeEditingInput {
	handler?: Ref<PptxHandler | null | undefined>;
	slides: Ref<PptxSlide[]>;
	pptxTheme: Ref<PptxTheme | undefined>;
	themeColorMap: Ref<Record<string, string> | undefined>;
	pushHistory: () => void;
	themeGalleryOpen: Ref<boolean>;
	themeEditorOpen: Ref<boolean>;
	/**
	 * Master/layout elements rendered as a separate per-slide overlay layer
	 * (not part of `slide.elements`), re-coloured alongside `slides` so an
	 * applied theme doesn't leave inherited background shapes painted with
	 * the old scheme.
	 */
	templateElementsBySlideId: ShallowRef<Record<string, PptxElement[]>>;
}

export interface UseThemeEditingResult {
	themeEditorBusy: Ref<boolean>;
	applyTheme: (
		colorScheme: PptxThemeColorScheme,
		fontScheme: PptxThemeFontScheme | undefined,
		name: string,
	) => void;
	applyThemePreset: (preset: PptxThemePreset) => void;
	applyThemeEdit: (payload: {
		colorScheme: PptxThemeColorScheme;
		fontScheme: PptxThemeFontScheme;
		name: string;
	}) => Promise<void>;
}

/**
 * useThemeEditing: Design ▸ Themes gallery / Edit theme. Re-themes the whole
 * deck via core's pure `applyThemeToData` (re-resolves slide colours against
 * the new scheme) and writes the new slides/theme/colour-map back
 * (history-aware). Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useThemeEditing(input: UseThemeEditingInput): UseThemeEditingResult {
	const themeEditorBusy = ref(false);
	const {
		slides,
		pptxTheme,
		themeColorMap,
		pushHistory,
		themeGalleryOpen,
		themeEditorOpen,
		templateElementsBySlideId,
	} = input;

	function applyTheme(
		colorScheme: PptxThemeColorScheme,
		fontScheme: PptxThemeFontScheme | undefined,
		name: string,
	): void {
		pushHistory();
		const previousColorMap = themeColorMap.value ?? {};
		const previousFonts = pptxTheme.value?.fontScheme;
		const result = applyThemeToData(
			{
				slides: slides.value,
				theme: pptxTheme.value,
				themeColorMap: previousColorMap,
			} as unknown as PptxData,
			colorScheme,
			fontScheme,
			name,
		);
		slides.value = result.slides;
		pptxTheme.value = result.theme;
		themeColorMap.value = result.themeColorMap;
		if (Object.keys(templateElementsBySlideId.value).length > 0) {
			const recoloured: Record<string, PptxElement[]> = {};
			for (const [slideId, elements] of Object.entries(templateElementsBySlideId.value)) {
				recoloured[slideId] = reResolveElementFonts(
					reResolveElementColors(elements, previousColorMap, colorScheme),
					previousFonts,
					fontScheme ?? previousFonts ?? {},
				);
			}
			templateElementsBySlideId.value = recoloured;
		}
	}
	/** Apply a built-in theme preset (Design ▸ Themes gallery). */
	function applyThemePreset(preset: PptxThemePreset): void {
		applyTheme(preset.colorScheme, preset.fontScheme, preset.name);
		themeGalleryOpen.value = false;
	}
	/** Apply edited theme colours/fonts/name (Design ▸ Edit theme). */
	async function applyThemeEdit(payload: {
		colorScheme: PptxThemeColorScheme;
		fontScheme: PptxThemeFontScheme;
		name: string;
	}): Promise<void> {
		if (themeEditorBusy.value) {
			return;
		}
		themeEditorBusy.value = true;
		try {
			await input.handler?.value?.applyTheme(payload.colorScheme, payload.fontScheme, payload.name);
			applyTheme(payload.colorScheme, payload.fontScheme, payload.name);
			themeEditorOpen.value = false;
		} finally {
			themeEditorBusy.value = false;
		}
	}

	return { applyTheme, applyThemePreset, applyThemeEdit, themeEditorBusy };
}
