/**
 * slide-default-inspector.component.ts: the right-docked inspector's tabbed
 * format pane, mirroring React's `InspectorPane`: an
 * [Elements | Properties | Comments] tab strip (Properties active by default)
 * that is ALWAYS rendered, with or without a selection. With no selection the
 * Properties tab shows the presentation-properties sections plus the slide
 * background/notes card; with an element selected it shows the element
 * inspector (`pptx-inspector-panel`) instead. The Elements (layer-order) and
 * Comments tabs stay available either way, and the active tab survives
 * selection changes because the host renders this one component for both the
 * 'element' and 'slide' inspector kinds.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxComment, PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { CommentsPanelComponent } from './comments-panel.component';
import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import type { SlideInspectorTab } from './inspector-pane-header.component';
import { InspectorPaneHeaderComponent } from './inspector-pane-header.component';
import { InspectorPanelComponent } from './inspector-panel.component';
import { PresentationPropertiesPanelComponent } from './presentation-properties-panel.component';
import { SlideBackgroundCardComponent } from './slide-background-card.component';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';

/** One row of the Elements (layer-order) tab. */
interface LayerRow {
	readonly id: string;
	readonly index: number;
	readonly label: string;
	readonly selected: boolean;
}

@Component({
	selector: 'pptx-slide-default-inspector',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		InspectorPaneHeaderComponent,
		InspectorPanelComponent,
		PresentationPropertiesPanelComponent,
		SlideBackgroundCardComponent,
		CommentsPanelComponent,
	],
	template: `
		<pptx-inspector-pane-header
			[activeTab]="activeTab()"
			(tabChange)="activeTab.set($event)"
			(closePane)="inspectorPanel.toggleFormatPanel()"
		/>
		<div class="body">
			@switch (activeTab()) {
				@case ('elements') {
					<h3 class="icard__heading">{{ 'pptx.inspector.layerOrder' | translate }}</h3>
					@if (layerRows(); as rows) {
						@if (rows.length === 0) {
							<span class="icard__label">{{ 'pptx.selectionPane.noObjects' | translate }}</span>
						}
						@for (row of rows; track row.id) {
							<button
								type="button"
								class="lrow"
								[class.is-selected]="row.selected"
								(click)="editor.select([row.id])"
							>
								<span class="lrow__idx">{{ row.index + 1 }}</span>
								<span class="lrow__label">{{ row.label }}</span>
							</button>
						}
					}
				}
				@case ('properties') {
					@if (selectedElement(); as el) {
						<!--
							React parity: with an element selected the Properties tab shows
							the element inspector (ElementInspectorBody); the tab strip above
							stays in place and the other tabs remain reachable.
						-->
						<pptx-inspector-panel
							[element]="el"
							[slideIndex]="slideIndex()"
							[canEdit]="canEdit()"
						/>
					} @else {
						<pptx-presentation-properties-panel [canEdit]="canEdit()" [slideIndex]="slideIndex()" />
						<!--
							BACKGROUND card (colour / picture / clear), matching React's
							SlideBackgroundPanel. The SLIDE card below keeps the speaker-notes
							field, which Angular surfaces here rather than only in the notes pane.
						-->
						<pptx-slide-background-card [slideIndex]="slideIndex()" [canEdit]="canEdit()" />
						@if (activeSlide(); as sl) {
							<section class="icard" [attr.data-slide-key]="slideKey()">
								<h3 class="icard__heading">{{ 'pptx.viewer.slide' | translate }}</h3>
								<label class="icard__col">
									<span class="icard__label">{{ 'pptx.notes.title' | translate }}</span>
									<textarea
										rows="4"
										class="icard__input"
										[disabled]="!canEdit()"
										[attr.placeholder]="'pptx.viewer.speakerNotesPlaceholder' | translate"
										(change)="canvasEditing.onSlideNotes($event)"
										(blur)="canvasEditing.onSlideNotes($event)"
										>{{ sl.notes || '' }}</textarea>
								</label>
							</section>
						}
					}
				}
				@case ('comments') {
					<pptx-comments-panel
						[comments]="comments()"
						(add)="commentAdd.emit($event)"
						(remove)="commentRemove.emit($event)"
						(resolve)="commentResolve.emit($event)"
						(reply)="commentReply.emit($event)"
					/>
				}
			}
		</div>
	`,
	styles: [
		`
			:host {
				display: flex;
				flex-direction: column;
				min-height: 0;
			}
			.body {
				display: grid;
				gap: 8px;
				align-content: start;
				padding: 10px;
				overflow-y: auto;
				font-size: 11px;
			}
			.lrow {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 4px 8px;
				border: none;
				border-radius: 4px;
				background: transparent;
				color: inherit;
				font-size: 11px;
				font-family: inherit;
				text-align: left;
				cursor: pointer;
			}
			.lrow:hover {
				background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
			}
			.lrow.is-selected {
				background: var(--pptx-inspector-active, #0078d4);
				color: #fff;
			}
			.lrow__idx {
				width: 16px;
				text-align: right;
				color: var(--pptx-inspector-muted, #888);
				flex-shrink: 0;
			}
			.lrow.is-selected .lrow__idx {
				color: inherit;
			}
			.lrow__label {
				flex: 1;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}
		`,
		INSPECTOR_CARD_STYLES,
	],
})
export class SlideDefaultInspectorComponent {
	/** Zero-based index of the active slide. */
	readonly slideIndex = input.required<number>();
	/** Whether mutation controls are enabled. */
	readonly canEdit = input<boolean>(true);
	/**
	 * The single selected element, or null. When set, the Properties tab shows
	 * the element inspector instead of the presentation/slide sections (the tab
	 * strip itself persists either way, matching React's InspectorPane).
	 */
	readonly selectedElement = input<PptxElement | null>(null);
	/** The active slide's comments (host-owned; history-aware writes stay there). */
	readonly comments = input<PptxComment[]>([]);

	/** Re-emitted comments-panel events (the host owns the comment writes). */
	readonly commentAdd = output<string>();
	readonly commentRemove = output<string>();
	readonly commentResolve = output<string>();
	readonly commentReply = output<{ parentId: string; text: string }>();

	protected readonly editor = inject(EditorStateService);
	protected readonly canvasEditing = inject(ViewerCanvasEditingService);
	protected readonly inspectorPanel = inject(ViewerInspectorPanelService);

	/** Active tab; Properties by default, matching React's initial pane state. */
	protected readonly activeTab = signal<SlideInspectorTab>('properties');

	protected readonly activeSlide = computed(() => this.editor.slides()[this.slideIndex()]);

	/** Stable per-slide key so slide inputs reseed only on slide change. */
	protected readonly slideKey = computed(() => `slide-${this.slideIndex()}`);

	/**
	 * Layer-order rows, top-most first (same ordering + labelling as React's
	 * Elements tab: reversed element order, text preview or element type).
	 */
	protected readonly layerRows = computed<LayerRow[]>(() => {
		const elements = this.activeSlide()?.elements ?? [];
		const selectedIds = this.editor.selectedIds();
		return [...elements].reverse().map((el, ri) => {
			const index = elements.length - 1 - ri;
			const textLabel = hasTextProperties(el) ? (el.text || '').slice(0, 24) : undefined;
			return {
				id: el.id,
				index,
				label: textLabel || el.type,
				selected: selectedIds.includes(el.id),
			};
		});
	});
}
