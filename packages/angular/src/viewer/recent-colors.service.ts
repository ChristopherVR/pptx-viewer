/**
 * recent-colors.service.ts: viewer-scoped "Recent colours" state
 * (`p:clrMru` / `CT_ColorMRU`) behind every colour picker.
 *
 * Backed entirely by shared's pure `render/recent-colors.ts`
 * (`seedRecentColors`, `pushRecentColor`, `mruColorsPatch`): this service only
 * owns the reactive signal a picker reads and writes the resulting patch back
 * into the loaded deck. The write-back goes straight to
 * `LoadContentService.presentationProperties` rather than through
 * `EditorStateService`'s undo stack, the same "not an undoable edit" pattern
 * `PowerPointViewerComponent` already uses for the grid/snap/guides toggles:
 * which colours are "recent" is picker chrome, not a document edit a user
 * would expect Ctrl+Z to reverse.
 *
 * Provide it at the component level (`POWER_POINT_VIEWER_PROVIDERS`) so its
 * lifetime tracks the host viewer.
 *
 * @module viewer/recent-colors
 */
import { inject, Injectable, signal } from '@angular/core';
import type { PptxData } from 'pptx-viewer-core';

import { mruColorsPatch, pushRecentColor, seedRecentColors } from '../internal/shared';
import { LoadContentService } from './load-content.service';

@Injectable()
export class RecentColorsService {
	private readonly loader = inject(LoadContentService);

	/** Most-recently-used colours, most-recent-first, `#RRGGBB` uppercase. */
	readonly recent = signal<string[]>([]);

	/** Seed the row from the deck's own `p:clrMru`. Call once per load. */
	seed(data: Pick<PptxData, 'mruColors'> | undefined): void {
		this.recent.set(seedRecentColors(data ?? {}));
	}

	/**
	 * Record a newly-picked colour: moves it to the front of {@link recent},
	 * and writes it straight into the loaded deck's `presentationProperties`
	 * (`p:clrMru`), NOT through `EditorStateService`'s undo history: which
	 * colours are "recent" is picker chrome, not an undoable document edit
	 * (the same reasoning `PowerPointViewerComponent` already applies to the
	 * grid/snap/guides toggles).
	 */
	push(hex: string): void {
		const next = pushRecentColor(this.recent(), hex);
		this.recent.set(next);
		this.loader.presentationProperties.update((current) => ({
			...current,
			...mruColorsPatch(next),
		}));
	}
}
