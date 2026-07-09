/**
 * viewer-compare.service.ts: Review > Compare flow. Picks a second `.pptx`,
 * diffs it against the current deck (shared `compareSlides`), and applies
 * accepted diffs through the editor. Open-state and the diff result live in
 * {@link ViewerDialogsService} so the compare panel renders from the shared
 * dialog host.
 *
 * Provide on the viewer component alongside {@link ViewerDialogsService}.
 */

import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PptxHandler } from 'pptx-viewer-core';

import { compareSlides } from '../internal/shared';
import type { SlideDiff } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { ViewerDialogsService } from './viewer-dialogs.service';
import { applyAcceptedDiff } from './viewer-extra-dialogs-helpers';

@Injectable()
export class ViewerCompareService {
	private readonly svc = inject(ViewerDialogsService);
	private readonly editor = inject(EditorStateService);
	private readonly translate = inject(TranslateService);

	/**
	 * Open a `.pptx` picker and diff it against the current deck, opening the
	 * compare panel with the result. Invoked from the ribbon.
	 */
	startCompare(): void {
		if (typeof document === 'undefined') {
			return;
		}
		const input = document.createElement('input');
		input.type = 'file';
		input.accept =
			'.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';
		input.addEventListener('change', () => {
			const file = input.files?.[0];
			if (file) {
				void this.runCompare(file);
			}
		});
		input.click();
	}

	/** Parse the chosen file and compute the slide-level diff. */
	private async runCompare(file: File): Promise<void> {
		try {
			const buffer = await file.arrayBuffer();
			const handler = new PptxHandler();
			const parsed = await handler.load(buffer);
			const result = compareSlides([...this.editor.slides()], [...parsed.slides]);
			this.svc.compareResult.set(result);
			this.svc.showCompare.set(true);
		} catch {
			this.svc.compareResult.set(null);
		}
	}

	/** Accept a single slide diff, adopting the incoming slide. */
	acceptSlide(diffIndex: number): void {
		const diff = this.diffAt(diffIndex);
		if (diff) {
			this.editor.applyReplacement(
				applyAcceptedDiff(this.editor.slides(), diff),
				this.translate.instant('pptx.undoAction.acceptSlideChange'),
			);
		}
	}

	/** Reject a diff: keep the current slide (no deck change). */
	rejectSlide(_diffIndex: number): void {
		// The compare panel tracks the rejected state locally; nothing to apply.
	}

	/** Accept every non-trivial diff at once. */
	acceptAll(): void {
		const result = this.svc.compareResult();
		if (!result) {
			return;
		}
		let slides = [...this.editor.slides()];
		for (const diff of result.diffs) {
			if (diff.status !== 'unchanged') {
				slides = applyAcceptedDiff(slides, diff);
			}
		}
		this.editor.applyReplacement(
			slides,
			this.translate.instant('pptx.undoAction.acceptAllSlideChanges'),
		);
	}

	private diffAt(index: number): SlideDiff | undefined {
		return this.svc.compareResult()?.diffs[index];
	}
}
