<script lang="ts">
	/**
	 * SlidesGroup: New slide / Duplicate slide / Delete slide, the Home tab's
	 * Slides group. Every op is history-integrated via `EditorState.slidesOps`
	 * (shared `render/slide-operations`); the caller also navigates the viewer
	 * to the new active slide since `EditorState` has no concept of "the
	 * active slide" beyond the index it already reads for element ops.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor, onnavigate }: { editor: EditorState; onnavigate: (index: number) => void } =
		$props();
	const t = useTranslator();

	function run(action: () => number | null): void {
		const index = action();
		if (index !== null) {
			onnavigate(index);
		}
	}
</script>

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.home.newSlide')}>
	<span class="pptx-svelte-rgroup-label">{t('pptx.ribbon.slides')}</span>
	<div class="pptx-svelte-rgroup-row">
		<button
			type="button"
			disabled={!editor.editable}
			aria-label={t('pptx.home.newSlide')}
			title={t('pptx.home.newSlide')}
			onclick={() => run(() => editor.slidesOps.insertSlideAfterCurrent())}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="9" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M11 6h2.5M12.25 4.75v2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
			<span>{t('pptx.home.newSlide')}</span>
		</button>
		<button
			type="button"
			disabled={!editor.editable}
			aria-label={t('pptx.ribbon.duplicateSlide')}
			title={t('pptx.ribbon.duplicateSlide')}
			onclick={() => run(() => editor.slidesOps.duplicateCurrentSlide())}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="4.5" width="7" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><rect x="6.5" y="2.5" width="7" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
		</button>
		<button
			type="button"
			class="pptx-svelte-rgroup-danger"
			disabled={!editor.editable}
			aria-label={t('pptx.arrange.delete')}
			title={t('pptx.arrange.delete')}
			onclick={() => run(() => editor.slidesOps.deleteCurrentSlide())}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.6 8.2c.05.7.6 1.3 1.3 1.3h2.2c.7 0 1.25-.6 1.3-1.3l.6-8.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		<button
			type="button"
			disabled={!editor.editable || editor.slides.length === 0}
			aria-label={t('pptx.sections.addSection')}
			title={t('pptx.sections.addSection')}
			onclick={() => editor.sectionOps.add(t('pptx.sections.defaultName'))}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10M3 8h6M3 13h10M11.5 6v4M9.5 8h4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
			<span>{t('pptx.sections.sectionButtonLabel')}</span>
		</button>
	</div>
</div>

<style>
	.pptx-svelte-rgroup {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-label {
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
	}

	.pptx-svelte-rgroup-row {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		overflow: hidden;
	}

	.pptx-svelte-rgroup-row button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 6px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
	}

	.pptx-svelte-rgroup-row button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-row button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rgroup-row svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-rgroup-danger:hover:not(:disabled) {
		background: #7f1d1d !important;
		color: #fecaca !important;
	}
</style>
