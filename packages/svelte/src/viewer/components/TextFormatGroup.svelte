<script lang="ts">
	/**
	 * TextFormatGroup: bold / italic / underline toggles and a font-size
	 * stepper + numeric input for the selected element. Font family,
	 * strikethrough, clear formatting, change case, character spacing, and
	 * the font-colour / highlight-colour swatch pickers live in the Home
	 * tab's `FontExtrasGroup` (ribbon/home/) to keep this file focused; both
	 * read/write the same element via the shared inspector helpers and
	 * `EditorState.patchSelected` so every change is history-integrated.
	 * Disabled (greyed) whenever the selection has no text properties.
	 */
	import { hasTextProperties } from 'pptx-viewer-core';
	import { fontSizeOf, isBold, isItalic, isUnderline } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import { adjustFontSizePatch, setFontSizePatch, toggleTextFlagPatch } from '../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasTextProperties(el));
	const bold = $derived(el ? isBold(el) : false);
	const italic = $derived(el ? isItalic(el) : false);
	const underline = $derived(el ? isUnderline(el) : false);
	// With no selection the ribbon shows PowerPoint's default body size, matching
	// React's `HomeSection` (`extractFontInfo` defaults to Segoe UI / 24).
	const fontSize = $derived(el ? fontSizeOf(el) : 24);

	function toggle(flag: 'bold' | 'italic' | 'underline'): void {
		if (el) {
			editor.patchSelected(toggleTextFlagPatch(el, flag));
		}
	}
	function step(delta: number): void {
		if (el) {
			editor.patchSelected(adjustFontSizePatch(el, delta));
		}
	}
	function setSize(value: string): void {
		const n = Number(value);
		if (el && Number.isFinite(n)) {
			editor.patchSelected(setFontSizePatch(el, n));
		}
	}
</script>

<div class="pptx-svelte-fmt" role="group" aria-label={t('pptx.inspector.text')}>
	<button
		type="button"
		class="pptx-svelte-fmt-btn"
		class:pptx-svelte-fmt-on={bold}
		disabled={!active}
		aria-pressed={bold}
		aria-label={t('pptx.inspector.bold')}
		title={t('pptx.inspector.bold')}
		onclick={() => toggle('bold')}
	>
		<span style="font-weight: 800">B</span>
	</button>
	<button
		type="button"
		class="pptx-svelte-fmt-btn"
		class:pptx-svelte-fmt-on={italic}
		disabled={!active}
		aria-pressed={italic}
		aria-label={t('pptx.inspector.italic')}
		title={t('pptx.inspector.italic')}
		onclick={() => toggle('italic')}
	>
		<span style="font-style: italic; font-family: Georgia, serif">I</span>
	</button>
	<button
		type="button"
		class="pptx-svelte-fmt-btn"
		class:pptx-svelte-fmt-on={underline}
		disabled={!active}
		aria-pressed={underline}
		aria-label={t('pptx.inspector.underline')}
		title={t('pptx.inspector.underline')}
		onclick={() => toggle('underline')}
	>
		<span style="text-decoration: underline">U</span>
	</button>

	<span class="pptx-svelte-fmt-sep" aria-hidden="true"></span>

	<button
		type="button"
		class="pptx-svelte-fmt-btn"
		disabled={!active}
		aria-label={t('pptx.text.decreaseFontSize')}
		title={t('pptx.text.decreaseFontSize')}
		onclick={() => step(-2)}
	>
		<span aria-hidden="true">A-</span>
	</button>
	<input
		class="pptx-svelte-fmt-size"
		type="number"
		min="1"
		max="400"
		disabled={!active}
		aria-label={t('pptx.ribbon.fontSize')}
		title={t('pptx.ribbon.fontSize')}
		value={Math.round(fontSize)}
		onchange={(e) => setSize(e.currentTarget.value)}
	/>
	<button
		type="button"
		class="pptx-svelte-fmt-btn"
		disabled={!active}
		aria-label={t('pptx.text.increaseFontSize')}
		title={t('pptx.text.increaseFontSize')}
		onclick={() => step(2)}
	>
		<span aria-hidden="true">A+</span>
	</button>
</div>

<style>
	.pptx-svelte-fmt {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-fmt-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 13px;
	}

	.pptx-svelte-fmt-btn:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-fmt-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-fmt-on {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-fmt-size {
		width: 46px;
		height: 28px;
		text-align: center;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-fmt-size:disabled {
		opacity: 0.35;
	}

	.pptx-svelte-fmt-sep {
		width: 1px;
		height: 20px;
		margin: 0 3px;
		background: var(--pptx-border, #33334d);
	}
</style>
