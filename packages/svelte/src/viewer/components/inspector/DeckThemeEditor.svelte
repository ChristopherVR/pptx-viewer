<script lang="ts">
	/**
	 * DeckThemeEditor: the PRESENTATION theme editor (colour scheme, font
	 * scheme and name), wired to the deck. Rendered by the inspector's
	 * `ThemeSection` and by Design > Edit Theme, which is where React, Vue and
	 * Angular put their `ThemeEditorPanel` too.
	 *
	 * WHY two update paths: a colour-picker drag fires continuously, so a live
	 * colour edit takes the CHEAP route React settled on (write the scheme into
	 * the archive, then re-resolve the live slides' colours in place via core's
	 * `reResolveSlideColors`). Only the explicit "Apply to Presentation" button
	 * runs the heavy `switchTheme` round-trip. Doing the heavy path per picker
	 * frame is what previously froze the React renderer for seconds.
	 */
	import type {
		PptxHandler,
		PptxTheme,
		PptxThemeColorScheme,
		PptxThemeFontScheme,
	} from 'pptx-viewer-core';
	import { THEME_PRESETS } from 'pptx-viewer-core';

	import type { EditorState } from '../../editor/editor-state.svelte';
	import { applyThemeColorScheme, applyThemeFontScheme } from '../../editor/editor-theme-scheme';
	import ThemeEditorPanel from './ThemeEditorPanel.svelte';

	const {
		editor,
		handler,
		theme,
		onthemechange,
	}: {
		editor: EditorState;
		handler: PptxHandler;
		theme: PptxTheme | undefined;
		onthemechange: (theme: PptxTheme) => void;
	} = $props();
	let busy = $state(false);
	const current = $derived(
		theme ?? {
			name: 'Custom Theme',
			colorScheme: THEME_PRESETS[0].colorScheme,
			fontScheme: THEME_PRESETS[0].fontScheme,
		},
	);

	/** Cheap live colour edit: rewrite the archive scheme + remap live slides. */
	async function updateColorScheme(colorScheme: PptxThemeColorScheme): Promise<void> {
		onthemechange(await applyThemeColorScheme(editor, handler, current, colorScheme));
	}

	async function updateFontScheme(fontScheme: PptxThemeFontScheme): Promise<void> {
		onthemechange(await applyThemeFontScheme(handler, current, fontScheme));
	}

	async function updateName(name: string): Promise<void> {
		await handler.updateThemeName(name);
		onthemechange({ ...current, name });
	}

	/** Heavy path: re-derive every slide from the theme (explicit button only). */
	async function applyToPresentation(): Promise<void> {
		busy = true;
		try {
			const result = await handler.switchTheme(
				{ slides: editor.slides, width: 0, height: 0, theme: current },
				current.colorScheme ?? THEME_PRESETS[0].colorScheme,
				current.fontScheme ?? {},
				current.name ?? 'Custom Theme',
			);
			editor.commitSlides(result.slides);
			onthemechange(result.theme ?? current);
		} finally {
			busy = false;
		}
	}
</script>

<ThemeEditorPanel
	theme={current}
	canEdit={editor.editable && !busy}
	onupdatecolorscheme={(colorScheme) => void updateColorScheme(colorScheme)}
	onupdatefontscheme={(fontScheme) => void updateFontScheme(fontScheme)}
	onupdatename={(name) => void updateName(name)}
	onapply={() => void applyToPresentation()}
/>
