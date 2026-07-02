/**
 * slide-diff-row.component.ts: one expandable slide-level diff row.
 *
 * Selector: `pptx-slide-diff-row`
 *
 * Angular port of the React `SlideDiffRow` (packages/react/src/viewer/
 * components/SlideDiffRow.tsx). Renders a single {@link SlideDiff} as a
 * collapsible card: a header with slide number, status pill, change count and
 * an accepted/rejected tag, plus an expandable body composing
 * {@link SlideDiffThumbnailsComponent} (side-by-side thumbnails),
 * {@link SlideDiffChangesComponent} (per-element change list), and accept/reject
 * controls. Renders nothing when the diff is `unchanged`. Pure label helpers
 * live in {@link ./slide-diff-helpers}.
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { CanvasSize, SlideDiff } from '../internal/shared';
import { SlideDiffChangesComponent } from './slide-diff-changes.component';
import { changeCountLabel, slideNumberOf, statusLabel } from './slide-diff-helpers';
import { SlideDiffThumbnailsComponent } from './slide-diff-thumbnails.component';

@Component({
	selector: 'pptx-slide-diff-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SlideDiffThumbnailsComponent, SlideDiffChangesComponent, TranslatePipe],
	template: `
		@if (diff().status !== 'unchanged') {
			<div class="pptx-ng-diff-row" [class.is-resolved]="isResolved()">
				<!-- Header (toggles expand) -->
				<button type="button" class="pptx-ng-diff-head" (click)="toggle()">
					<span class="pptx-ng-diff-chevron">{{ expanded() ? '▾' : '▸' }}</span>
					<span class="pptx-ng-diff-slide">{{
						'pptx.compare.slideNumber' | translate: { number: slideNumber() }
					}}</span>
					<span class="pptx-ng-diff-pill" [attr.data-status]="diff().status">
						{{ statusLabel() }}
					</span>
					@if (diff().changes.length > 0) {
						<span class="pptx-ng-diff-count">{{ changeCountLabel() }}</span>
					}
					<span class="pptx-ng-diff-spacer"></span>
					@if (isResolved()) {
						<span class="pptx-ng-diff-tag" [class.is-accepted]="accepted()">
							{{ (accepted() ? 'pptx.compare.accepted' : 'pptx.compare.rejected') | translate }}
						</span>
					}
				</button>

				@if (expanded()) {
					<div class="pptx-ng-diff-body">
						<pptx-slide-diff-thumbnails
							[diff]="diff()"
							[canvasSize]="canvasSize()"
							[mediaDataUrls]="mediaDataUrls()"
						/>

						@if (diff().changes.length > 0) {
							<pptx-slide-diff-changes [changes]="diff().changes" />
						}

						<!-- Accept / Reject -->
						@if (!isResolved()) {
							<div class="pptx-ng-diff-actions">
								<button
									type="button"
									class="pptx-ng-diff-btn is-accept"
									(click)="accept.emit(diffIndex())"
								>
									✓ {{ 'pptx.compare.accept' | translate }}
								</button>
								<button
									type="button"
									class="pptx-ng-diff-btn is-reject"
									(click)="reject.emit(diffIndex())"
								>
									✕ {{ 'pptx.compare.reject' | translate }}
								</button>
							</div>
						}
					</div>
				}
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-diff-row {
				border: 1px solid var(--pptx-border, #374151);
				border-radius: 0.5rem;
				background: var(--pptx-background, #030712);
			}
			.pptx-ng-diff-row.is-resolved {
				opacity: 0.6;
				background: var(--pptx-card, #111827);
			}
			.pptx-ng-diff-head {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				width: 100%;
				padding: 0.5rem 0.75rem;
				text-align: left;
				border: none;
				background: transparent;
				color: var(--pptx-foreground, #f3f4f6);
				cursor: pointer;
			}
			.pptx-ng-diff-chevron {
				flex-shrink: 0;
				color: var(--pptx-muted-foreground, #9ca3af);
				font-size: 0.75rem;
			}
			.pptx-ng-diff-slide {
				font-size: 0.75rem;
			}
			.pptx-ng-diff-pill {
				border-radius: 9999px;
				padding: 0.0625rem 0.5rem;
				font-size: 0.625rem;
				font-weight: 500;
				color: var(--pptx-muted-foreground, #9ca3af);
				background: rgba(107, 114, 128, 0.2);
			}
			.pptx-ng-diff-pill[data-status='added'] {
				color: #4ade80;
				background: rgba(20, 83, 45, 0.3);
			}
			.pptx-ng-diff-pill[data-status='removed'] {
				color: #f87171;
				background: rgba(127, 29, 29, 0.3);
			}
			.pptx-ng-diff-pill[data-status='changed'] {
				color: #fbbf24;
				background: rgba(120, 53, 15, 0.3);
			}
			.pptx-ng-diff-count {
				font-size: 0.625rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-diff-spacer {
				flex: 1;
			}
			.pptx-ng-diff-tag {
				font-size: 0.625rem;
				font-weight: 500;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-diff-tag.is-accepted {
				color: #4ade80;
			}
			.pptx-ng-diff-body {
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				padding: 0 0.75rem 0.75rem;
			}
			.pptx-ng-diff-actions {
				display: flex;
				gap: 0.5rem;
				padding-top: 0.25rem;
			}
			.pptx-ng-diff-btn {
				display: inline-flex;
				align-items: center;
				gap: 0.25rem;
				padding: 0.25rem 0.625rem;
				border: none;
				border-radius: 0.25rem;
				font-size: 0.6875rem;
				cursor: pointer;
			}
			.pptx-ng-diff-btn.is-accept {
				background: rgba(21, 128, 61, 0.8);
				color: #f0fdf4;
			}
			.pptx-ng-diff-btn.is-accept:hover {
				background: #16a34a;
			}
			.pptx-ng-diff-btn.is-reject {
				background: var(--pptx-card, #111827);
				color: var(--pptx-foreground, #f3f4f6);
			}
			.pptx-ng-diff-btn.is-reject:hover {
				filter: brightness(1.2);
			}
		`,
	],
})
export class SlideDiffRowComponent {
	readonly diff = input.required<SlideDiff>();
	readonly diffIndex = input.required<number>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Record<string, string>>({});
	readonly accepted = input<boolean>(false);
	readonly rejected = input<boolean>(false);

	readonly accept = output<number>();
	readonly reject = output<number>();

	/** null = follow the default (expanded when status is `changed`). */
	private readonly expandedOverride = signal<boolean | null>(null);

	readonly expanded = computed(() => {
		const override = this.expandedOverride();
		return override ?? this.diff().status === 'changed';
	});

	readonly isResolved = computed(() => this.accepted() || this.rejected());

	readonly slideNumber = computed(() => slideNumberOf(this.diff()));

	readonly statusLabel = computed(() => statusLabel(this.diff().status));

	readonly changeCountLabel = computed(() => changeCountLabel(this.diff().changes.length));

	toggle(): void {
		this.expandedOverride.set(!this.expanded());
	}
}
