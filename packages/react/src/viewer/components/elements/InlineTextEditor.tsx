import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';

import { DEFAULT_TEXT_COLOR } from '../../constants';
import { getTextCompensationTransform, getTextWarpStyle, renderTextSegments } from '../../utils';
import {
	getPendingSelectionRestore,
	restoreSegmentSelection,
} from '../../utils/inline-selection-utils';

/**
 * Rich inline text editor: uses a `contentEditable` div that renders the same
 * rich text segments as view mode so formatting (per-run fonts, sizes, colors,
 * bullets, paragraph indentation, text effects) is preserved while editing.
 *
 * The editor extracts plain text on commit via `innerText` and passes it to the
 * parent's `onEditChange` callback, which feeds into `remapTextToSegments` to
 * redistribute the edited text across the original rich segments.
 *
 * The outer wrapper matches the view-mode text container exactly:
 * - `getTextLayoutStyle` for flex vertical alignment, body-inset padding, columns
 * - `getTextStyleForElement` (textStyle) for element-level font defaults
 * - `getTextWarpStyle` for text warp 3D transforms
 * - `getTextCompensationTransform` for rotation compensation
 */
export function InlineTextEditor({
	initialText,
	spellCheck,
	rtl,
	textDirection: _textDirection,
	textStyle,
	textStyleRaw,
	layoutStyle,
	element,
	onCommit,
	onCancel,
	onEditChange,
	onFormatText,
}: {
	initialText: string;
	spellCheck: boolean;
	rtl?: boolean;
	textDirection?: TextStyle['textDirection'];
	textStyle: React.CSSProperties;
	/** Raw TextStyle object for computing warp transforms. */
	textStyleRaw?: TextStyle;
	/** Layout style from getTextLayoutStyle; provides flex vertical alignment. */
	layoutStyle: React.CSSProperties;
	element: PptxElement;
	onCommit: () => void;
	onCancel: () => void;
	onEditChange: (t: string) => void;
	/** Called when the user applies formatting via keyboard shortcut (Ctrl+B/I/U). */
	onFormatText?: (updates: Partial<TextStyle>) => void;
}) {
	const editorRef = useRef<HTMLDivElement>(null);

	// The editor is UNCONTROLLED: its content is seeded exactly once (below) and
	// the DOM owns the text from then on. `initialText` is updated by the parent
	// on every keystroke (via onEditChange), so if we rendered it as children
	// React would rewrite the text node on each change and the caret would jump
	// back to the start / typing would reverse. We therefore capture the seed
	// content on first render and never re-render it; live edits flow out through
	// handleInput, and the latest value is read from the DOM on commit/blur.
	const seedRef = useRef<{ initialText: string; hasRichSegments: boolean } | null>(null);
	if (seedRef.current === null) {
		seedRef.current = {
			initialText,
			hasRichSegments: Boolean(
				hasTextProperties(element) && element.textSegments && element.textSegments.length > 0,
			),
		};
	}
	const seed = seedRef.current;

	// Extract plain text from the contentEditable div
	const extractText = useCallback((): string => {
		const el = editorRef.current;
		if (!el) {
			return seed.initialText;
		}
		return el.innerText || '';
	}, [seed]);

	// Sync text to parent on every input via ref (no re-render)
	const handleInput = useCallback(() => {
		onEditChange(extractText());
	}, [extractText, onEditChange]);

	// When the caret sits at a soft word-wrap boundary (no explicit line break,
	// just CSS wrapping), the space that separates the two words is still part
	// of the text and lands right before the caret. Pressing Enter there splits
	// the DOM at that exact position, leaving the new paragraph break preceded
	// by a stray space: e.g. "fox jumps" wrapped as "fox " / "jumps" becomes
	// paragraphs "fox " and "jumps" instead of "fox" and "jumps". That extra,
	// invisible trailing character then counts toward the paragraph's measured
	// width, occasionally forcing an unwanted extra wrapped line. Since a space
	// immediately before a paragraph break is never visually meaningful, drop it
	// before the browser performs its native Enter/paragraph-split.
	const trimTrailingSpaceBeforeCaret = useCallback(() => {
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
	}, []);

	// Auto-focus on mount and place cursor at end
	useEffect(() => {
		const el = editorRef.current;
		if (!el) {
			return;
		}
		el.focus();
		// Place cursor at end of content
		const selection = window.getSelection();
		if (selection) {
			const range = document.createRange();
			range.selectNodeContents(el);
			range.collapse(false);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}, []);

	// After a formatting update, React re-renders the contentEditable children
	// which destroys the DOM selection. Restore it from the pending info.
	const mountedRef = useRef(false);
	useLayoutEffect(() => {
		// Skip the initial mount; cursor is already placed by the effect above.
		if (!mountedRef.current) {
			mountedRef.current = true;
			return;
		}
		const pending = getPendingSelectionRestore();
		if (!pending || !editorRef.current) {
			return;
		}
		restoreSegmentSelection(
			editorRef.current,
			pending.startSegIdx,
			pending.startOffset,
			pending.endSegIdx,
			pending.endOffset,
		);
	});

	// Build wrapper style matching view-mode exactly:
	// layoutStyle (flex alignment, vertical padding, columns) + textStyle (font defaults,
	// horizontal padding/insets) + warp transforms + compensation transform.
	//
	// View mode applies: getTextLayoutStyle + txtS + getTextWarpStyle + compensationTransform
	// We replicate that same order here.
	const warpStyle = getTextWarpStyle(textStyleRaw);

	// Merge the compensation transform with warp transform if both exist
	const compensationTransform = getTextCompensationTransform(element);
	const warpTransform = warpStyle?.transform;
	const mergedTransform =
		[compensationTransform, warpTransform].filter(Boolean).join(' ') || undefined;

	const wrapperStyle: React.CSSProperties = {
		...layoutStyle,
		...textStyle,
		...warpStyle,
		transform: mergedTransform,
		transformOrigin: warpStyle?.transformOrigin || 'center',
	};

	return (
		<div
			ref={editorRef}
			contentEditable
			suppressContentEditableWarning
			data-inline-editor
			spellCheck={spellCheck}
			dir={rtl ? 'rtl' : 'ltr'}
			className='relative z-10 w-full h-full whitespace-pre-wrap break-words leading-[1.3] outline-none'
			style={{
				...wrapperStyle,
				cursor: 'text',
				minHeight: '1em',
			}}
			// Touch surfaces drive canvas drag/marquee through onPointerDown (see
			// useCanvasEventHandlers.handleStagePointerDown). Without stopping it
			// here, tapping inside the editor to reposition the caret would bubble
			// to the stage and start dragging the element instead of editing.
			onPointerDown={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onInput={handleInput}
			onBlur={() => {
				onEditChange(extractText());
				onCommit();
			}}
			onKeyDown={(e) => {
				// Inline formatting shortcuts (Ctrl/Cmd + B/I/U)
				if ((e.ctrlKey || e.metaKey) && !e.shiftKey && onFormatText) {
					const key = e.key.toLowerCase();
					if (key === 'b' || key === 'i' || key === 'u') {
						e.preventDefault();
						e.stopPropagation();
						const seg = hasTextProperties(element) ? element.textSegments?.[0] : undefined;
						const ts = seg?.style ?? (hasTextProperties(element) ? element.textStyle : undefined);
						switch (key) {
							case 'b':
								onFormatText({ bold: !ts?.bold });
								break;
							case 'i':
								onFormatText({ italic: !ts?.italic });
								break;
							case 'u':
								onFormatText({ underline: !ts?.underline });
								break;
						}
						return;
					}
				}
				if (e.key === 'Escape') {
					e.preventDefault();
					onCancel();
					return;
				}
				if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
					e.preventDefault();
					onEditChange(extractText());
					onCommit();
					return;
				}
				if (e.key === 'Enter') {
					trimTrailingSpaceBeforeCaret();
				}
			}}
			// Prevent paste from inserting HTML: paste as plain text only
			onPaste={(e) => {
				e.preventDefault();
				const text = e.clipboardData.getData('text/plain');
				document.execCommand('insertText', false, text);
			}}
		>
			{seed.hasRichSegments ? renderTextSegments(element, DEFAULT_TEXT_COLOR) : seed.initialText}
		</div>
	);
}
