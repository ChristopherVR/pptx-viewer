<script lang="ts">
	/**
	 * ParagraphGroup: bullet / numbered list, indent, alignment, and line
	 * spacing for the Home tab's Paragraph group. Reads/writes the element's
	 * `textStyle` (the base every paragraph inherits from), matching
	 * `editor-paragraph-mutations.ts`'s convention. Disabled whenever the
	 * selection has no text properties.
	 */
	import type { PptxElement, TextStyle } from 'pptx-viewer-core';
	import { hasTextProperties } from 'pptx-viewer-core';
	import { LINE_SPACING_OPTIONS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import {
		adjustIndentPatch,
		setAlignPatch,
		setLineSpacingPatch,
		toggleListTypePatch,
	} from '../../../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasTextProperties(el));
	const style = $derived<TextStyle>(el && hasTextProperties(el) ? (el.textStyle ?? {}) : {});

	function apply(patch: Partial<PptxElement>): void {
		editor.patchSelected(patch);
	}

	const ALIGN_BUTTONS = [
		{ value: 'left', d: 'M2 4h12M2 8h8M2 12h10', key: 'pptx.ribbon.alignLeft' },
		{ value: 'center', d: 'M2 4h12M4 8h8M3 12h10', key: 'pptx.ribbon.alignCenter' },
		{ value: 'right', d: 'M2 4h12M6 8h8M4 12h10', key: 'pptx.ribbon.alignRight' },
		{ value: 'justify', d: 'M2 4h12M2 8h12M2 12h12', key: 'pptx.ribbon.justify' },
	] as const;
</script>

<div class="pptx-svelte-para" role="group" aria-label={t('pptx.ribbon.paragraph')}>
	<button
		type="button"
		class="pptx-svelte-para-btn"
		class:pptx-svelte-para-on={style.listType === 'bullet'}
		disabled={!active}
		aria-pressed={style.listType === 'bullet'}
		aria-label={t('pptx.text.bulletList')}
		title={t('pptx.text.bulletList')}
		onclick={() => el && apply(toggleListTypePatch(el, 'bullet'))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="4" r="1" fill="currentColor" /><circle cx="3" cy="8" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><path d="M6 4h7M6 8h7M6 12h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-para-btn"
		class:pptx-svelte-para-on={style.listType === 'numbered'}
		disabled={!active}
		aria-pressed={style.listType === 'numbered'}
		aria-label={t('pptx.text.numberedList')}
		title={t('pptx.text.numberedList')}
		onclick={() => el && apply(toggleListTypePatch(el, 'numbered'))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><text x="1" y="5.5" font-size="4" fill="currentColor">1</text><text x="1" y="9.5" font-size="4" fill="currentColor">2</text><text x="1" y="13.5" font-size="4" fill="currentColor">3</text><path d="M6 4h7M6 8h7M6 12h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
	</button>

	<span class="pptx-svelte-para-sep" aria-hidden="true"></span>

	<button
		type="button"
		class="pptx-svelte-para-btn"
		disabled={!active}
		aria-label={t('pptx.text.decreaseIndent')}
		title={t('pptx.text.decreaseIndent')}
		onclick={() => el && apply(adjustIndentPatch(el, -1))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4h8M6 12h8M6 8h8M2 8l2.5-2.5M2 8l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-para-btn"
		disabled={!active}
		aria-label={t('pptx.text.increaseIndent')}
		title={t('pptx.text.increaseIndent')}
		onclick={() => el && apply(adjustIndentPatch(el, 1))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4h8M6 12h8M6 8h8M4.5 5.5 2 8l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>

	<span class="pptx-svelte-para-sep" aria-hidden="true"></span>

	{#each ALIGN_BUTTONS as btn (btn.value)}
		<button
			type="button"
			class="pptx-svelte-para-btn"
			class:pptx-svelte-para-on={style.align === btn.value}
			disabled={!active}
			aria-pressed={style.align === btn.value}
			aria-label={t(btn.key)}
			title={t(btn.key)}
			onclick={() => el && apply(setAlignPatch(el, btn.value as TextStyle['align']))}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d={btn.d} stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
		</button>
	{/each}

	<select
		class="pptx-svelte-para-select"
		disabled={!active}
		aria-label={t('pptx.paragraph.lineSpacing')}
		title={t('pptx.paragraph.lineSpacing')}
		onchange={(e) => {
			if (el && e.currentTarget.value) {
				apply(setLineSpacingPatch(el, Number(e.currentTarget.value)));
			}
		}}
	>
		<option value="">{t('pptx.paragraph.lineSpacing')}</option>
		{#each LINE_SPACING_OPTIONS as option (option.value)}
			<option value={option.value} selected={style.lineSpacing === option.value}>
				{option.label}
			</option>
		{/each}
	</select>
</div>

<style>
	.pptx-svelte-para {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.pptx-svelte-para-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-para-btn:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-para-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-para-on {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-para-btn svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-para-sep {
		width: 1px;
		height: 18px;
		margin: 0 3px;
		background: var(--pptx-border, #33334d);
	}

	.pptx-svelte-para-select {
		height: 26px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-para-select:disabled {
		opacity: 0.35;
	}
</style>
