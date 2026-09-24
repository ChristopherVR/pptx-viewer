<script setup lang="ts">
/**
 * InlineTextEditor: a `contentEditable` overlay for editing an element's text
 * in place (Vue port of the React `elements/InlineTextEditor.tsx`).
 *
 * It is mounted inside the scaled slide stage (same coordinate space as
 * {@link SelectionOverlay}), positioned over the element's box, and seeded once
 * from the element's plain text. It does NOT re-bind its value while the user
 * types (the DOM owns the text during an edit) and only reports changes via
 * `change`, committing on blur (`commit`) or cancelling on Escape (`cancel`).
 * The host commits the typed text back onto the element's rich `textSegments`
 * (via `remapTextToSegments`) so per-run styling is preserved.
 */
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import {
	attachCollaborationInlineEditor,
	attachInlineListController,
	createInlineListSeed,
	initializeInlineListDom,
	inlineListBodyText,
	mapInlineTextFormatKey,
	placeCaretAtEnd,
	readEditableText,
	readListActivationSelection,
	restoreInlineListBodySelection,
} from 'pptx-viewer-shared';
import type {
	CollaborationInlineEditor,
	CollaborationLivePatcher,
	InlineListController,
	InlineTextEditSnapshot,
} from 'pptx-viewer-shared';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { inlineEditorStyle } from './inline-editor-style';

const { t } = useI18n();

const props = withDefaults(
	defineProps<{
		element: PptxElement;
		livePatcher?: CollaborationLivePatcher;
		slideId?: string;
		/** Draw the browser's native red spell-check squiggles while editing (View ▸ Spell). */
		spellCheck?: boolean;
	}>(),
	{ spellCheck: true },
);

const emit = defineEmits<{
	change: [text: string, snapshot?: InlineTextEditSnapshot];
	commit: [];
	cancel: [];
	/** Ctrl/Cmd+B/I/U formatting toggle while editing (parity with React). */
	format: [updates: Partial<TextStyle>];
	listSession: [event: { controller: InlineListController; active: boolean }];
}>();

const editorRef = ref<HTMLDivElement | null>(null);
const listSeed = shallowRef(createInlineListSeed(toRaw(props.element)));
let listController: InlineListController | undefined;
let connected: CollaborationInlineEditor | undefined;
let disposed = false;
let activatingList = false;
watch(
	() => props.element,
	async (element) => {
		if (connected) {
			connected.checkModel(toRaw(element));
			return;
		}
		if (listSeed.value) {
			return;
		}
		const seed = createInlineListSeed(toRaw(element));
		if (!seed) {
			return;
		}
		const body = inlineListBodyText('textSegments' in element ? element.textSegments : undefined);
		if (editorRef.value && readEditableText(editorRef.value) !== body) {
			disposed = true;
			emit('cancel');
			return;
		}
		const selection = editorRef.value
			? readListActivationSelection(
					editorRef.value,
					inlineListBodyText('textSegments' in element ? element.textSegments : undefined),
				)
			: undefined;
		activatingList = true;
		listSeed.value = seed;
		await nextTick();
		if (!disposed) {
			initializeEditor(selection);
		}
		activatingList = false;
	},
);

/** The element's current plain text (seed value). */
function seedText(): string {
	return (props.element as { text?: string }).text ?? '';
}

/** Read the live text out of the contentEditable node. */
function extractText(): string {
	return editorRef.value?.innerText ?? '';
}

const editorStyle = computed(() =>
	inlineEditorStyle(props.element, Boolean(listSeed.value || props.livePatcher?.isActive())),
);

function initializeEditor(selection?: { start: number; end: number }): void {
	const node = editorRef.value;
	if (!node) {
		return;
	}
	const seed = listSeed.value;
	if (props.livePatcher?.isActive()) {
		connected = attachCollaborationInlineEditor(node, toRaw(props.element), {
			patcher: props.livePatcher,
			slideId: props.slideId,
			onSnapshot: (snapshot) => emit('change', snapshot.text, snapshot),
			onCancel: () => {
				disposed = true;
				emit('cancel');
			},
		});
		if (!connected) {
			disposed = true;
			emit('cancel');
			return;
		}
		listController = connected;
		emit('listSession', { controller: connected, active: true });
	} else if (seed && initializeInlineListDom(node, seed)) {
		listController = attachInlineListController(node, seed, {
			isCurrent: () => !disposed && props.element.id === seed.elementId && editorRef.value === node,
			onRead: (result) =>
				emit(
					'change',
					result.kind === 'supported' ? result.snapshot.text : result.text,
					result.kind === 'supported' ? result.snapshot : undefined,
				),
		});
		emit('listSession', { controller: listController, active: true });
	} else {
		node.innerText = seedText();
	}
	node.focus();
	// Place the caret at the end of the seeded text (shared contract helper).
	placeCaretAtEnd(node);
	if (seed && selection) {
		restoreInlineListBodySelection(seed, node, selection);
	}
}
onMounted(() => initializeEditor());
onBeforeUnmount(() => {
	disposed = true;
	listController?.dispose();
	if (listController) {
		emit('listSession', { controller: listController, active: false });
	}
});

function onInput(): void {
	if (!listController) {
		emit('change', extractText());
	}
}

function onBlur(): void {
	if (activatingList) {
		return;
	}
	if (disposed) {
		return;
	}
	if (listController) {
		const result = listController.refresh();
		if (connected && result.kind !== 'supported') {
			return;
		}
	} else {
		emit('change', extractText());
	}
	emit('commit');
}

/** The style the B/I/U toggles read their current state from. */
function currentTextStyle(): TextStyle | undefined {
	const el = props.element as {
		textSegments?: Array<{ style?: TextStyle }>;
		textStyle?: TextStyle;
	};
	if (!listController) {
		return el.textSegments?.[0]?.style ?? el.textStyle;
	}
	const current = listController.readSelection();
	const style =
		current.kind === 'supported'
			? current.snapshot.textSegments?.[current.selection?.startSegIdx ?? 0]?.style
			: el.textSegments?.[0]?.style;
	return {
		...style,
		bold: style?.bold ?? el.textStyle?.bold,
		italic: style?.italic ?? el.textStyle?.italic,
		underline: style?.underline ?? el.textStyle?.underline,
	};
}

/**
 * When the caret sits at a soft word-wrap boundary (no explicit line break,
 * just CSS wrapping), the space separating the two words is still part of the
 * text and lands right before the caret. Pressing Enter there splits the DOM
 * at that exact position, leaving the new paragraph break preceded by a stray
 * space (mirrors the React inline editor's fix). Since a space immediately
 * before a paragraph break is never visually meaningful, drop it before the
 * browser performs its native Enter/paragraph-split.
 */
function trimTrailingSpaceBeforeCaret(): void {
	const selection = window.getSelection();
	if (!selection || !selection.isCollapsed || selection.rangeCount === 0) {
		return;
	}
	const range = selection.getRangeAt(0);
	const { startContainer, startOffset } = range;
	if (startContainer.nodeType !== Node.TEXT_NODE || startOffset === 0) {
		return;
	}
	const text = startContainer.textContent ?? '';
	if (text.charAt(startOffset - 1) !== ' ') {
		return;
	}
	const trimRange = document.createRange();
	trimRange.setStart(startContainer, startOffset - 1);
	trimRange.setEnd(startContainer, startOffset);
	if (connected) {
		connected.mutate(trimRange, () => trimRange.deleteContents());
	} else {
		trimRange.deleteContents();
	}
}

function onKeydown(event: KeyboardEvent): void {
	if (listController && event.isComposing) {
		return;
	}
	// Inline formatting shortcuts (Ctrl/Cmd + B/I/U): resolved by the shared
	// keymap so this three-way switch is not hand-derived a fourth time.
	const property = mapInlineTextFormatKey(event);
	if (property) {
		event.preventDefault();
		event.stopPropagation();
		const ts = currentTextStyle();
		emit('format', { [property]: !ts?.[property] });
		return;
	}
	if (event.key === 'Escape') {
		event.preventDefault();
		if (listController) {
			disposed = true;
			listController.dispose();
		}
		emit('cancel');
		return;
	}
	if (event.key === 'Enter' && (!listController || (connected && !listSeed.value))) {
		trimTrailingSpaceBeforeCaret();
	}
}
</script>

<template>
	<div
		:key="listSeed ? 'list' : 'plain'"
		ref="editorRef"
		class="pptx-vue-inline-editor"
		data-inline-editor
		contenteditable="true"
		:spellcheck="props.spellCheck"
		role="textbox"
		:aria-label="t('pptx.inlineEditor.editText')"
		:style="editorStyle"
		@input="onInput"
		@blur="onBlur"
		@keydown="onKeydown"
		@pointerdown.stop
	/>
</template>
