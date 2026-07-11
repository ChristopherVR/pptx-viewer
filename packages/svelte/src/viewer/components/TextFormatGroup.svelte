<script lang="ts">
	/**
	 * TextFormatGroup: bold / italic / underline toggles, font-size stepper +
	 * numeric input, and text-colour + highlight-colour pickers for the selected
	 * element. All reads use the shared inspector helpers; all writes go through
	 * `EditorState.patchSelected` so every change is history-integrated. Disabled
	 * (greyed) whenever the selection has no text properties.
	 */
	import { hasTextProperties } from 'pptx-viewer-core';
	import { fontSizeOf, isBold, isItalic, isUnderline, textColorOf } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import {
		adjustFontSizePatch,
		highlightColorOf,
		setFontSizePatch,
		setHighlightColorPatch,
		setTextColorPatch,
		toggleTextFlagPatch,
	} from '../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(!!el && hasTextProperties(el));
	const bold = $derived(el ? isBold(el) : false);
	const italic = $derived(el ? isItalic(el) : false);
	const underline = $derived(el ? isUnderline(el) : false);
	const fontSize = $derived(el ? fontSizeOf(el) : 18);
	const textColor = $derived(el ? textColorOf(el) : '#000000');
	const highlight = $derived(el ? highlightColorOf(el) || '#ffff00' : '#ffff00');

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
	function setColor(value: string): void {
		if (el) {
			editor.patchSelected(setTextColorPatch(el, value));
		}
	}
	function setHighlight(value: string): void {
		if (el) {
			editor.patchSelected(setHighlightColorPatch(el, value));
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

	<span class="pptx-svelte-fmt-sep" aria-hidden="true"></span>

	<label class="pptx-svelte-fmt-color" title={t('pptx.textProperties.textColor')}>
		<span class="pptx-svelte-fmt-color-glyph">A</span>
		<input
			type="color"
			disabled={!active}
			aria-label={t('pptx.textProperties.textColor')}
			value={textColor}
			onchange={(e) => setColor(e.currentTarget.value)}
		/>
	</label>
	<label class="pptx-svelte-fmt-color" title={t('pptx.text.highlightColor')}>
		<span class="pptx-svelte-fmt-color-glyph pptx-svelte-fmt-hl">H</span>
		<input
			type="color"
			disabled={!active}
			aria-label={t('pptx.text.highlightColor')}
			value={highlight}
			onchange={(e) => setHighlight(e.currentTarget.value)}
		/>
	</label>
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

	.pptx-svelte-fmt-color {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		cursor: pointer;
	}

	.pptx-svelte-fmt-color-glyph {
		font-weight: 700;
		font-size: 12px;
	}

	.pptx-svelte-fmt-hl {
		background: #ffe066;
		color: #1e1e2e;
		padding: 0 2px;
		border-radius: 2px;
	}

	.pptx-svelte-fmt-color input[type='color'] {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-fmt-color input[type='color']:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
