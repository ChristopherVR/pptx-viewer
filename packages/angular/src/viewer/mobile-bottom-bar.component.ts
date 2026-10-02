/**
 * mobile-bottom-bar.component.ts: Persistent mobile bottom action bar.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileBottomBar.tsx
 *
 * A fixed-to-bottom bar exposing the five primary per-selection / per-slide
 * actions for mobile editing, mirroring React's slot set:
 *
 *   Slides · Insert · Format · Comments · Notes
 *
 * Each slot either opens a bottom sheet/panel (slides / format / comments /
 * notes) or triggers an action (insert). The Menu, Undo/Redo and Present
 * controls live in the compact top toolbar (`MobileToolbarComponent`).
 *
 * A thin adapter around the shared `pptx-ui-mobile-bar`, which owns the
 * `<nav aria-label="Editor actions">` (the framework-neutral accessibility
 * contract the e2e specs assert against), the no-slides gating from shared's
 * `buildBarActions`, the pressed state and the comment badge. This maps the
 * inputs onto its state and re-emits its typed intents as the outputs the
 * viewer already wires.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import type {
	MobileBarIntent,
	MobileBarRequestEvent,
	MobileBarViewState,
} from '../internal/shared';
import { translationsSignal } from './translations-signal';

/** Which mobile sheet/panel is currently active (highlights its button). */
export type MobileBarSheet = 'slides' | 'inspector' | 'comments' | 'notes' | null;

@Component({
	selector: 'pptx-mobile-bottom-bar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-mobile-bar [state]="view()" (mobile-bar-request)="request($event)" />`,
	styles: [':host { display: block; }'],
})
export class MobileBottomBarComponent {
	// ── Inputs ────────────────────────────────────────────────────────────────

	/** Total slides; every slot disables at 0. */
	readonly slideCount = input<number>(0);
	/** Comments on the active slide, rendered as a badge (capped at 99+). */
	readonly commentCount = input<number>(0);
	/** The sheet that is currently open; its slot renders active. */
	readonly activeSheet = input<MobileBarSheet>(null);

	// ── Outputs ───────────────────────────────────────────────────────────────

	/** User tapped the Slides button. */
	readonly openSlides = output<void>();
	/** User tapped Insert (quick-inserts a text box). */
	readonly insert = output<void>();
	/** User tapped the Format (inspector) button. */
	readonly openFormat = output<void>();
	/** User tapped the Comments button. */
	readonly openComments = output<void>();
	/** User tapped the Notes button. */
	readonly notes = output<void>();

	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	private readonly emitters: Record<MobileBarIntent['id'], () => void> = {
		slides: () => this.openSlides.emit(),
		insert: () => this.insert.emit(),
		inspector: () => this.openFormat.emit(),
		comments: () => this.openComments.emit(),
		notes: () => this.notes.emit(),
	};

	protected readonly view = computed<MobileBarViewState>(() => {
		this.translations();
		return {
			slideCount: this.slideCount(),
			activeSheet: this.activeSheet(),
			commentCount: this.commentCount(),
			translate: (key, params) => this.translate.instant(key, params),
		};
	});

	protected request(event: Event): void {
		this.emitters[(event as MobileBarRequestEvent).detail.id]();
	}
}
