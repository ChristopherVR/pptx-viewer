/**
 * load-notices.service.ts: Load-time viewer notices, Angular binding.
 *
 * Two independent decisions read straight off the loaded deck's `PptxData`:
 * - The read-only recommendation (`p:modifyVerifier` / "Mark as Final"):
 *   whether editing should default to locked, and the banner shown for it.
 *   Shared: `read-only-recommendation.ts` (`readOnlyRecommendation`).
 * - The compatibility-warning toast list: `data.warnings` plus every slide's
 *   own `warnings`, deduped by code. Shared: `compatibility-warning-toasts.ts`
 *   (`compatibilityWarningToasts`).
 *
 * Both reset on every load (see {@link resetForLoad}, called from the
 * viewer's load-reset effect) and both keep `PowerPointViewerComponent` from
 * growing for a per-load notice, mirroring `ViewerDialogsService`.
 *
 * @module viewer/load-notices
 */
import { Injectable, computed, inject, signal } from '@angular/core';

import { compatibilityWarningToasts, readOnlyRecommendation } from '../internal/shared';
import type { CompatibilityWarningToast, ReadOnlyRecommendation } from '../internal/shared';
import { LoadContentService } from './load-content.service';

@Injectable()
export class LoadNoticesService {
	/** Optional so isolated service tests and stubbed injectors keep working. */
	private readonly loader = inject(LoadContentService, { optional: true });

	// ── Read-only recommendation ────────────────────────────────────────────

	/** Whether the loaded deck recommends opening read-only, and why. */
	readonly recommendation = computed<ReadOnlyRecommendation>(() =>
		readOnlyRecommendation(this.loader?.parsedData()),
	);
	/** Whether the banner has been hidden ("Edit anyway" or "Dismiss") this load. */
	private readonly bannerHidden = signal(false);
	/** Whether "Edit anyway" has lifted the recommendation's editing lock this load. */
	private readonly lockLifted = signal(false);
	/** Whether the read-only banner should render. */
	readonly bannerActive = computed(
		() => this.recommendation().kind !== null && !this.bannerHidden(),
	);
	/**
	 * Whether the recommendation is still actively locking editing. Gates the
	 * host viewer's `canEdit`, the same way the Protected View lock does.
	 */
	readonly lockActive = computed(() => this.recommendation().defaultReadOnly && !this.lockLifted());

	/** "Edit anyway": lifts the recommendation's lock and hides the banner. */
	editAnyway(): void {
		this.lockLifted.set(true);
		this.bannerHidden.set(true);
	}

	/** "Dismiss": hides the banner but leaves any lock in place. */
	dismissBanner(): void {
		this.bannerHidden.set(true);
	}

	// ── Compatibility-warning toasts ────────────────────────────────────────

	/** Deck-level plus every slide's compatibility warnings, deduped by code. */
	readonly toasts = computed<CompatibilityWarningToast[]>(() => {
		const deckWarnings = this.loader?.parsedData()?.warnings ?? [];
		const slideWarnings = (this.loader?.slides() ?? []).flatMap((slide) => slide.warnings ?? []);
		return compatibilityWarningToasts([...deckWarnings, ...slideWarnings]);
	});
	private readonly dismissedToastIds = signal<ReadonlySet<string>>(new Set());
	/** {@link toasts} with per-toast / dismiss-all dismissals applied. */
	readonly visibleToasts = computed(() =>
		this.toasts().filter((toast) => !this.dismissedToastIds().has(toast.id)),
	);

	/** Dismiss one toast by id. */
	dismissToast(id: string): void {
		this.dismissedToastIds.update((ids) => new Set(ids).add(id));
	}

	/** Dismiss every currently-visible toast. */
	dismissAllToasts(): void {
		this.dismissedToastIds.set(new Set(this.toasts().map((toast) => toast.id)));
	}

	// ── Reset ────────────────────────────────────────────────────────────────

	/** Reset both notices' dismissed/lifted state for a newly loaded deck. */
	resetForLoad(): void {
		this.bannerHidden.set(false);
		this.lockLifted.set(false);
		this.dismissedToastIds.set(new Set());
	}
}
