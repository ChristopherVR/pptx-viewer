<script lang="ts">
	/**
	 * NotesPanel: collapsible speaker-notes panel, docked below the slide
	 * stage. Plain-text surface only (no rich contentEditable toolbar); see
	 * the Vue binding's `NotesPanel.vue` for the richer editor this ports the
	 * plain-text code path from.
	 *
	 * Reads the current slide's notes via the shared `resolveNotesSegments` /
	 * `segmentsToPlainText` helpers (falls back to plain `slide.notes` when the
	 * deck has no rich `notesSegments`). This binding has no built-in
	 * slide-mutation channel, so writes go through the `onupdate` callback prop;
	 * omitting it renders a read-only textarea.
	 *
	 * Touch / focus correctness
	 * --------------------------
	 * The textarea is UNCONTROLLED while focused: its `value` is seeded from a
	 * local `$state` that is only reassigned inside an `$effect` gated on the
	 * slide id changing, never on every reactive tick. Edits commit on
	 * `change` / `blur` (not `input`), so an in-progress keystroke never gets
	 * fought by a reactive re-seed (mirrors Vue's `useNotesEditor` rationale).
	 */
	import { resolveNotesSegments, segmentsToPlainText } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { NotesPanelProps } from './props';

	const { slide, expanded = false, onupdate, ontoggle }: NotesPanelProps = $props();

	const t = useTranslator();

	const hasSlide = $derived(slide !== undefined);
	const collapsed = $derived(!expanded);
	/** No `onupdate` handler wired up: render a read-only surface. */
	const readonly = $derived(!onupdate);

	let text = $state('');
	let seededId: string | null = null;

	$effect(() => {
		const nextId = slide?.id ?? null;
		if (nextId === seededId) {
			return;
		}
		seededId = nextId;
		text = segmentsToPlainText(resolveNotesSegments(slide));
	});

	function commit(event: Event): void {
		const value = (event.currentTarget as HTMLTextAreaElement).value;
		text = value;
		onupdate?.(value);
	}
</script>

<section class="pptx-svelte-notes-panel" data-collapsed={collapsed}>
	<button
		type="button"
		class="pptx-svelte-notes-header"
		aria-expanded={!collapsed}
		aria-controls="pptx-svelte-notes-body"
		onclick={() => ontoggle?.()}
	>
		<span class="pptx-svelte-notes-title">{t('pptx.presenter.speakerNotes')}</span>
		<span class="pptx-svelte-notes-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
	</button>

	<div id="pptx-svelte-notes-body" class="pptx-svelte-notes-body" hidden={collapsed}>
		<textarea
			class="pptx-svelte-notes-textarea"
			name="slide-notes"
			value={text}
			disabled={!hasSlide}
			readonly={readonly}
			placeholder={hasSlide ? t('pptx.notes.addSpeakerNotes') : t('pptx.notes.noSlide')}
			aria-label={t('pptx.presenter.speakerNotes')}
			spellcheck="true"
			onchange={commit}
			onblur={commit}
		></textarea>
	</div>
</section>

<style>
	.pptx-svelte-notes-panel {
		display: flex;
		flex-direction: column;
		flex: none;
		border-top: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		font-family: system-ui, sans-serif;
	}

	.pptx-svelte-notes-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 6px 10px;
		border: none;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.pptx-svelte-notes-header:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-notes-chevron {
		font-size: 11px;
	}

	.pptx-svelte-notes-body {
		padding: 0 10px 10px;
	}

	.pptx-svelte-notes-textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: 80px;
		resize: vertical;
		padding: 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: var(--pptx-foreground, #e2e8f0);
		font: inherit;
		font-size: 13px;
		line-height: 1.5;
	}

	.pptx-svelte-notes-textarea:focus {
		outline: 2px solid var(--pptx-ring, #6366f1);
		outline-offset: -1px;
	}

	.pptx-svelte-notes-textarea:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
