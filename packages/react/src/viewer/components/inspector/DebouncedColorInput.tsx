import React, { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// DebouncedColorInput
// ---------------------------------------------------------------------------
// A colour-picker that commits live as the user moves through the picker, so
// the canvas reflects fill / stroke / text-colour changes immediately. A local
// state mirror keeps the swatch responsive; undo grouping is handled downstream
// in useEditorHistory (snapshots are diffed and gated by pointer interaction),
// so live commits do not flood the undo stack.
// ---------------------------------------------------------------------------

interface DebouncedColorInputProps {
	value: string;
	disabled?: boolean;
	className?: string;
	/** Accessible label for the colour control (defaults to "Color"). */
	ariaLabel?: string;
	onCommit: (hex: string) => void;
}

export function DebouncedColorInput({
	value,
	disabled,
	className,
	ariaLabel,
	onCommit,
}: DebouncedColorInputProps): React.ReactElement {
	const [local, setLocal] = useState(value);
	const commitRef = useRef(onCommit);
	commitRef.current = onCommit;

	// Sync external value when the selected element changes
	useEffect(() => {
		setLocal(value);
	}, [value]);

	// Commit live on every change so the canvas updates immediately, while
	// mirroring the value locally to keep the picker swatch responsive.
	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const next = e.target.value;
		setLocal(next);
		commitRef.current(next);
	}, []);

	return (
		<input
			type='color'
			aria-label={ariaLabel ?? 'Color'}
			disabled={disabled}
			value={local}
			className={className}
			onChange={handleChange}
		/>
	);
}
