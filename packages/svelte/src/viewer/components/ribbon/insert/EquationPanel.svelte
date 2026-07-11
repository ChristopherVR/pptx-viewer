<script lang="ts">
	/**
	 * EquationPanel: a docked LaTeX equation panel (input + live MathML preview
	 * + Insert/Cancel), mirroring `FindReplacePanel.svelte`'s docked idiom
	 * rather than React's modal `EquationEditorDialog`. Converts the LaTeX
	 * source to OMML via the shared `latex-to-omml` module on Insert; the live
	 * preview goes through `omml-to-mathml` + `mathml-sanitize` so the injected
	 * markup is safe before the `{@html ...}` binding.
	 */
	import { convertLatexToOmml, convertOmmlToMathMl, sanitizeMathMl } from 'pptx-viewer-shared';
	import type { CanvasSize, OmmlNode } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildEquationInsertElement } from '../../../editor';

	const {
		editor,
		canvasSize,
		open,
		onclose,
	}: {
		editor: EditorState;
		canvasSize: CanvasSize;
		open: boolean;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	/** Sample placeholder shown in the empty LaTeX textarea. */
	const LATEX_PLACEHOLDER = '\\frac{a}{b} + \\sqrt{c}';

	let latex = $state('');
	// eslint-disable-next-line prefer-const
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	const preview = $derived.by((): string | null => {
		const trimmed = latex.trim();
		if (!trimmed) {
			return null;
		}
		try {
			const omml = convertLatexToOmml(trimmed);
			const mathml = convertOmmlToMathMl(omml as OmmlNode);
			return mathml ? sanitizeMathMl(mathml) : null;
		} catch {
			return null;
		}
	});

	$effect(() => {
		if (open) {
			textareaEl?.focus();
		}
	});

	function insert(): void {
		const trimmed = latex.trim();
		if (!trimmed) {
			return;
		}
		const omml = convertLatexToOmml(trimmed);
		if (Object.keys(omml).length === 0) {
			return;
		}
		editor.insertElement(buildEquationInsertElement(omml, canvasSize));
		latex = '';
		onclose();
	}

	function onKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Escape') {
			onclose();
		} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault();
			insert();
		}
	}
</script>

{#if open}
	<div class="pptx-svelte-equation" role="dialog" aria-label={t('pptx.equation.insertTitle')}>
		<div class="pptx-svelte-equation-row">
			<textarea
				bind:this={textareaEl}
				class="pptx-svelte-equation-input"
				rows="2"
				placeholder={LATEX_PLACEHOLDER}
				aria-label={t('pptx.equation.latexInput')}
				spellcheck="false"
				disabled={!editor.editable}
				bind:value={latex}
				onkeydown={onKeydown}
			></textarea>
			<button
				type="button"
				disabled={!editor.editable || !latex.trim()}
				aria-label={t('pptx.equation.insert')}
				onclick={insert}
			>
				{t('pptx.equation.insert')}
			</button>
			<button type="button" aria-label={t('pptx.equation.cancel')} onclick={onclose}>
				{t('pptx.equation.cancel')}
			</button>
		</div>
		<span class="pptx-svelte-equation-hint">{t('pptx.equation.latexHint')}</span>
		<div class="pptx-svelte-equation-preview">
			{#if preview}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html preview}
			{:else}
				{t('pptx.equation.previewPlaceholder')}
			{/if}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-equation {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		padding: 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
	}

	.pptx-svelte-equation-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
	}

	.pptx-svelte-equation-input {
		flex: 1;
		min-width: 200px;
		padding: 6px 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 12px;
		resize: vertical;
	}

	.pptx-svelte-equation-input:disabled {
		opacity: 0.4;
	}

	.pptx-svelte-equation-row button {
		height: 28px;
		padding: 0 10px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		white-space: nowrap;
	}

	.pptx-svelte-equation-row button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-equation-row button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-equation-hint {
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-equation-preview {
		min-height: 32px;
		padding: 6px 8px;
		border: 1px dashed var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		font-size: 14px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
