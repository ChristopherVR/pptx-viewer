import type { InlineTextEditSnapshot } from 'pptx-viewer-shared';
import { useCallback, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export interface InlineEditingState {
	inlineEditingElementId: string | null;
	setInlineEditingElementId: Dispatch<SetStateAction<string | null>>;
	inlineEditingText: string;
	setInlineEditingText: (value: SetStateAction<string>, snapshot?: InlineTextEditSnapshot) => void;
	inlineEditingElementIdRef: MutableRefObject<string | null>;
	inlineEditingTextRef: MutableRefObject<string>;
	inlineEditingSnapshotRef: MutableRefObject<InlineTextEditSnapshot | undefined>;
}

/** Mirror live edits synchronously so pending Save sees the same draft as blur. */
export function useInlineEditingState(
	onTextChange: (elementId: string | null, text: string) => void,
): InlineEditingState {
	const inlineEditingElementIdRef = useRef<string | null>(null);
	const inlineEditingTextRef = useRef('');
	const inlineEditingSnapshotRef = useRef<InlineTextEditSnapshot | undefined>(undefined);
	// eslint-disable-next-line react/hook-use-state -- setters also update synchronous refs
	const [inlineEditingElementId, setElementId] = useState<string | null>(null);
	// eslint-disable-next-line react/hook-use-state -- setters also update synchronous refs
	const [inlineEditingText, setText] = useState('');
	const setInlineEditingElementId: InlineEditingState['setInlineEditingElementId'] = useCallback(
		(value) => {
			const resolved =
				typeof value === 'function' ? value(inlineEditingElementIdRef.current) : value;
			if (resolved !== inlineEditingElementIdRef.current || resolved === null) {
				inlineEditingSnapshotRef.current = undefined;
			}
			inlineEditingElementIdRef.current = resolved;
			setElementId(resolved);
		},
		[],
	);
	const setInlineEditingText: InlineEditingState['setInlineEditingText'] = useCallback(
		(value, snapshot) => {
			const resolved = typeof value === 'function' ? value(inlineEditingTextRef.current) : value;
			inlineEditingSnapshotRef.current =
				snapshot?.elementId === inlineEditingElementIdRef.current && snapshot.text === resolved
					? snapshot
					: undefined;
			inlineEditingTextRef.current = resolved;
			setText(resolved);
			onTextChange(inlineEditingElementIdRef.current, resolved);
		},
		[onTextChange],
	);
	return {
		inlineEditingElementId,
		setInlineEditingElementId,
		inlineEditingText,
		setInlineEditingText,
		inlineEditingElementIdRef,
		inlineEditingTextRef,
		inlineEditingSnapshotRef,
	};
}
