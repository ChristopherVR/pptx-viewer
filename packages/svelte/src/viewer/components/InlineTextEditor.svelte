<script lang="ts">
	/**
	 * InlineTextEditor: a contenteditable surface positioned over a text/shape
	 * element (Svelte port of the vanilla binding's `openInlineEditor`). Opened by
	 * a double-click, it seeds the element's plain text, commits on blur and on
	 * Escape, and keeps every keystroke local so viewer navigation / editor
	 * shortcuts never fire while typing. On commit the plain text is remapped back
	 * onto the original rich segments upstream (see `EditorState.commitInlineText`
	 * / the shared `remapTextToSegments`), so per-run styles and field metadata
	 * survive the round trip.
	 */
	import { onDestroy, onMount, untrack } from 'svelte';

	import { readEditableText, resolveInlineSurface } from '../editor/inline-text';
	import type { InlineTextEditorProps } from './props';

	const { element, box, scale, oncommit, onclose }: InlineTextEditorProps = $props();

	const surface = $derived(resolveInlineSurface(element));
	// The surface is remounted per edit session (keyed on the element id), so the
	// element is stable for its lifetime: capture the seed text once.
	const initialText = untrack(() => resolveInlineSurface(element).text);

	// eslint-disable-next-line no-unassigned-vars
	let el: HTMLDivElement | undefined;
	let closed = false;

	const style = $derived(
		`left:${box.x * scale}px;top:${box.y * scale}px;width:${box.width * scale}px;min-height:${box.height * scale}px;${typeof surface.fontSize === 'number' ? `font-size:${surface.fontSize * scale}px;` : ''}${surface.fontFamily !== undefined ? `font-family:${surface.fontFamily};` : ''}`,
	);

	function close(commitText: string | null): void {
		if (closed) {
			return;
		}
		closed = true;
		if (commitText !== null && commitText !== initialText) {
			oncommit(commitText);
		}
		onclose();
	}

	function onBlur(): void {
		close(el ? readEditableText(el) : null);
	}

	function onKeydown(event: KeyboardEvent): void {
		// Keep every keystroke local so viewer navigation / editor shortcuts
		// (arrows, space, Delete, Ctrl+Z...) never fire while typing.
		event.stopPropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			close(el ? readEditableText(el) : null);
		}
	}

	onMount(() => {
		if (el) {
			el.textContent = initialText;
			el.focus();
		}
	});

	// Committed on unmount too (e.g. the slide changed out from under the editor),
	// mirroring the vanilla controller's commit-on-close.
	onDestroy(() => {
		if (!closed && el) {
			close(readEditableText(el));
		}
	});
</script>

<div
	bind:this={el}
	class="pptx-svelte-inline-editor"
	style={style}
	contenteditable="true"
	role="textbox"
	tabindex="0"
	aria-multiline="true"
	aria-label="edit text"
	onblur={onBlur}
	onkeydown={onKeydown}
	onpointerdown={(event) => event.stopPropagation()}
></div>

<style>
	.pptx-svelte-inline-editor {
		position: absolute;
		box-sizing: border-box;
		padding: 2px;
		margin: 0;
		border: 1px solid var(--pptx-ring, #6366f1);
		background: var(--pptx-background, #ffffff);
		color: var(--pptx-foreground, #0f172a);
		outline: none;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		pointer-events: auto;
		z-index: 6;
	}
</style>
