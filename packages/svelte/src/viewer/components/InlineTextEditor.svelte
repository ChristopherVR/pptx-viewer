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
 import { attachInlineListController, buildInlineTextCommitPatch, createInlineListSeed, createInlineListModelObserver, initializeInlineListDom, inlineListBodyText, readListActivationSelection, restoreInlineListBodySelection, placeCaretAtEnd } from 'pptx-viewer-shared';
	import type { InlineListController, InlineTextEditSnapshot } from 'pptx-viewer-shared';
	import { onDestroy, onMount, untrack } from 'svelte';

	import { readEditableText, resolveInlineSurface } from '../editor/inline-text';
	import type { InlineTextEditorProps } from './props';
	import { getTextBlockStyle, styleToString } from '../style';

	const {
		element,
		box,
		scale,
		spellCheck = false,
		oninput,
		oncommit,
		onclose,
		onregister,
	}: InlineTextEditorProps = $props();

	const surface = $derived(resolveInlineSurface(element));
	// The surface is remounted per edit session (keyed on the element id), so the
	// element is stable for its lifetime: capture the seed text once.
	const initialText = untrack(() => resolveInlineSurface(element).text);
	let listSeed = $state.raw(untrack(() => createInlineListSeed($state.snapshot(element))));
	let listController: InlineListController | undefined;
	const readSnapshot = (): InlineTextEditSnapshot | undefined => {
		const read = listController?.read();
		return read?.kind === 'supported' ? read.snapshot : undefined;
	};

	// eslint-disable-next-line no-unassigned-vars
	let el: HTMLDivElement | undefined;
	let closed = false;
	let modelObserver = untrack(() => createInlineListModelObserver($state.snapshot(element)));
	$effect(() => {
		JSON.stringify(element);
		untrack(() => {
			if (listController) { listController.read(); return; }
			if (!el || closed || listSeed) {
				return;
			}
			const seed = createInlineListSeed($state.snapshot(element));
			const body = 'textSegments' in element ? inlineListBodyText(element.textSegments) : '';
			if (!seed) {
				return;
			}
			if (readEditableText(el) !== body) { close(null); return; }
			const selection = readListActivationSelection(el, body);
			el.replaceChildren();
			listSeed = seed;
			modelObserver = createInlineListModelObserver($state.snapshot(element));
			mountList();
			if (selection) {
				restoreInlineListBodySelection(seed, el, selection);
			}
		});
	});

	const style = $derived(
		listSeed ? styleToString({ ...getTextBlockStyle(element), textDecoration: 'none', textDecorationLine: 'none', left: `${box.x * scale}px`, top: `${box.y * scale}px`, width: `${box.width}px`, minHeight: `${box.height}px`, transform: `scale(${scale})`, transformOrigin: 'top left' })
		: `left:${box.x * scale}px;top:${box.y * scale}px;width:${box.width * scale}px;min-height:${box.height * scale}px;${typeof surface.fontSize === 'number' ? `font-size:${surface.fontSize * scale}px;` : ''}${surface.fontFamily !== undefined ? `font-family:${surface.fontFamily};` : ''}`,
	);

	function close(commitText: string | null): void {
		if (closed) {
			return;
		}
		const snapshot = commitText === null ? undefined : readSnapshot();
		if (commitText !== null && snapshot) {
			commitText = snapshot.text;
		}
		closed = true;
		if (commitText !== null && (snapshot ? buildInlineTextCommitPatch(element, commitText, snapshot) : commitText !== initialText)) {
			oncommit(commitText, snapshot);
		}
		listController?.dispose();
		onregister?.(undefined);
		onclose();
	}

	// Every keystroke is mirrored out for the collaboration live preview; the
	// editor itself stays uncontrolled and only commits on blur/Escape.
	function onInput(): void {
		if (listController) {
			return;
		}
		if (el) {
			oninput?.(readEditableText(el));
		}
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

	function mountList(): void {
			if (el && listSeed && initializeInlineListDom(el, listSeed)) {
			const root = el;
			const native = attachInlineListController(root, listSeed, {
				isCurrent: () => !closed && el === root,
				onRead: (read) => oninput?.(read.kind === 'supported' ? read.snapshot.text : read.text, read.kind === 'supported' ? read.snapshot : undefined),
			});
			listController = {
				...native,
				read() {
					const read = native.read();
					const change = modelObserver.check($state.snapshot(element), read);
					if (change.kind === 'retire') { close(null); return { kind: 'unsupported', reason: 'model-replaced', text: read.kind === 'supported' ? read.snapshot.text : read.text }; }
					if (change.kind === 'format') {
						const formatted = native.format(change.snapshot);
						if (formatted.kind !== 'supported') {
							close(null);
						}
						return formatted;
					}
					return read;
				},
				format(snapshot) {
					const formatted = native.format($state.snapshot(snapshot));
					if (formatted.kind === 'supported') {
						modelObserver.expect(snapshot);
					}
					return formatted;
				},
			};
			onregister?.(listController, () => close(null));
		}
	}

	onMount(() => {
		if (el) {
			if (listSeed) {
				mountList();
			} else {
				el.textContent = initialText;
			}
			el.focus();
			// Caret at the END of the seeded text so typing appends (the contract
			// the other bindings follow; focus alone leaves the caret at the start).
			placeCaretAtEnd(el);
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
	data-inline-editor
	style={style}
	contenteditable="true"
	spellcheck={spellCheck}
	role="textbox"
	tabindex="0"
	aria-multiline="true"
	aria-label="edit text"
	oninput={onInput}
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
