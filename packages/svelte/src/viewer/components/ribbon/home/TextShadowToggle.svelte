<script lang="ts">
	/**
	 * TextShadowToggle: the Home tab's Font-group text-shadow button.
	 *
	 * Its own file rather than another control inside `FontExtrasGroup.svelte`,
	 * which is already at the 300-LOC ceiling. The on/off values and the
	 * clear-everything-on-off rule live in `editor-text-body-mutations.ts` so
	 * the shadow a Svelte user applies is byte-identical to a React one.
	 */
	import { hasTextProperties } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { hasTextShadow, toggleTextShadowPatch } from '../../../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(editor.editable && el !== undefined && hasTextProperties(el));
	const on = $derived(hasTextShadow(el));
</script>

<button
	type="button"
	class="pptx-svelte-textshadow"
	class:pptx-svelte-textshadow-on={on}
	disabled={!active}
	aria-pressed={on}
	aria-label={t('pptx.textEffects.shadow')}
	title={t('pptx.textEffects.shadow')}
	onclick={() => el && editor.patchSelected(toggleTextShadowPatch(el))}
>
	<svg viewBox="0 0 16 16" aria-hidden="true">
		<text x="3.5" y="12" font-size="11" font-weight="700" fill="currentColor" opacity="0.35">A</text>
		<text x="2" y="11" font-size="11" font-weight="700" fill="currentColor">A</text>
	</svg>
</button>

<style>
	.pptx-svelte-textshadow {
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
		font: inherit;
	}

	.pptx-svelte-textshadow:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-textshadow:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-textshadow-on {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-textshadow svg {
		width: 15px;
		height: 15px;
	}
</style>
