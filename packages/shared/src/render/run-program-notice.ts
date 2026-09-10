/**
 * run-program-notice.ts: turn a resolved `ppaction://program` command string
 * into the non-blocking notice a binding should show during a running show.
 *
 * PowerPoint's "Run program" action (`a:hlinkClick` -> `ppaction://program`,
 * `packages/shared/src/render/presentation-action.ts`'s `runProgram` intent)
 * names a free-text "Program to run:" command the author typed, e.g.
 * `notepad.exe C:\temp\notes.txt`. Path and arguments are ONE unstructured
 * string; OOXML has no separate arguments field, so this module does not try
 * to split one out.
 *
 * A browser cannot launch a local executable, so the honest behavior on
 * click is: show the presenter a small, dismissible notice naming the exact
 * command PowerPoint would have run, with a Copy button, rather than doing
 * nothing (silently) or blocking the show with a modal dialog.
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */

/** A run-program notice ready for a binding's toast/notice UI to render. */
export interface RunProgramNotice {
	/** Stable id for this invocation, so a binding can dedupe/key a toast list. */
	readonly id: string;
	/** The exact resolved command string (path plus whatever arguments the author typed). */
	readonly target: string;
	/** i18n key for the notice body. Interpolates `{{target}}`. */
	readonly messageKey: string;
	/** i18n key for the Copy button label. */
	readonly copyLabelKey: string;
}

let nextNoticeId = 0;

/**
 * Build a {@link RunProgramNotice} for the resolved run-program command
 * `target`. Each call gets a fresh `id` (a monotonically increasing counter
 * rather than a timestamp, so two notices for the same target in the same
 * millisecond still get distinct ids), so a binding can show a fresh toast
 * per click even when the same shape is clicked twice in a row.
 */
export function buildRunProgramNotice(target: string): RunProgramNotice {
	nextNoticeId += 1;
	return {
		id: `run-program-${nextNoticeId}`,
		target,
		messageKey: 'pptx.presentation.runProgramNotice',
		copyLabelKey: 'pptx.presentation.runProgramCopy',
	};
}
