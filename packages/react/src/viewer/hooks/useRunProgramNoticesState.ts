import type { RunProgramNotice } from 'pptx-viewer-shared';
import { useCallback, useState } from 'react';

/**
 * useRunProgramNoticesState: the small toast stack for `ppaction://program`
 * ("Run program") clicks during a running show.
 *
 * Mirrors `useCompatibilityToastsState`: a plain array plus a `dismiss` for
 * one notice and a `dismissAll` to clear the stack. Unlike the compatibility
 * toasts (seeded once per load), a fresh notice is appended per click, so a
 * shape clicked twice shows two toasts (each carries its own `id` from
 * `buildRunProgramNotice`).
 */
export function useRunProgramNoticesState() {
	const [notices, setNotices] = useState<RunProgramNotice[]>([]);

	const addNotice = useCallback((notice: RunProgramNotice) => {
		setNotices((prev) => [...prev, notice]);
	}, []);

	const dismiss = useCallback((id: string) => {
		setNotices((prev) => prev.filter((notice) => notice.id !== id));
	}, []);

	const dismissAll = useCallback(() => {
		setNotices([]);
	}, []);

	return { notices, addNotice, dismiss, dismissAll };
}

export type UseRunProgramNoticesStateResult = ReturnType<typeof useRunProgramNoticesState>;
