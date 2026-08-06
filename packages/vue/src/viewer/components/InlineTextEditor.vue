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
import { placeCaretAtEnd } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
	/** Ctrl/Cmd+B/I/U formatting toggle while editing (parity with React). */
	format: [updates: Partial<TextStyle>];
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
	// Place the caret at the end of the seeded text (shared contract helper).
	placeCaretAtEnd(node);
});

function onInput(): void {
	emit('change', extractText());
}

function onBlur(): void {
	emit('change', extractText());
	emit('commit');
}

/** The style the B/I/U toggles read their current state from. */
function currentTextStyle(): TextStyle | undefined {
	const el = props.element as {
		textSegments?: Array<{ style?: TextStyle }>;
		textStyle?: TextStyle;
	};
	return el.textSegments?.[0]?.style ?? el.textStyle;
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
	trimRange.deleteContents();
}

function onKeydown(event: KeyboardEvent): void {
	// Inline formatting shortcuts (Ctrl/Cmd + B/I/U), matching the React editor.
	if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
		const key = event.key.toLowerCase();
		if (key === 'b' || key === 'i' || key === 'u') {
			event.preventDefault();
			event.stopPropagation();
			const ts = currentTextStyle();
			if (key === 'b') {
				emit('format', { bold: !ts?.bold });
			} else if (key === 'i') {
				emit('format', { italic: !ts?.italic });
			} else {
				emit('format', { underline: !ts?.underline });
			}
			return;
		}
	}
	if (event.key === 'Escape') {
		event.preventDefault();
		emit('cancel');
		return;
	}
	if (event.key === 'Enter') {
		trimTrailingSpaceBeforeCaret();
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
		:aria-label="t('pptx.inlineEditor.editText')"
		:style="editorStyle"
		@input="onInput"
		@blur="onBlur"
		@keydown="onKeydown"
		@pointerdown.stop
	/>
</template>
