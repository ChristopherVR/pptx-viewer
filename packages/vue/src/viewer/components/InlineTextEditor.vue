<script setup lang="ts">
/**
 * InlineTextEditor — a `contentEditable` overlay for editing an element's text
 * in place (Vue port of the React `elements/InlineTextEditor.tsx`).
 *
 * It is mounted inside the scaled slide stage (same coordinate space as
 * {@link SelectionOverlay}), positioned over the element's box, and seeded once
 * from the element's plain text. It does NOT re-bind its value while the user
 * types — the DOM owns the text during an edit — and only reports changes via
 * `change`, committing on blur (`commit`) or cancelling on Escape (`cancel`).
 * The host commits the typed text back onto the element's rich `textSegments`
 * (via `remapTextToSegments`) so per-run styling is preserved.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed, onMounted, ref } from 'vue';

const props = withDefaults(
	defineProps<{
		element: PptxElement;
		/** Draw the browser's native red spell-check squiggles while editing (View ▸ Spell). */
		spellCheck?: boolean;
	}>(),
	{ spellCheck: true },
);

const emit = defineEmits<{
	change: [text: string];
	commit: [];
	cancel: [];
}>();

const editorRef = ref<HTMLDivElement | null>(null);

/** The element's current plain text (seed value). */
function seedText(): string {
	return (props.element as { text?: string }).text ?? '';
}

/** Read the live text out of the contentEditable node. */
function extractText(): string {
	return editorRef.value?.innerText ?? '';
}

const editorStyle = computed<CSSProperties>(() => {
	const el = props.element;
	const style = (el as { textStyle?: Record<string, unknown> }).textStyle ?? {};
	const fontSize = typeof style.fontSize === 'number' ? `${style.fontSize}px` : undefined;
	const align =
		typeof style.align === 'string' ? (style.align as CSSProperties['textAlign']) : undefined;
	return {
		position: 'absolute',
		left: `${el.x}px`,
		top: `${el.y}px`,
		width: `${el.width}px`,
		height: `${el.height}px`,
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'center',
		boxSizing: 'border-box',
		padding: '2px 4px',
		margin: 0,
		outline: '2px solid var(--pptx-vue-selection-color, #3b82f6)',
		background: 'rgba(255, 255, 255, 0.92)',
		color: typeof style.color === 'string' ? (style.color as string) : '#111827',
		fontFamily: typeof style.fontFamily === 'string' ? (style.fontFamily as string) : 'inherit',
		fontSize: fontSize ?? 'inherit',
		fontWeight: style.bold ? 700 : 'normal',
		fontStyle: style.italic ? 'italic' : 'normal',
		textAlign: align ?? 'left',
		overflow: 'hidden',
		whiteSpace: 'pre-wrap',
		cursor: 'text',
		zIndex: 60,
	};
});

onMounted(() => {
	const node = editorRef.value;
	if (!node) {
		return;
	}
	node.innerText = seedText();
	node.focus();
	// Place the caret at the end of the seeded text.
	const range = document.createRange();
	range.selectNodeContents(node);
	range.collapse(false);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
});

function onInput(): void {
	emit('change', extractText());
}

function onBlur(): void {
	emit('change', extractText());
	emit('commit');
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		event.preventDefault();
		emit('cancel');
	}
}
</script>

<template>
	<div
		ref="editorRef"
		class="pptx-vue-inline-editor"
		data-inline-editor
		contenteditable="true"
		:spellcheck="props.spellCheck"
		role="textbox"
		aria-label="Edit text"
		:style="editorStyle"
		@input="onInput"
		@blur="onBlur"
		@keydown="onKeydown"
		@pointerdown.stop
	/>
</template>
