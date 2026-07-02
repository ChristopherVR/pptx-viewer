/**
 * compare-panel.component.ts: right-docked slide comparison review panel.
 *
 * Selector: `pptx-compare-panel`
 *
 * Angular port of the React `ComparePanel` (packages/react/src/viewer/
 * components/ComparePanel.tsx). Displays the slide-level {@link CompareResult}
 * diff between two presentations as a scrollable list of
 * {@link SlideDiffRowComponent} cards. Users accept or reject individual slide
 * changes (or accept all at once); accepted/rejected state is tracked locally
 * and surfaced to the host through the `acceptSlide` / `rejectSlide` /
 * `acceptAll` outputs.
 */

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { CanvasSize, CompareResult } from '../internal/shared';
import { SlideDiffRowComponent } from './slide-diff-row.component';

@Component({
	selector: 'pptx-compare-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SlideDiffRowComponent, TranslatePipe],
	template: `
		@if (open() && compareResult(); as result) {
			<div class="pptx-ng-compare">
				<!-- Header -->
				<div class="pptx-ng-compare-head">
					<div>
						<h3 class="pptx-ng-compare-title">{{ 'pptx.compare.title' | translate }}</h3>
						<p class="pptx-ng-compare-summary">
							{{
								'pptx.compare.summary'
									| translate
										: {
												added: result.addedCount,
												removed: result.removedCount,
												changed: result.changedCount,
										  }
							}}
						</p>
					</div>
					<button
						type="button"
						class="pptx-ng-compare-close"
						[title]="'pptx.compare.close' | translate"
						[attr.aria-label]="'pptx.compare.closePanel' | translate"
						(click)="close.emit()"
					>
						✕
					</button>
				</div>

				<!-- Accept all -->
				@if (nonTrivialCount() > 0) {
					<div class="pptx-ng-compare-acceptall">
						<button type="button" class="pptx-ng-compare-acceptall-btn" (click)="handleAcceptAll()">
							✓ {{ 'pptx.compare.acceptAll' | translate }}
						</button>
					</div>
				}

				<!-- Diff list -->
				<div class="pptx-ng-compare-list">
					@if (nonTrivialCount() === 0) {
						<div class="pptx-ng-compare-empty">{{ 'pptx.compare.noDifferences' | translate }}</div>
					} @else {
						@for (diff of result.diffs; track $index; let i = $index) {
							<pptx-slide-diff-row
								[diff]="diff"
								[diffIndex]="i"
								[canvasSize]="canvasSize()"
								[mediaDataUrls]="mediaDataUrls()"
								[accepted]="isAccepted(i)"
								[rejected]="isRejected(i)"
								(accept)="handleAccept($event)"
								(reject)="handleReject($event)"
							/>
						}
					}
				</div>
			</div>
		}
	`,
	styles: [
		`
			.pptx-ng-compare {
				position: fixed;
				inset-block: 0;
				right: 0;
				z-index: 50;
				display: flex;
				flex-direction: column;
				width: 440px;
				max-width: 100%;
				border-left: 1px solid var(--pptx-border, #374151);
				background: var(--pptx-popover, #0b1220);
				backdrop-filter: blur(12px);
				box-shadow: -12px 0 40px rgba(0, 0, 0, 0.5);
			}
			.pptx-ng-compare-head {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0.75rem 1rem;
				border-bottom: 1px solid var(--pptx-border, #374151);
			}
			.pptx-ng-compare-title {
				margin: 0;
				font-size: 0.875rem;
				font-weight: 500;
				color: var(--pptx-foreground, #f3f4f6);
			}
			.pptx-ng-compare-summary {
				margin: 0.125rem 0 0;
				font-size: 0.6875rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-compare-close {
				padding: 0.375rem;
				border: none;
				border-radius: 0.25rem;
				background: transparent;
				color: var(--pptx-muted-foreground, #9ca3af);
				cursor: pointer;
				transition: background 0.15s ease;
			}
			.pptx-ng-compare-close:hover {
				background: var(--pptx-muted, #1f2937);
				color: var(--pptx-foreground, #f3f4f6);
			}
			.pptx-ng-compare-acceptall {
				padding: 0.5rem 1rem;
				border-bottom: 1px solid var(--pptx-border, #374151);
			}
			.pptx-ng-compare-acceptall-btn {
				display: inline-flex;
				align-items: center;
				gap: 0.375rem;
				padding: 0.375rem 0.75rem;
				border: none;
				border-radius: 0.25rem;
				background: rgba(21, 128, 61, 0.8);
				color: #f0fdf4;
				font-size: 0.75rem;
				cursor: pointer;
				transition: background 0.15s ease;
			}
			.pptx-ng-compare-acceptall-btn:hover {
				background: #16a34a;
			}
			.pptx-ng-compare-list {
				flex: 1;
				overflow-y: auto;
				display: flex;
				flex-direction: column;
				gap: 0.5rem;
				padding: 0.75rem;
			}
			.pptx-ng-compare-empty {
				padding: 2rem 0;
				text-align: center;
				font-size: 0.75rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
		`,
	],
})
export class ComparePanelComponent {
	readonly open = input<boolean>(false);
	readonly compareResult = input<CompareResult | null>(null);
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Record<string, string>>({});

	readonly close = output<void>();
	readonly acceptSlide = output<number>();
	readonly rejectSlide = output<number>();
	readonly acceptAll = output<void>();

	/** Diff indices the user has accepted. */
	private readonly accepted = signal<Record<number, boolean>>({});
	/** Diff indices the user has rejected. */
	private readonly rejected = signal<Record<number, boolean>>({});

	/** Count of diffs worth reviewing (everything except `unchanged`). */
	readonly nonTrivialCount = computed(
		() => this.compareResult()?.diffs.filter((d) => d.status !== 'unchanged').length ?? 0,
	);

	isAccepted(index: number): boolean {
		return Boolean(this.accepted()[index]);
	}

	isRejected(index: number): boolean {
		return Boolean(this.rejected()[index]);
	}

	handleAccept(index: number): void {
		this.accepted.update((p) => ({ ...p, [index]: true }));
		this.rejected.update((p) => {
			const next = { ...p };
			delete next[index];
			return next;
		});
		this.acceptSlide.emit(index);
	}

	handleReject(index: number): void {
		this.rejected.update((p) => ({ ...p, [index]: true }));
		this.accepted.update((p) => {
			const next = { ...p };
			delete next[index];
			return next;
		});
		this.rejectSlide.emit(index);
	}

	handleAcceptAll(): void {
		const result = this.compareResult();
		if (!result) {
			return;
		}
		const acc: Record<number, boolean> = {};
		result.diffs.forEach((d, i) => {
			if (d.status !== 'unchanged') {
				acc[i] = true;
			}
		});
		this.accepted.set(acc);
		this.rejected.set({});
		this.acceptAll.emit();
	}
}
