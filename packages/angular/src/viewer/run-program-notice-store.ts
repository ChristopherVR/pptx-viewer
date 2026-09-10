/**
 * run-program-notice-store.ts: the running show's stack of "Run program"
 * notices.
 *
 * PowerPoint's `ppaction://program` action ("Run program") cannot be launched
 * from a browser, so `PresentationInputController`'s `runProgram` callback
 * (see its own doc comment) hands the resolved command to {@link add} instead
 * of doing nothing. This is a plain signal-holding class, not an Angular
 * service, matching `PresentationShowNavigator` and
 * `PresentationInputController` themselves: `PresentationOverlayComponent`
 * instantiates it directly, so it needs no DI wiring and stays disposed with
 * the overlay.
 *
 * @module viewer/run-program-notice-store
 */
import { signal } from '@angular/core';

import { buildRunProgramNotice } from '../internal/shared';
import type { RunProgramNotice } from '../internal/shared';

export class RunProgramNoticeStore {
	/** Notices currently on screen, oldest first. */
	readonly notices = signal<readonly RunProgramNotice[]>([]);

	/**
	 * Build a fresh notice for `target` and append it. Every call adds a new
	 * notice (even for the same target clicked twice in a row): each click is
	 * its own event the presenter may want to copy independently.
	 */
	add(target: string): void {
		const notice = buildRunProgramNotice(target);
		this.notices.update((current) => [...current, notice]);
	}

	/** Dismiss one notice by id. */
	dismiss(id: string): void {
		this.notices.update((current) => current.filter((notice) => notice.id !== id));
	}
}
