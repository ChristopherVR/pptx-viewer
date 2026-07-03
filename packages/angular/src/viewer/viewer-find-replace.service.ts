/**
 * viewer-find-replace.service.ts: Viewer-scoped state + logic for the
 * find-in-slides bar and the edit-mode find-and-replace bar. Owns the two bar
 * visibility flags, the current match list, and the active-match cursor, and
 * runs the searches/replacements against the editable deck.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds a slide
 * navigation callback via {@link bind} (so a match can scroll its slide into
 * view) and the template reads the flags / invokes the handlers off the injected
 * instance.
 *
 * Provide it once on the viewer component (`providers: [ViewerFindReplaceService]`).
 */

import { inject, Injectable, signal } from '@angular/core';

import { EditorStateService } from './editor-state.service';
import type { FindEvent, ReplaceEvent } from './find-replace-bar.component';
import { findInSlides, replaceInSlides, replaceMatch } from './find-replace-helpers';
import type { FindResult } from './find-replace-helpers';

@Injectable()
export class ViewerFindReplaceService {
	private readonly editor = inject(EditorStateService);

	/** Find-in-slides bar visibility. */
	readonly showFind = signal(false);
	/** Find-and-replace bar visibility (edit mode only). */
	readonly showFindReplace = signal(false);
	readonly results = signal<readonly FindResult[]>([]);
	readonly activeIndex = signal(-1);
	private matchCase = false;

	/** Navigate the viewer to a slide index (bound from the host component). */
	private goTo: (index: number) => void = () => undefined;

	/** Wire the host's slide-navigation callback (called once from the constructor). */
	bind(goTo: (index: number) => void): void {
		this.goTo = goTo;
	}

	/** Open the find/replace bar (mutually exclusive with the find-only bar). */
	openFindReplace(): void {
		this.showFind.set(false);
		this.showFindReplace.set(true);
	}

	onFind(evt: FindEvent): void {
		this.matchCase = evt.matchCase;
		this.refreshResults(evt.query);
	}

	onNavigate(dir: 1 | -1): void {
		const results = this.results();
		if (results.length === 0) {
			return;
		}
		const next = (this.activeIndex() + dir + results.length) % results.length;
		this.activeIndex.set(next);
		this.goTo(results[next].slideIndex);
	}

	onReplaceOne(evt: ReplaceEvent): void {
		const results = this.results();
		const idx = this.activeIndex();
		if (idx < 0 || idx >= results.length) {
			return;
		}
		const updated = replaceMatch(this.editor.slides(), results, idx, evt.replacement);
		this.editor.applyReplacement(updated.slides, 'Replace');
		this.refreshResults(evt.query);
	}

	onReplaceAll(evt: ReplaceEvent): void {
		const updated = replaceInSlides(this.editor.slides(), evt.query, evt.replacement, {
			matchCase: this.matchCase,
		});
		if (updated.replacements > 0) {
			this.editor.applyReplacement(updated.slides, 'Replace all');
		}
		this.refreshResults(evt.query);
	}

	/** Re-run the search over the editable deck and refresh the match list. */
	private refreshResults(query: string): void {
		if (query.length === 0) {
			this.results.set([]);
			this.activeIndex.set(-1);
			return;
		}
		const results = findInSlides(this.editor.slides(), query, { matchCase: this.matchCase });
		this.results.set(results);
		this.activeIndex.set(results.length > 0 ? 0 : -1);
		if (results.length > 0) {
			this.goTo(results[0].slideIndex);
		}
	}
}
