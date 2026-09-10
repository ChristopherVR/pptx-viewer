import type { RunProgramNotice } from 'pptx-viewer-shared';
import { buildRunProgramNotice } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

/**
 * useRunProgramNotices: the non-blocking toast stack shown during a running
 * show when an on-slide Action Setting resolves to PowerPoint's "Run
 * program" (`ppaction://program`) verb. A browser cannot launch a local
 * executable, so `PresentationMode.vue`'s `runProgram` runner callback calls
 * `notify` instead, which turns the resolved command string into a
 * {@link RunProgramNotice} (via the shared `buildRunProgramNotice`) and adds
 * it to this stack.
 *
 * Mirrors `useCompatibilityToasts.ts`'s shape (a small ref-backed list plus a
 * per-id dismiss), split into its own file because `PresentationMode.vue` is
 * already well past the repo's ~300 LOC convention.
 */
export interface UseRunProgramNoticesResult {
	notices: Ref<RunProgramNotice[]>;
	/** Resolve `target` into a fresh notice and add it to the stack. */
	notify: (target: string) => void;
	dismiss: (id: string) => void;
}

export function useRunProgramNotices(): UseRunProgramNoticesResult {
	const notices = ref<RunProgramNotice[]>([]);

	function notify(target: string): void {
		notices.value = [...notices.value, buildRunProgramNotice(target)];
	}

	function dismiss(id: string): void {
		notices.value = notices.value.filter((notice) => notice.id !== id);
	}

	return { notices, notify, dismiss };
}
