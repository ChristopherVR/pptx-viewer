<script lang="ts">
	/**
	 * NotesPanel: collapsible speaker-notes panel, docked below the slide
	 * stage. It supports plain text on compact screens plus a desktop-oriented
	 * rich contentEditable surface with a compact formatting toolbar.
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
	import type { TextSegment } from 'pptx-viewer-core';
	import {
		applyInlineCommand,
		applyParagraphCommand,
		defaultRichEnabled,
		handleEditorAnchorClick,
		insertHyperlinkAtSelection,
		readEditorSegments,
		resolveNotesSegments,
		segmentsToEditorHtml,
		segmentsToPlainText,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { NotesPanelProps } from './props';
	import NotesFormattingToolbar from './NotesFormattingToolbar.svelte';

	const { slide, expanded = false, onupdate, ontoggle }: NotesPanelProps = $props();

	const t = useTranslator();

	const hasSlide = $derived(slide !== undefined);
	const collapsed = $derived(!expanded);
	/** No `onupdate` handler wired up: render a read-only surface. */
	const readonly = $derived(!onupdate);

	let text = $state('');
	let seededId: string | null = null;
	let rich = $state(defaultRichEnabled());
	let editorEl: HTMLDivElement | undefined = $state();
	let segments: TextSegment[] = [];

	$effect(() => {
		const nextId = slide?.id ?? null;
		if (nextId === seededId) {
			return;
		}
		seededId = nextId;
		segments = resolveNotesSegments(slide);
		text = segmentsToPlainText(segments);
		if (editorEl) editorEl.innerHTML = segmentsToEditorHtml(segments);
	});

	function commit(event: Event): void {
		const value = (event.currentTarget as HTMLTextAreaElement).value;
		text = value;
		onupdate?.(value);
	}

	function commitRich(): void {
		if (!editorEl) return;
		const next = readEditorSegments(editorEl);
		segments = next.segments;
		text = next.text;
		onupdate?.(next.text, next.segments);
	}

	function inline(command: 'bold' | 'italic' | 'underline' | 'strikeThrough'): void {
		applyInlineCommand(command);
		commitRich();
		editorEl?.focus();
	}

	function paragraph(command: 'bullet' | 'numbered' | 'indent' | 'outdent'): void {
		if (!editorEl) return;
		const next = applyParagraphCommand(editorEl, segments, command);
		segments = next.segments;
		text = next.text;
		editorEl.innerHTML = segmentsToEditorHtml(next.segments);
		onupdate?.(next.text, next.segments);
		editorEl.focus();
	}

	function link(): void {
		if (!editorEl) return;
		const url = window.prompt(t('pptx.notes.linkUrl'));
		if (!url) return;
		const selected = window.getSelection()?.toString() || window.prompt(t('pptx.notes.linkDisplayText')) || url;
		editorEl.focus();
		insertHyperlinkAtSelection(url, selected);
		commitRich();
	}

	function toggleMode(): void {
		rich = !rich;
		if (rich && editorEl) editorEl.innerHTML = segmentsToEditorHtml(segments);
	}
</script>

<section class="pptx-svelte-notes-panel" data-collapsed={collapsed}>
	<button
		type="button"
		class="pptx-svelte-notes-header"
		aria-expanded={!collapsed}
		aria-controls="slide-notes-content"
		onclick={() => ontoggle?.()}
	>
		<span class="pptx-svelte-notes-title">{t('pptx.notes.title')}</span>
		<span class="pptx-svelte-notes-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
	</button>

	<!-- `slide-notes-content` matches the id/aria-controls pair the React/Vue
	     notes panels emit (see e.g. `SlideNotesPanel.tsx`), part of the
	     framework-neutral e2e DOM contract documented in `playwright.config.ts`. -->
	<div id="slide-notes-content" class="pptx-svelte-notes-body" hidden={collapsed}>
		{#if !readonly}
			<NotesFormattingToolbar {rich} disabled={!hasSlide} oninline={inline} onparagraph={paragraph} onlink={link} ontogglemode={toggleMode} />
		{/if}
		{#if rich && !readonly}
			<div class="pptx-svelte-notes-rich" bind:this={editorEl} contenteditable={hasSlide} role="textbox" tabindex="0" aria-multiline="true" aria-label={t('pptx.presenter.speakerNotes')} spellcheck="true" oninput={commitRich} onblur={commitRich} onclick={(event) => handleEditorAnchorClick(event.target, event.ctrlKey || event.metaKey)} onkeydown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') commitRich(); }}></div>
		{:else}
			<textarea class="pptx-svelte-notes-textarea" name="slide-notes" value={text} disabled={!hasSlide} {readonly} placeholder={hasSlide ? t('pptx.notes.addSpeakerNotes') : t('pptx.notes.noSlide')} aria-label={t('pptx.presenter.speakerNotes')} spellcheck="true" onchange={commit} onblur={commit}></textarea>
		{/if}
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

	.pptx-svelte-notes-rich {
		box-sizing: border-box; min-height: 80px; max-height: 240px; overflow-y: auto;
		padding: 8px; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b); color: var(--pptx-foreground, #e2e8f0);
		font: 13px/1.5 system-ui, sans-serif; white-space: pre-wrap;
	}
	.pptx-svelte-notes-rich:focus { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: -1px; }
	.pptx-svelte-notes-rich :global(a) { color: #4a9eff; text-decoration: underline; cursor: pointer; }
</style>
