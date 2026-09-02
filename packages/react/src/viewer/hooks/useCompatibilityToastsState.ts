import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { useCallback, useState } from 'react';

/**
 * useCompatibilityToastsState: the load-diagnostic toast stack for
 * `getCompatibilityWarnings()`-shaped deck/slide warnings.
 *
 * `setToasts` is threaded into `useLoadContent` exactly like every other
 * per-load setter: each load overwrites the array wholesale, which is also
 * how dismissal state naturally resets on the next load without a separate
 * reset effect (a fresh empty or non-empty array replaces whatever was
 * dismissed from the previous deck).
 */
export function useCompatibilityToastsState() {
	const [toasts, setToasts] = useState<CompatibilityWarningToast[]>([]);

	const dismiss = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	const dismissAll = useCallback(() => {
		setToasts([]);
	}, []);

	return { toasts, setToasts, dismiss, dismissAll };
}

export type UseCompatibilityToastsStateResult = ReturnType<typeof useCompatibilityToastsState>;
