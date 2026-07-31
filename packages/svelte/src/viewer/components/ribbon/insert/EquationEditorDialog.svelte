<script lang="ts">
	/**
	 * EquationEditorDialog: modal LaTeX equation editor mirroring React's
	 * `EquationEditorDialog.tsx`: a live MathML preview, a LaTeX textarea, and
	 * the shared template gallery (`EQUATION_TEMPLATES`), with Ctrl+Enter to
	 * insert and Escape/backdrop to dismiss. Converts LaTeX to OMML via the
	 * shared `latex-to-omml` module on Insert; every rendered MathML string
	 * goes through `mathml-sanitize` before the `{@html ...}` binding.
	 *
	 * Insert mode adds a new equation shape (`buildEquationInsertElement`);
	 * edit mode (an `editor.equationOps.editingId` is set) seeds the textarea
	 * from the existing OMML and applies the replacement in place.
	 */
	import { compileLatexEquation, convertOmmlToLatex } from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildEquationInsertElement } from '../../../editor';
	import EquationTemplateGallery from './EquationTemplateGallery.svelte';

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
	let wasOpen = false;
	// eslint-disable-next-line prefer-const
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	const isEditing = $derived(Boolean(editor.equationOps.editingId));

	/** Live LaTeX -> OMML -> MathML for the preview + the insert payload. */
	const compiled = $derived(compileLatexEquation(latex));

	const hasContent = $derived(latex.trim().length > 0 && Object.keys(compiled.omml).length > 0);

	// Re-seed the textarea on every open transition: from the existing OMML in
	// edit mode, empty for a fresh insert (so a cancelled session never leaks
	// stale LaTeX into the next one).
	$effect(() => {
		if (open && !wasOpen) {
			const existing = editor.equationOps.omml;
			latex = existing ? convertOmmlToLatex(existing) : '';
			textareaEl?.focus();
		}
		wasOpen = open;
	});

	function insert(): void {
		if (!hasContent) {
			return;
		}
		if (editor.equationOps.editingId) {
			editor.equationOps.apply(compiled.omml);
		} else {
			editor.insertElement(buildEquationInsertElement(compiled.omml, canvasSize));
		}
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

	function onBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="backdrop" onclick={onBackdropClick} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
		<section
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-label={t(isEditing ? 'pptx.equation.editTitle' : 'pptx.equation.insertTitle')}
		>
			<header>
				<h2>{t(isEditing ? 'pptx.equation.editTitle' : 'pptx.equation.insertTitle')}</h2>
				<button type="button" class="close" aria-label={t('pptx.settings.close')} onclick={onclose}>×</button>
			</header>

			<div class="preview" class:empty={!hasContent}>
				{#if hasContent}
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					<span class="math">{@html compiled.mathml}</span>
				{:else}
					{t('pptx.equation.previewPlaceholder')}
				{/if}
			</div>

			<label class="field">
				<span class="label">{t('pptx.equation.latexInput')}</span>
				<textarea
					bind:this={textareaEl}
					rows="3"
					placeholder={LATEX_PLACEHOLDER}
					spellcheck="false"
					disabled={!editor.editable}
					bind:value={latex}
				></textarea>
				<span class="hint">{t('pptx.equation.latexHint')}</span>
			</label>

			<EquationTemplateGallery activeLatex={latex} onselect={(next) => (latex = next)} />

			<footer>
				<button type="button" onclick={onclose}>{t('pptx.equation.cancel')}</button>
				<button
					type="button"
					class="primary"
					disabled={!editor.editable || !hasContent}
					onclick={insert}
				>
					{t(isEditing ? 'pptx.equation.update' : 'pptx.equation.insert')}
				</button>
			</footer>
		</section>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: grid;
		place-items: center;
		background: #0009;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: min(600px, calc(100vw - 32px));
		max-height: 85vh;
		overflow-y: auto;
		padding: 18px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: 11px;
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-foreground, #f3f4f6);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-size: 14px;
	}

	.close {
		border: none;
		background: none;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 16px;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: var(--pptx-radius, 6px);
	}

	.close:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.preview {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 72px;
		padding: 12px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		font-size: 22px;
	}

	.preview.empty {
		font-size: 12px;
		font-style: italic;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.math {
		font-family: 'Cambria Math', 'STIX Two Math', serif;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.label {
		font-size: 11px;
		font-weight: 500;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	textarea {
		width: 100%;
		padding: 6px 8px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12px;
		resize: vertical;
	}

	textarea:disabled {
		opacity: 0.4;
	}

	.hint {
		font-size: 10px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	footer {
		display: flex;
		justify-content: flex-end;
		gap: 7px;
	}

	footer button {
		height: 28px;
		padding: 0 12px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	footer button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	footer button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.primary {
		border-color: transparent;
		background: var(--pptx-primary, #c43b32);
		color: #fff;
	}

	.primary:hover:not(:disabled) {
		background: var(--pptx-primary, #c43b32);
		color: #fff;
		filter: brightness(1.1);
	}
</style>
