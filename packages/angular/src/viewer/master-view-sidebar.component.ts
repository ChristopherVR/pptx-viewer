import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	MasterViewTab,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlideMaster,
} from 'pptx-viewer-core';

const HANDOUT_COUNTS = [1, 2, 3, 4, 6, 9] as const;

/** Framework-neutral navigation and properties rail for Angular Master View. */
@Component({
	selector: 'pptx-master-view-sidebar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgTemplateOutlet, TranslatePipe],
	template: `
		<aside class="master-sidebar" [attr.aria-label]="'pptx.view.masterViews' | translate">
			<header>
				<strong>{{ titleKey() | translate }}</strong>
				<button type="button" (click)="close.emit()" [attr.aria-label]="'pptx.mode.closeMasterViewTooltip' | translate">×</button>
			</header>
			<div class="tabs" role="tablist" [attr.aria-label]="'pptx.mode.masterView' | translate">
				@for (item of tabs; track item.tab) {
					<button type="button" role="tab" [attr.aria-selected]="tab() === item.tab" (click)="tabChange.emit(item.tab)">
						{{ item.key | translate }}
					</button>
				}
			</div>
			<div class="body" role="tabpanel">
				@if (tab() === 'slides') {
					@for (master of slideMasters(); track master.path; let masterIndex = $index) {
						<button type="button" class="master-item" [attr.aria-pressed]="activeMasterIndex() === masterIndex && activeLayoutIndex() === null" (click)="selectMaster.emit(masterIndex)">
							{{ master.name || ('pptx.master.master' | translate) }}
						</button>
						@for (layout of master.layouts ?? []; track layout.path; let layoutIndex = $index) {
							<button type="button" class="master-item layout" [attr.aria-pressed]="activeMasterIndex() === masterIndex && activeLayoutIndex() === layoutIndex" (click)="selectLayout.emit({ masterIndex, layoutIndex })">
								{{ layout.name || ('pptx.master.layout' | translate) }}
							</button>
						}
					}
				} @else if (tab() === 'notes') {
					@if (notesMaster()) {
						<ng-container [ngTemplateOutlet]="backgroundEditor" [ngTemplateOutletContext]="{ color: notesMaster()!.backgroundColor || '#ffffff' }" />
						<p>{{ (notesMaster()!.placeholders?.length ?? 0) }} {{ 'pptx.master.notesMasterPlaceholders' | translate }}</p>
					} @else { <p>{{ 'pptx.master.noNotesMaster' | translate }}</p> }
				} @else {
					@if (handoutMaster()) {
						<section>
							<strong>{{ 'pptx.master.handoutSlidesPerPage' | translate }}</strong>
							<div class="counts">
								@for (count of handoutCounts; track count) {
									<button type="button" [attr.aria-pressed]="handoutSlidesPerPage() === count" (click)="slidesPerPageChange.emit(count)">{{ count }}</button>
								}
							</div>
						</section>
						<ng-container [ngTemplateOutlet]="backgroundEditor" [ngTemplateOutletContext]="{ color: handoutMaster()!.backgroundColor || '#ffffff' }" />
					} @else { <p>{{ 'pptx.master.noHandoutMaster' | translate }}</p> }
				}
			</div>
		</aside>

		<ng-template #backgroundEditor let-color="color">
			<label class="background-editor">
				<span>{{ 'pptx.master.notesMasterBackground' | translate }}</span>
				<input type="color" [attr.aria-label]="'pptx.master.backgroundColorLabel' | translate" [value]="color" (input)="backgroundChange.emit($any($event.target).value)" />
			</label>
		</ng-template>
	`,
	styles: [
		`
			.master-sidebar {
				display: flex;
				width: 224px;
				min-height: 0;
				flex-direction: column;
				border-right: 1px solid var(--pptx-border, #33334d);
				background: var(--pptx-card, #1e1e2e);
			}
			header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 8px 12px;
			}
			header strong {
				color: var(--pptx-muted-foreground, #a5a5b5);
				font-size: 11px;
				text-transform: uppercase;
			}
			header button {
				border: 0;
				background: transparent;
				color: inherit;
				font-size: 20px;
				cursor: pointer;
			}
			.tabs {
				display: flex;
				padding: 0 4px;
				border-bottom: 1px solid var(--pptx-border, #33334d);
			}
			.tabs button {
				flex: 1;
				padding: 6px 3px;
				border: 0;
				border-bottom: 2px solid transparent;
				background: transparent;
				color: var(--pptx-muted-foreground, #a5a5b5);
				font-size: 10px;
				cursor: pointer;
			}
			.tabs button[aria-selected='true'] {
				border-bottom-color: #f59e0b;
				color: #f59e0b;
			}
			.body {
				flex: 1;
				min-height: 0;
				overflow: auto;
				padding: 8px;
			}
			.master-item {
				display: block;
				width: 100%;
				margin-bottom: 6px;
				padding: 8px;
				border: 1px solid transparent;
				border-radius: 5px;
				background: transparent;
				color: inherit;
				text-align: left;
			}
			.master-item.layout {
				width: calc(100% - 14px);
				margin-left: 14px;
			}
			.master-item[aria-pressed='true'] {
				border-color: var(--pptx-primary, #6366f1);
			}
			section,
			.background-editor {
				display: flex;
				flex-direction: column;
				gap: 8px;
				margin-bottom: 12px;
				padding: 10px;
				border: 1px solid var(--pptx-border, #33334d);
				border-radius: 6px;
			}
			.counts {
				display: grid;
				grid-template-columns: repeat(3, 1fr);
				gap: 4px;
			}
			.counts button[aria-pressed='true'] {
				background: var(--pptx-primary, #6366f1);
				color: #fff;
			}
			.background-editor input {
				width: 100%;
				height: 34px;
			}
		`,
	],
})
export class MasterViewSidebarComponent {
	readonly tab = input.required<MasterViewTab>();
	readonly slideMasters = input.required<readonly PptxSlideMaster[]>();
	readonly notesMaster = input<PptxNotesMaster>();
	readonly handoutMaster = input<PptxHandoutMaster>();
	readonly activeMasterIndex = input(0);
	readonly activeLayoutIndex = input<number | null>(null);
	readonly handoutSlidesPerPage = input(4);

	readonly tabChange = output<MasterViewTab>();
	readonly selectMaster = output<number>();
	readonly selectLayout = output<{ masterIndex: number; layoutIndex: number }>();
	readonly slidesPerPageChange = output<number>();
	readonly backgroundChange = output<string>();
	readonly close = output<void>();

	protected readonly tabs = [
		{ tab: 'slides' as const, key: 'pptx.sections.slides' },
		{ tab: 'notes' as const, key: 'pptx.notes.title' },
		{ tab: 'handout' as const, key: 'pptx.masterView.tabHandout' },
	];
	protected readonly handoutCounts = HANDOUT_COUNTS;
	protected titleKey(): string {
		return this.tab() === 'slides'
			? 'pptx.masterView.slideMastersTitle'
			: this.tab() === 'notes'
				? 'pptx.masterView.notesMasterTitle'
				: 'pptx.masterView.handoutMasterTitle';
	}
}
