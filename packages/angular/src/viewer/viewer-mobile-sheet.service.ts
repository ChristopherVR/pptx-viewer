/**
 * viewer-mobile-sheet.service.ts: Viewer-scoped state for the mobile-only
 * chrome: which bottom-sheet ('slides' | 'menu') is open, the speaker-notes
 * strip visibility + its swipe-to-dismiss drag, and the mobile "Insert" quick
 * action (drop a text box on the active slide).
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the
 * accessors it alone owns (canEdit / slide count / active-slide-index) via
 * {@link bind}; the template reads the signals / invokes the handlers off the
 * injected instance directly (same pattern as `session`/`xport`).
 *
 * Provide it once on the viewer component (`providers: [ViewerMobileSheetService]`).
 */

import { inject, Injectable, signal } from '@angular/core';

import { newTextElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { createSwipeDismissDrag } from './swipe-dismiss';

/** Live host accessors the mobile-insert action needs. */
interface MobileSheetHost {
	readonly canEdit: () => boolean;
	readonly slideCount: () => number;
	readonly activeSlideIndex: () => number;
}

@Injectable()
export class ViewerMobileSheetService {
	private readonly editor = inject(EditorStateService);

	/** Open mobile bottom-sheet (slides / menu), or null. */
	readonly mobileSheet = signal<'slides' | 'menu' | null>(null);
	/** Speaker-notes strip visibility. */
	readonly showNotes = signal(false);
	/**
	 * Swipe-to-dismiss drag for the notes sheet. The sheet stays in normal flow
	 * (see template/CSS notes), so the drag gesture is wired here rather than
	 * via a fixed-overlay dismiss.
	 */
	readonly notesDrag = createSwipeDismissDrag(() => this.showNotes.set(false));

	private host: MobileSheetHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: MobileSheetHost): void {
		this.host = host;
	}

	private requireHost(): MobileSheetHost {
		if (!this.host) {
			throw new Error('ViewerMobileSheetService.bind() was not called');
		}
		return this.host;
	}

	/** Toggle the speaker-notes strip. */
	toggleNotes(): void {
		this.showNotes.update((v) => !v);
	}

	/**
	 * Mobile quick-insert: drop a text box on the active slide. Mirrors React's
	 * mobile bottom-bar "Insert" slot (a text box is the most common starter
	 * element on a phone; the full Insert section lives in the top-bar menu).
	 */
	onMobileInsert(): void {
		const host = this.requireHost();
		if (!host.canEdit() || host.slideCount() === 0) {
			return;
		}
		// Close any open mobile sheet so the new element is visible on the canvas.
		this.mobileSheet.set(null);
		this.editor.addElement(host.activeSlideIndex(), newTextElement());
	}
}
