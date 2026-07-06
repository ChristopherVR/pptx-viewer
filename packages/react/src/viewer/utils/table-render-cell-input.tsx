import React, { useRef, useEffect } from 'react';

/**
 * Inline cell text editor used when a table cell enters editing mode.
 */
export function TableCellInput({
	initialText,
	style,
	onCommit,
	onCancel,
}: {
	initialText: string;
	style?: React.CSSProperties;
	onCommit: (text: string) => void;
	onCancel: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const committedRef = useRef(false);
	const onCommitRef = useRef(onCommit);
	onCommitRef.current = onCommit;

	useEffect(() => {
		// Auto-focus and select all text when entering edit mode
		const el = inputRef.current;
		if (el) {
			el.focus();
			el.select();
		}
	}, []);

	// Commit on unmount: on mobile, tapping away deselects the element and
	// unmounts this input before the browser fires blur (React does not
	// synthesise blur on unmount). Guard with committedRef so we never
	// double-commit when blur fires normally before unmount.
	useEffect(() => {
		const input = inputRef.current;
		return () => {
			if (!committedRef.current && input) {
				onCommitRef.current(input.value);
			}
		};
	}, []);

	const doCommit = (text: string) => {
		if (committedRef.current) {
			return;
		}
		committedRef.current = true;
		onCommit(text);
	};

	const doCancel = () => {
		committedRef.current = true;
		onCancel();
	};

	return (
		<input
			ref={inputRef}
			type='text'
			defaultValue={initialText}
			className='w-full bg-transparent outline-none'
			style={{
				...style,
				padding: 0,
				margin: 0,
				border: 'none',
			}}
			// Touch surfaces drive canvas drag/marquee through onPointerDown (see
			// useCanvasEventHandlers.handleStagePointerDown). Without stopping it
			// here, tapping inside the cell editor to reposition the caret would
			// bubble to the stage, steal pointer capture, and blur the input,
			// committing/discarding the cell before the edit is kept. This mirrors
			// the guard in InlineTextEditor.
			onPointerDown={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			onBlur={(e) => doCommit(e.currentTarget.value)}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === 'Escape') {
					e.preventDefault();
					doCancel();
				} else if (e.key === 'Enter') {
					e.preventDefault();
					doCommit(e.currentTarget.value);
				} else if (e.key === 'Tab') {
					e.preventDefault();
					doCommit(e.currentTarget.value);
				}
			}}
		/>
	);
}
