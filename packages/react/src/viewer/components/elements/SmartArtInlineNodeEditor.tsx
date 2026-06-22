import type { InlineEditRect } from 'pptx-viewer-shared';
import React from 'react';

// ── Props ───────────────────────────────────────────────────────────────────

interface SmartArtInlineNodeEditorProps {
	/** Initial text shown when the editor opens. */
	initialText: string;
	/** Editor box, in coordinates relative to the SmartArt container. */
	rect: InlineEditRect;
	/** Commit the current value (Enter / blur / click-away). */
	onCommit: (text: string) => void;
	/** Discard the edit (Escape). */
	onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A small absolutely-positioned `<textarea>` overlaid on a single SmartArt node
 * for inline (on-canvas) text editing.
 *
 * Positioning is supplied by the caller (already projected into container-local
 * coordinates), so this component is layout-agnostic: it works for every
 * SmartArt layout. Enter commits, Shift+Enter inserts a newline, Escape
 * cancels, and blur commits (covering click-away).
 */
export function SmartArtInlineNodeEditor({
	initialText,
	rect,
	onCommit,
	onCancel,
}: SmartArtInlineNodeEditorProps): React.ReactElement {
	const ref = React.useRef<HTMLTextAreaElement | null>(null);
	const [value, setValue] = React.useState(initialText);
	// Guards against blur firing a second commit after Enter/Escape already ran.
	const settled = React.useRef(false);

	React.useEffect(() => {
		const el = ref.current;
		if (el) {
			el.focus();
			el.select();
		}
	}, []);

	const commit = (): void => {
		if (settled.current) {
			return;
		}
		settled.current = true;
		onCommit(value);
	};

	const cancel = (): void => {
		if (settled.current) {
			return;
		}
		settled.current = true;
		onCancel();
	};

	return (
		<textarea
			ref={ref}
			value={value}
			aria-label='Edit SmartArt node text'
			spellCheck={false}
			className='absolute z-20 resize-none rounded-sm border border-primary bg-white/95 text-center text-[12px] leading-tight text-black shadow outline-none'
			style={{
				left: rect.left,
				top: rect.top,
				width: rect.width,
				height: rect.height,
			}}
			onChange={(e) => setValue(e.target.value)}
			// Stop canvas-level selection / drag handlers from firing on the editor.
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					commit();
				} else if (e.key === 'Escape') {
					e.preventDefault();
					cancel();
				}
				// Keep keystrokes from bubbling to canvas keyboard shortcuts.
				e.stopPropagation();
			}}
		/>
	);
}
