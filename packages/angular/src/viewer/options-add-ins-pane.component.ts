/**
 * options-add-ins-pane.component.ts: Options > Add-ins pane (Angular port of
 * React's `settings/OptionsAddInsPane.tsx`).
 *
 * Presents the viewer's optional capability modules the way PowerPoint lists
 * COM add-ins: a name/location/type table grouped by active state (from
 * host-supplied {@link ViewerAddinStatus} flags; unset ids default to active),
 * with a detail card for the selected row.
 */
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { resolveViewerAddinRows } from '../internal/shared';
import type { ViewerAddinRow, ViewerAddinStatus } from '../internal/shared';

@Component({
	selector: 'pptx-options-add-ins-pane',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="pptx-ng-options-addins">
			<div class="pptx-ng-options-addins-head">
				<span>{{ 'pptx.options.addIns.name' | translate }}</span>
				<span>{{ 'pptx.options.addIns.location' | translate }}</span>
				<span>{{ 'pptx.options.addIns.type' | translate }}</span>
			</div>

			<section>
				<h4>{{ 'pptx.options.addIns.active' | translate }}</h4>
				@for (row of active(); track row.id) {
					<button
						type="button"
						class="pptx-ng-options-addins-row"
						[class.is-selected]="selectedId() === row.id"
						(click)="selectedId.set(row.id)"
					>
						<span>{{ row.nameKey | translate }}</span>
						<span class="pptx-ng-options-addins-loc">{{ row.location }}</span>
						<span>{{ 'pptx.options.addInType.' + row.type | translate }}</span>
					</button>
				} @empty {
					<p class="pptx-ng-options-addins-empty">
						{{ 'pptx.options.addIns.description' | translate }}
					</p>
				}
			</section>

			<section>
				<h4>{{ 'pptx.options.addIns.inactive' | translate }}</h4>
				@for (row of inactive(); track row.id) {
					<button
						type="button"
						class="pptx-ng-options-addins-row"
						[class.is-selected]="selectedId() === row.id"
						(click)="selectedId.set(row.id)"
					>
						<span>{{ row.nameKey | translate }}</span>
						<span class="pptx-ng-options-addins-loc">{{ row.location }}</span>
						<span>{{ 'pptx.options.addInType.' + row.type | translate }}</span>
					</button>
				} @empty {
					<p class="pptx-ng-options-addins-empty">
						{{ 'pptx.options.addIns.description' | translate }}
					</p>
				}
			</section>

			@if (selected(); as row) {
				<div class="pptx-ng-options-addins-detail">
					<p class="pptx-ng-options-addins-detail-name">{{ row.nameKey | translate }}</p>
					<p>{{ row.descriptionKey | translate }}</p>
					<p class="pptx-ng-options-addins-loc">{{ row.location }}</p>
				</div>
			}
		</div>
	`,
	styles: [
		`
			.pptx-ng-options-addins {
				display: flex;
				flex-direction: column;
				gap: 14px;
			}
			.pptx-ng-options-addins-head,
			.pptx-ng-options-addins-row {
				display: grid;
				grid-template-columns: 1.4fr 1fr 0.7fr;
				gap: 8px;
				align-items: center;
			}
			.pptx-ng-options-addins-head {
				padding: 0 8px 4px;
				border-bottom: 1px solid var(--pptx-border);
				color: var(--pptx-muted-foreground);
				font-size: 10px;
				font-weight: 600;
				letter-spacing: 0.04em;
				text-transform: uppercase;
			}
			.pptx-ng-options-addins h4 {
				margin: 0 0 2px;
				font-size: 12px;
				font-weight: 600;
			}
			.pptx-ng-options-addins-row {
				width: 100%;
				padding: 6px 8px;
				border: 0;
				border-bottom: 1px solid color-mix(in srgb, var(--pptx-border) 45%, transparent);
				background: transparent;
				color: var(--pptx-foreground);
				font-size: 12px;
				text-align: left;
				cursor: pointer;
			}
			.pptx-ng-options-addins-row:hover {
				background: var(--pptx-accent);
			}
			.pptx-ng-options-addins-row.is-selected {
				background: color-mix(in srgb, var(--pptx-primary) 10%, transparent);
			}
			.pptx-ng-options-addins-loc {
				color: var(--pptx-muted-foreground);
				font:
					11px ui-monospace,
					monospace;
				overflow-wrap: anywhere;
			}
			.pptx-ng-options-addins-empty {
				margin: 0;
				padding: 4px 8px;
				color: var(--pptx-muted-foreground);
				font-size: 11px;
				font-style: italic;
			}
			.pptx-ng-options-addins-detail {
				padding: 10px 12px;
				border: 1px solid var(--pptx-border);
				border-radius: 6px;
				background: var(--pptx-muted);
				font-size: 12px;
			}
			.pptx-ng-options-addins-detail p {
				margin: 0 0 4px;
			}
			.pptx-ng-options-addins-detail-name {
				font-weight: 600;
			}
		`,
	],
})
export class OptionsAddInsPaneComponent {
	/** Host-supplied availability flags; unset ids default to active. */
	readonly addinStatus = input<ViewerAddinStatus | undefined>(undefined);

	protected readonly selectedId = signal<string | null>(null);

	private readonly rows = computed<ViewerAddinRow[]>(() =>
		resolveViewerAddinRows(this.addinStatus()),
	);
	protected readonly active = computed(() => this.rows().filter((row) => row.active));
	protected readonly inactive = computed(() => this.rows().filter((row) => !row.active));
	protected readonly selected = computed(
		() => this.rows().find((row) => row.id === this.selectedId()) ?? null,
	);
}
