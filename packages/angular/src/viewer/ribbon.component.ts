/**
 * ribbon.component.ts — Office-style tabbed ribbon for the Angular editor chrome.
 *
 * 1:1 port of React's `viewer/components/Toolbar.tsx` + its `toolbar/*Section`
 * components, built with the Tailwind 4 utility classes shared across the
 * React/Vue/Angular packages (see `styles/theme.css`). Replaces the previous
 * flat button-row header.
 *
 * Layout (mirrors React):
 *   - Primary quick-access row: undo/redo, find, zoom · spacer · present/share/
 *     export/info/print/a11y/comments/link
 *   - Tab bar: File/Home/Insert/Text/Draw/Arrange/Design/Transitions/Animations/
 *     Slide Show/Review/View/Help
 *   - Ribbon content: the active tab's grouped controls
 *
 * Editing actions are wired straight to the shared {@link EditorStateService}
 * (provided at the viewer root, so this child injects the same instance).
 * Cross-cutting viewer actions (zoom/find/present/export/panels) come in as
 * `output()` events the {@link PowerPointViewerComponent} already has handlers for.
 */
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { newShapeElement, newTextElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';

/** Ribbon tab identifiers (mirrors React `TOOLBAR_SECTIONS`). */
type RibbonTab =
	| 'file'
	| 'home'
	| 'insert'
	| 'text'
	| 'arrange'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'slideShow'
	| 'review'
	| 'view'
	| 'help';

interface TabDef {
	id: RibbonTab;
	label: string;
}

const TABS: readonly TabDef[] = [
	{ id: 'file', label: 'File' },
	{ id: 'home', label: 'Home' },
	{ id: 'insert', label: 'Insert' },
	{ id: 'text', label: 'Text' },
	{ id: 'arrange', label: 'Arrange' },
	{ id: 'design', label: 'Design' },
	{ id: 'transitions', label: 'Transitions' },
	{ id: 'animations', label: 'Animations' },
	{ id: 'slideShow', label: 'Slide Show' },
	{ id: 'review', label: 'Review' },
	{ id: 'view', label: 'View' },
	{ id: 'help', label: 'Help' },
];

/** Font families offered in the Home tab (mirrors React). */
const FONT_FAMILIES = [
	'Segoe UI',
	'Arial',
	'Calibri',
	'Times New Roman',
	'Georgia',
	'Courier New',
	'Verdana',
	'Tahoma',
];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 54, 66, 80, 96];
const TEXT_COLORS = [
	'#000000',
	'#ffffff',
	'#ef4444',
	'#f59e0b',
	'#eab308',
	'#22c55e',
	'#3b82f6',
	'#6366f1',
	'#a855f7',
	'#ec4899',
];

@Component({
	selector: 'pptx-ribbon',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, NgTemplateOutlet],
	template: `
		<div
			role="toolbar"
			aria-label="Presentation toolbar"
			class="relative z-20 overflow-visible border-b border-border bg-secondary/50"
		>
			<!-- ── Primary quick-access row ─────────────────────────────────── -->
			<div class="flex items-center gap-1 px-2 py-1">
				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Previous slide"
					[disabled]="slideIndex() <= 0"
					(click)="prev.emit()"
				>
					‹
				</button>
				<span class="px-1 text-[11px] text-muted-foreground tabular-nums"
					>{{ slideCount() === 0 ? 0 : slideIndex() + 1 }} / {{ slideCount() }}</span
				>
				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Next slide"
					[disabled]="slideIndex() >= slideCount() - 1"
					(click)="next.emit()"
				>
					›
				</button>

				<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Undo"
					[disabled]="!editor.canUndo()"
					(click)="editor.undo()"
				>
					↶
				</button>
				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Redo"
					[disabled]="!editor.canRedo()"
					(click)="editor.redo()"
				>
					↷
				</button>

				<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

				<button type="button" class="pptx-rb-icon" aria-label="Zoom out" (click)="zoomOut.emit()">
					−
				</button>
				<button
					type="button"
					class="pptx-rb-pill min-w-12 justify-center tabular-nums"
					(click)="zoomReset.emit()"
				>
					{{ zoomPercent() }}%
				</button>
				<button type="button" class="pptx-rb-icon" aria-label="Zoom in" (click)="zoomIn.emit()">
					+
				</button>

				<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

				<button
					type="button"
					class="pptx-rb-pill"
					(click)="find.emit()"
					aria-label="Find in slides"
				>
					Find
				</button>

				<div class="flex-1"></div>

				<button
					type="button"
					class="pptx-rb-pill"
					[disabled]="slideCount() === 0"
					(click)="present.emit()"
				>
					Present
				</button>
				<button
					type="button"
					class="pptx-rb-pill"
					[disabled]="slideCount() === 0"
					(click)="presenter.emit()"
					aria-label="Presenter view"
				>
					Presenter
				</button>
				<button
					type="button"
					class="pptx-rb-pill"
					(click)="share.emit()"
					aria-label="Share for collaboration"
				>
					Share
				</button>
				<button
					type="button"
					class="pptx-rb-pill"
					(click)="info.emit()"
					aria-label="Document properties"
				>
					Info
				</button>
			</div>

			<!-- ── Tab bar ───────────────────────────────────────────────────── -->
			<div class="flex items-center border-b border-border/60 px-1">
				@for (t of tabs; track t.id) {
					<button
						type="button"
						(click)="activeTab.set(t.id)"
						class="relative whitespace-nowrap px-3.5 py-2 text-[12px] font-medium transition-colors"
						[ngClass]="
							activeTab() === t.id
								? 'text-foreground after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary'
								: 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
						"
					>
						{{ t.label }}
					</button>
				}
			</div>

			<!-- ── Ribbon content ────────────────────────────────────────────── -->
			<div class="flex flex-nowrap items-stretch gap-1.5 overflow-x-auto px-2 py-1.5">
				@switch (activeTab()) {
					@case ('file') {
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportPng.emit()"
								title="Export current slide as PNG"
							>
								PNG
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportPdf.emit()"
								title="Export deck as PDF"
							>
								{{ exporting() ? 'Exporting…' : 'PDF' }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportGif.emit()"
								title="Export as GIF"
							>
								GIF
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportVideo.emit()"
								title="Export as WebM video"
							>
								Video
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<button type="button" class="pptx-rb-pill" (click)="print.emit()">Print</button>
						<button type="button" class="pptx-rb-pill" (click)="info.emit()">Properties</button>
						<button type="button" class="pptx-rb-pill" (click)="replace.emit()">Replace</button>
					}
					@case ('home') {
						<!-- Clipboard -->
						<div class="pptx-rb-grp">
							<button type="button" class="pptx-rb-gb" title="Paste" (click)="paste()">
								Paste
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								title="Cut"
								[disabled]="!hasSel()"
								(click)="cut()"
							>
								Cut
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								title="Copy"
								[disabled]="!hasSel()"
								(click)="copy()"
							>
								Copy
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								data-testid="format-painter-toggle"
								[attr.data-active]="formatPainterActive() ? 'true' : 'false'"
								[ngClass]="formatPainterActive() ? 'bg-primary text-primary-foreground' : ''"
								[disabled]="!canActivateFormatPainter() && !formatPainterActive()"
								title="Format painter"
								(click)="toggleFormatPainter.emit()"
							>
								Painter
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Slides -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								title="New slide"
								(click)="editor.addSlide(slideIndex())"
							>
								＋ Slide
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								title="Duplicate slide"
								(click)="editor.duplicateSlide(slideIndex())"
							>
								Duplicate
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Font -->
						<ng-container [ngTemplateOutlet]="fontControls" />
						<span class="pptx-rb-sep"></span>
						<ng-container [ngTemplateOutlet]="paragraphControls" />
					}
					@case ('insert') {
						<div class="pptx-rb-grp">
							<button type="button" class="pptx-rb-gb" (click)="insertText()" title="Text box">
								Text Box
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertShape('rect')"
								title="Rectangle"
							>
								▭ Rect
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertShape('ellipse')"
								title="Ellipse"
							>
								◯ Ellipse
							</button>
							<button type="button" class="pptx-rb-gl" (click)="insertShape('line')" title="Line">
								／ Line
							</button>
						</div>
					}
					@case ('text') {
						<ng-container [ngTemplateOutlet]="fontControls" />
						<span class="pptx-rb-sep"></span>
						<ng-container [ngTemplateOutlet]="paragraphControls" />
					}
					@case ('arrange') {
						<!-- Order -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Bring to front"
								(click)="editor.bringSelectedToFront(slideIndex())"
							>
								Front
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Send to back"
								(click)="editor.sendSelectedToBack(slideIndex())"
							>
								Back
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Bring forward"
								(click)="editor.bringSelectedForward(slideIndex())"
							>
								Fwd
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								title="Send backward"
								(click)="editor.sendSelectedBackward(slideIndex())"
							>
								Bwd
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Align -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align left"
								(click)="editor.alignSelected(slideIndex(), 'left')"
							>
								⇤
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align center"
								(click)="editor.alignSelected(slideIndex(), 'centerH')"
							>
								⇔
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align right"
								(click)="editor.alignSelected(slideIndex(), 'right')"
							>
								⇥
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align top"
								(click)="editor.alignSelected(slideIndex(), 'top')"
							>
								⤒
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align middle"
								(click)="editor.alignSelected(slideIndex(), 'middle')"
							>
								⇕
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								title="Align bottom"
								(click)="editor.alignSelected(slideIndex(), 'bottom')"
							>
								⤓
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Group / edit -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Group"
								(click)="editor.groupSelected(slideIndex())"
							>
								Group
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Ungroup"
								(click)="editor.ungroupSelected(slideIndex())"
							>
								Ungroup
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Duplicate"
								(click)="editor.duplicateSelected(slideIndex())"
							>
								Duplicate
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								title="Delete"
								(click)="editor.deleteSelected(slideIndex())"
							>
								Delete
							</button>
						</div>
					}
					@case ('slideShow') {
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="slideCount() === 0"
							(click)="present.emit()"
						>
							From Beginning
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="slideCount() === 0"
							(click)="presenter.emit()"
						>
							Presenter View
						</button>
						<button type="button" class="pptx-rb-pill" (click)="broadcast.emit()">Broadcast</button>
					}
					@case ('review') {
						<button type="button" class="pptx-rb-pill" (click)="comments.emit()">Comments</button>
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">Accessibility</button>
						@if (hasSel()) {
							<button type="button" class="pptx-rb-pill" (click)="link.emit()">Link</button>
						}
					}
					@case ('view') {
						<button type="button" class="pptx-rb-pill" (click)="openSorter.emit()">
							Slide Sorter
						</button>
						<button type="button" class="pptx-rb-pill" (click)="toggleNotes.emit()">Notes</button>
						<button type="button" class="pptx-rb-pill" (click)="print.emit()">Print</button>
					}
					@case ('help') {
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">Accessibility</button>
					}
					@default {
						<span class="px-2 py-1.5 text-xs italic text-muted-foreground">
							{{ activeTabLabel() }} — controls coming soon
						</span>
					}
				}
			</div>
		</div>

		<!-- ── Reusable control groups ───────────────────────────────────────── -->
		<ng-template #fontControls>
			<div class="flex items-center gap-1">
				<select
					class="pptx-rb-select w-28"
					aria-label="Font family"
					[disabled]="!isText()"
					(change)="setFontFamily($event)"
				>
					@for (f of fontFamilies; track f) {
						<option [value]="f" [selected]="f === curFontFamily()">{{ f }}</option>
					}
				</select>
				<select
					class="pptx-rb-select w-14"
					aria-label="Font size"
					[disabled]="!isText()"
					(change)="setFontSize($event)"
				>
					@for (s of fontSizes; track s) {
						<option [value]="s" [selected]="s === curFontSize()">{{ s }}</option>
					}
				</select>
			</div>
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb font-bold"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.bold ? 'bg-accent' : ''"
					title="Bold"
					(click)="toggleStyle('bold')"
				>
					B
				</button>
				<button
					type="button"
					class="pptx-rb-gb italic"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.italic ? 'bg-accent' : ''"
					title="Italic"
					(click)="toggleStyle('italic')"
				>
					I
				</button>
				<button
					type="button"
					class="pptx-rb-gb underline"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.underline ? 'bg-accent' : ''"
					title="Underline"
					(click)="toggleStyle('underline')"
				>
					U
				</button>
				<button
					type="button"
					class="pptx-rb-gl line-through"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.strikethrough ? 'bg-accent' : ''"
					title="Strikethrough"
					(click)="toggleStyle('strikethrough')"
				>
					S
				</button>
			</div>
			<div class="flex items-center gap-0.5">
				@for (c of textColors; track c) {
					<button
						type="button"
						class="h-4 w-4 rounded-sm border border-border/60"
						[disabled]="!isText()"
						[style.background]="c"
						[attr.aria-label]="'Text colour ' + c"
						(click)="setColor(c)"
					></button>
				}
			</div>
		</ng-template>

		<ng-template #paragraphControls>
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'left' ? 'bg-accent' : ''"
					title="Align left"
					(click)="setAlign('left')"
				>
					⯇
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'center' ? 'bg-accent' : ''"
					title="Align center"
					(click)="setAlign('center')"
				>
					≡
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'right' ? 'bg-accent' : ''"
					title="Align right"
					(click)="setAlign('right')"
				>
					⯈
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'justify' ? 'bg-accent' : ''"
					title="Justify"
					(click)="setAlign('justify')"
				>
					☰
				</button>
			</div>
		</ng-template>
	`,
})
export class RibbonComponent {
	protected readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly slideCount = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly zoomPercent = input<number>(100);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);
	readonly exporting = input<boolean>(false);

	readonly prev = output<void>();
	readonly next = output<void>();
	readonly zoomIn = output<void>();
	readonly zoomOut = output<void>();
	readonly zoomReset = output<void>();
	readonly find = output<void>();
	readonly present = output<void>();
	readonly presenter = output<void>();
	readonly share = output<void>();
	readonly broadcast = output<void>();
	readonly info = output<void>();
	readonly print = output<void>();
	readonly comments = output<void>();
	readonly a11y = output<void>();
	readonly link = output<void>();
	readonly openSorter = output<void>();
	readonly toggleNotes = output<void>();
	readonly toggleFormatPainter = output<void>();
	readonly exportPng = output<void>();
	readonly exportPdf = output<void>();
	readonly exportGif = output<void>();
	readonly exportVideo = output<void>();
	readonly replace = output<void>();

	protected readonly tabs = TABS;
	protected readonly fontFamilies = FONT_FAMILIES;
	protected readonly fontSizes = FONT_SIZES;
	protected readonly textColors = TEXT_COLORS;

	protected readonly activeTab = signal<RibbonTab>('home');

	protected readonly activeTabLabel = computed(
		() => TABS.find((t) => t.id === this.activeTab())?.label ?? '',
	);

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}

	protected isText(): boolean {
		const el = this.selectedElement();
		return el !== null && hasTextProperties(el);
	}

	/** Current text style of the selection (for active-state highlighting). */
	protected readonly curStyle = computed(() => {
		const el = this.selectedElement();
		return el && hasTextProperties(el) ? (el.textStyle ?? null) : null;
	});

	protected curFontFamily(): string {
		return this.curStyle()?.fontFamily ?? 'Segoe UI';
	}
	protected curFontSize(): number {
		return Math.round(this.curStyle()?.fontSize ?? 18);
	}

	// ── Clipboard ────────────────────────────────────────────────────────────
	protected copy(): void {
		this.editor.copySelected(this.slideIndex());
	}
	protected cut(): void {
		this.editor.cutSelected(this.slideIndex());
	}
	protected paste(): void {
		this.editor.paste(this.slideIndex());
	}

	// ── Insert ──────────────────────────────────────────────────────────────
	protected insertText(): void {
		this.editor.addElement(this.slideIndex(), newTextElement());
	}
	protected insertShape(kind: 'rect' | 'ellipse' | 'line'): void {
		this.editor.addElement(this.slideIndex(), newShapeElement(kind));
	}

	// ── Text style ────────────────────────────────────────────────────────────
	private patchText(patch: Record<string, unknown>): void {
		const el = this.selectedElement();
		if (!el || !hasTextProperties(el)) {
			return;
		}
		this.editor.updateElement(this.slideIndex(), el.id, {
			textStyle: { ...el.textStyle, ...patch },
		} as Partial<PptxElement>);
	}
	protected toggleStyle(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
		this.patchText({ [key]: !this.curStyle()?.[key] });
	}
	protected setColor(color: string): void {
		this.patchText({ color });
	}
	protected setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
		this.patchText({ align });
	}
	protected setFontFamily(event: Event): void {
		this.patchText({ fontFamily: (event.target as HTMLSelectElement).value });
	}
	protected setFontSize(event: Event): void {
		this.patchText({ fontSize: Number((event.target as HTMLSelectElement).value) });
	}
}
