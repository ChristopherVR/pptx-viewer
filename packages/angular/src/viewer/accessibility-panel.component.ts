/**
 * accessibility-panel.component.ts: Lists accessibility issues for the current
 * presentation, grouped by severity (errors first, then warnings, then tips).
 *
 * Selector: `pptx-accessibility-panel`
 *
 * Each issue shows a human-readable type label, its message, and which slide it
 * lives on. Clicking an issue emits `selectSlide` with the issue's zero-based
 * slide index so the host editor can jump to that slide. When there are no
 * issues a clean empty state is shown instead.
 *
 * Purely presentational: the caller supplies the already-computed issue list
 * (see {@link AccessibilityService}).
 *
 * Usage:
 * ```html
 * <pptx-accessibility-panel
 *   [issues]="a11y.issues()"
 *   (selectSlide)="goTo($event)"
 * />
 * ```
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { AccessibilityIssue, AccessibilityIssueType } from 'pptx-viewer-core';

import { groupIssuesBySeverity, issueTrackKey, issueTypeLabel } from './accessibility-helpers';
import type { AccessibilityIssueGroup } from './accessibility-helpers';

@Component({
	selector: 'pptx-accessibility-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="pptx-ng-a11y-panel" [attr.aria-label]="'pptx.accessibility.title' | translate">
			<header class="pptx-ng-a11y-panel__header">
				<h2 class="pptx-ng-a11y-panel__title">{{ 'pptx.accessibility.heading' | translate }}</h2>
				<span class="pptx-ng-a11y-panel__count">{{ issues().length }}</span>
			</header>

			@if (!hasIssues()) {
				<div class="pptx-ng-a11y-panel__empty">
					<p class="pptx-ng-a11y-panel__empty-title">
						{{ 'pptx.accessibility.noIssuesFound' | translate }}
					</p>
					<p class="pptx-ng-a11y-panel__empty-hint">
						{{ 'pptx.accessibility.noIssuesHint' | translate }}
					</p>
				</div>
			} @else {
				<div class="pptx-ng-a11y-panel__groups">
					@for (group of groups(); track group.severity) {
						<div class="pptx-ng-a11y-group" [attr.data-severity]="group.severity">
							<h3 class="pptx-ng-a11y-group__label">
								{{ group.label }}
								<span class="pptx-ng-a11y-group__count">{{ group.issues.length }}</span>
							</h3>
							<ul class="pptx-ng-a11y-group__list">
								@for (issue of group.issues; track issueKey(issue, $index)) {
									<li
										class="pptx-ng-a11y-issue"
										[attr.data-severity]="issue.severity"
										[attr.data-type]="issue.type"
									>
										<button
											type="button"
											class="pptx-ng-a11y-issue__button"
											(click)="onSelect(issue)"
										>
											<span class="pptx-ng-a11y-issue__type">{{ typeLabel(issue.type) }}</span>
											<span class="pptx-ng-a11y-issue__message">{{ issue.message }}</span>
											<span class="pptx-ng-a11y-issue__slide">{{
												'pptx.notes.slideN' | translate: { n: issue.slideIndex + 1 }
											}}</span>
										</button>
									</li>
								}
							</ul>
						</div>
					}
				</div>
			}
		</section>
	`,
	styles: [
		`
			.pptx-ng-a11y-panel {
				display: flex;
				flex-direction: column;
				gap: 0.75rem;
				padding: 0.75rem;
				font-family: system-ui, sans-serif;
				font-size: 0.875rem;
				color: #1f2937;
				background: #ffffff;
			}

			.pptx-ng-a11y-panel__header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
			}

			.pptx-ng-a11y-panel__title {
				margin: 0;
				font-size: 1rem;
				font-weight: 600;
			}

			.pptx-ng-a11y-panel__count {
				min-width: 1.5rem;
				padding: 0.05rem 0.4rem;
				text-align: center;
				font-size: 0.75rem;
				font-weight: 600;
				color: #374151;
				background: #e5e7eb;
				border-radius: 999px;
			}

			.pptx-ng-a11y-panel__empty {
				padding: 1.5rem 0.5rem;
				text-align: center;
				color: #047857;
			}

			.pptx-ng-a11y-panel__empty-title {
				margin: 0 0 0.25rem;
				font-weight: 600;
			}

			.pptx-ng-a11y-panel__empty-hint {
				margin: 0;
				font-size: 0.8125rem;
				color: #6b7280;
			}

			.pptx-ng-a11y-panel__groups {
				display: flex;
				flex-direction: column;
				gap: 1rem;
			}

			.pptx-ng-a11y-group__label {
				display: flex;
				align-items: center;
				gap: 0.4rem;
				margin: 0 0 0.4rem;
				font-size: 0.8125rem;
				font-weight: 600;
				text-transform: uppercase;
				letter-spacing: 0.03em;
			}

			.pptx-ng-a11y-group[data-severity='error'] .pptx-ng-a11y-group__label {
				color: #b91c1c;
			}

			.pptx-ng-a11y-group[data-severity='warning'] .pptx-ng-a11y-group__label {
				color: #b45309;
			}

			.pptx-ng-a11y-group[data-severity='tip'] .pptx-ng-a11y-group__label {
				color: #1d4ed8;
			}

			.pptx-ng-a11y-group__count {
				font-size: 0.6875rem;
				font-weight: 600;
				color: #6b7280;
			}

			.pptx-ng-a11y-group__list {
				display: flex;
				flex-direction: column;
				gap: 0.4rem;
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.pptx-ng-a11y-issue__button {
				display: flex;
				flex-direction: column;
				gap: 0.15rem;
				width: 100%;
				padding: 0.5rem 0.625rem;
				text-align: left;
				color: inherit;
				background: #f9fafb;
				border: 1px solid #e5e7eb;
				border-left-width: 3px;
				border-radius: 0.375rem;
				cursor: pointer;
			}

			.pptx-ng-a11y-issue__button:hover {
				background: #f3f4f6;
			}

			.pptx-ng-a11y-issue__button:focus-visible {
				outline: 2px solid #2563eb;
				outline-offset: 1px;
			}

			.pptx-ng-a11y-issue[data-severity='error'] .pptx-ng-a11y-issue__button {
				border-left-color: #dc2626;
			}

			.pptx-ng-a11y-issue[data-severity='warning'] .pptx-ng-a11y-issue__button {
				border-left-color: #d97706;
			}

			.pptx-ng-a11y-issue[data-severity='tip'] .pptx-ng-a11y-issue__button {
				border-left-color: #2563eb;
			}

			.pptx-ng-a11y-issue__type {
				font-weight: 600;
			}

			.pptx-ng-a11y-issue__message {
				color: #374151;
			}

			.pptx-ng-a11y-issue__slide {
				font-size: 0.75rem;
				color: #6b7280;
			}
		`,
	],
})
export class AccessibilityPanelComponent {
	// -------------------------------------------------------------------------
	// Inputs / outputs
	// -------------------------------------------------------------------------

	/** Already-computed accessibility issues (see {@link AccessibilityService}). */
	readonly issues = input<AccessibilityIssue[]>([]);

	/** Emits the issue's zero-based slide index when an issue is clicked. */
	readonly selectSlide = output<number>();

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	private readonly translate = inject(TranslateService);

	/**
	 * Non-empty severity groups in display order.
	 *
	 * The headings are translated through the shared key map rather than taken
	 * from the module's English constants: this panel rendered "Errors" to a
	 * French user while Vue's rendered "Erreurs" from the same aggregation.
	 */
	readonly groups = computed<AccessibilityIssueGroup[]>(() =>
		groupIssuesBySeverity(this.issues(), (key) => this.translate.instant(key)),
	);

	/** True when there is at least one issue. */
	readonly hasIssues = computed<boolean>(() => this.issues().length > 0);

	// -------------------------------------------------------------------------
	// Template helpers
	// -------------------------------------------------------------------------

	typeLabel(type: AccessibilityIssueType): string {
		return issueTypeLabel(type, (key) => this.translate.instant(key));
	}

	/** Stable-ish track key; issues have no id of their own. */
	issueKey(issue: AccessibilityIssue, index: number): string {
		return issueTrackKey(issue, index);
	}

	onSelect(issue: AccessibilityIssue): void {
		this.selectSlide.emit(issue.slideIndex);
	}
}
