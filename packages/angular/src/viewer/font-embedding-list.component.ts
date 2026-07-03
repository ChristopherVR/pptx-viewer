/**
 * font-embedding-list.component.ts: the "Used fonts" section of the font-
 * embedding panel.
 *
 * Selector: `pptx-font-embedding-list`
 *
 * Split out of {@link FontEmbeddingPanelComponent} to keep each file focused.
 * Lists every used font family with its embedded / available status, shows a
 * scanning spinner while the availability scan runs, and a warning line when
 * some families are missing.
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-font-embedding-list',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	template: `
		<div class="pptx-ng-fonts-section">
			<h3 class="pptx-ng-fonts-section-title">
				{{ 'pptx.fontEmbedding.usedFonts' | translate: { count: usedFontFamilies().length } }}
			</h3>

			@if (scanning()) {
				<div class="pptx-ng-fonts-scanning">
					<span class="pptx-ng-fonts-spinner"></span>
					<span>{{ 'pptx.fontEmbedding.scanning' | translate }}</span>
				</div>
			} @else {
				<div class="pptx-ng-fonts-list">
					@for (family of usedFontFamilies(); track family) {
						<div class="pptx-ng-fonts-row">
							<span class="pptx-ng-fonts-name">{{ family }}</span>
							<div class="pptx-ng-fonts-status">
								@if (embeddedSet().has(family)) {
									<span class="pptx-ng-fonts-badge">{{
										'pptx.fontEmbedding.embedded' | translate
									}}</span>
								}
								@if (availableFamilies().has(family)) {
									<span
										class="pptx-ng-fonts-check"
										[attr.aria-label]="'pptx.fontEmbedding.available' | translate"
										>&#10003;</span
									>
								} @else {
									<span class="pptx-ng-fonts-missing">{{
										'pptx.fontEmbedding.notFound' | translate
									}}</span>
								}
							</div>
						</div>
					}
				</div>
			}
		</div>

		@if (missingCount() > 0 && !scanning()) {
			<p class="pptx-ng-fonts-warning">
				{{ 'pptx.fontEmbedding.missingWarning' | translate: { count: missingCount() } }}
			</p>
		}
	`,
	styles: [
		`
			.pptx-ng-fonts-section {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
			}
			.pptx-ng-fonts-section-title {
				margin: 0;
				font-size: 0.75rem;
				font-weight: 500;
				color: var(--pptx-foreground, #f3f4f6);
			}
			.pptx-ng-fonts-scanning {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 0.5rem;
				padding: 1rem 0;
				font-size: 0.75rem;
				color: var(--pptx-muted-foreground, #9ca3af);
			}
			.pptx-ng-fonts-spinner {
				width: 1rem;
				height: 1rem;
				border: 2px solid var(--pptx-muted-foreground, #9ca3af);
				border-top-color: transparent;
				border-radius: 9999px;
				animation: pptx-ng-fonts-spin 0.7s linear infinite;
			}
			@keyframes pptx-ng-fonts-spin {
				to {
					transform: rotate(360deg);
				}
			}
			.pptx-ng-fonts-list {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				max-height: 280px;
				overflow-y: auto;
			}
			.pptx-ng-fonts-row {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 0.5rem;
				padding: 0.5rem 0.75rem;
				border-radius: 0.5rem;
				background: var(--pptx-muted, rgba(31, 41, 55, 0.6));
			}
			.pptx-ng-fonts-name {
				font-size: 0.75rem;
				color: var(--pptx-foreground, #f3f4f6);
			}
			.pptx-ng-fonts-status {
				display: flex;
				align-items: center;
				gap: 0.5rem;
			}
			.pptx-ng-fonts-badge {
				padding: 0.0625rem 0.375rem;
				font-size: 0.625rem;
				color: #4ade80;
				background: rgba(20, 83, 45, 0.4);
				border: 1px solid rgba(21, 128, 61, 0.4);
				border-radius: 0.25rem;
			}
			.pptx-ng-fonts-check {
				font-size: 0.875rem;
				color: #4ade80;
			}
			.pptx-ng-fonts-missing {
				font-size: 0.625rem;
				color: #facc15;
			}
			.pptx-ng-fonts-warning {
				margin: 0;
				font-size: 0.6875rem;
				color: rgba(250, 204, 21, 0.8);
			}
		`,
	],
})
export class FontEmbeddingListComponent {
	/** Font families referenced by the presentation. */
	readonly usedFontFamilies = input<string[]>([]);

	/** Families that resolve in the current browser. */
	readonly availableFamilies = input<Set<string>>(new Set<string>());

	/** Families already embedded in the file. */
	readonly embeddedSet = input<Set<string>>(new Set<string>());

	/** True while the font-availability scan is running. */
	readonly scanning = input<boolean>(false);

	/** How many used families failed to resolve in the browser. */
	readonly missingCount = input<number>(0);
}
