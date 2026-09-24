/**
 * slide-canvas-context-menu.component.ts: right-click menu for the empty
 * slide canvas (no element under the cursor) in the Angular PPTX editor.
 *
 * Selector: `pptx-slide-canvas-context-menu`
 *
 * Sibling of `EditorContextMenuComponent` (the per-element menu): the item
 * list comes from `buildCanvasContextMenuEntries` in `pptx-viewer-shared`,
 * this component's job is only to render it and route a chosen command.
 *
 * Usage:
 * ```html
 * @if (canEdit() && canvasContextMenuPos(); as m) {
 *   <pptx-slide-canvas-context-menu
 *     [x]="m.x"
 *     [y]="m.y"
 *     [hasClipboard]="editor.hasClipboard()"
 *     [showGrid]="showGrid()"
 *     [showRulers]="showRulers()"
 *     (paste)="editor.paste(activeSlideIndex())"
 *     (openLayoutGallery)="openCanvasLayoutGallery(m.x, m.y)"
 *     (resetSlide)="resetActiveSlide()"
 *     (openFormatBackground)="inspectorPanel.openFormatPanel(); editor.clearSelection()"
 *     (toggleGrid)="showGrid.update((v) => !v)"
 *     (toggleRulers)="showRulers.update((v) => !v)"
 *     (closed)="canvasContextMenuPos.set(null)"
 *   />
 * }
 * ```
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { CanvasContextMenuCommandId, CanvasContextMenuEntry } from '../internal/shared';
import { buildCanvasContextMenuEntries } from '../internal/shared';
import { clampedMenuPosition } from './context-menu-position';
import { EDITOR_CONTEXT_MENU_STYLES } from './editor-context-menu.styles';
import type { CanvasContextMenuActions } from './slide-canvas-context-menu-dispatch';
import { runCanvasContextMenuCommand } from './slide-canvas-context-menu-dispatch';

/** Extra rule for the checkbox-style entries (Grid and Guides, Ruler). */
const CHECKBOX_ITEM_STYLES = `
	.pptx-ctx__check {
		display: inline-block;
		width: 14px;
	}
`;

@Component({
	selector: 'pptx-slide-canvas-context-menu',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<ul
			class="pptx-ctx__menu"
			data-pptx-context-menu="true"
			data-pptx-canvas-context-menu="true"
			role="menu"
			[attr.aria-label]="'pptx.canvasContextMenu.ariaLabel' | translate"
		>
			@for (entry of entries(); track entry.id) {
				@if (entry.separatorBefore) {
					<li role="separator" class="pptx-ctx__divider"></li>
				}
				<li role="none">
					<button
						type="button"
						class="pptx-ctx__item"
						[attr.role]="entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
						[attr.aria-checked]="entry.checked === undefined ? null : entry.checked"
						[disabled]="!!entry.disabled"
						(click)="run(entry.id)"
					>
						@if (entry.checked !== undefined) {
							<span class="pptx-ctx__check" aria-hidden="true">{{ entry.checked ? '✓' : '' }}</span>
						}
						{{ entry.labelKey | translate }}
					</button>
				</li>
			}
		</ul>
	`,
	styles: [EDITOR_CONTEXT_MENU_STYLES, CHECKBOX_ITEM_STYLES],
	host: {
		'[style.--pptx-ctx-x]': 'position.left() + "px"',
		'[style.--pptx-ctx-y]': 'position.top() + "px"',
	},
})
export class SlideCanvasContextMenuComponent {
	readonly x = input.required<number>();
	readonly y = input.required<number>();
	readonly hasClipboard = input<boolean>(false);
	readonly showGrid = input<boolean>(false);
	readonly showRulers = input<boolean>(false);

	readonly closed = output<void>();
	readonly paste = output<void>();
	/** Opens the existing Layout gallery (imperative open, not the ribbon's own click). */
	readonly openLayoutGallery = output<void>();
	readonly resetSlide = output<void>();
	/** Opens the inspector on slide/background properties (no element selected). */
	readonly openFormatBackground = output<void>();
	readonly toggleGrid = output<void>();
	readonly toggleRulers = output<void>();

	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
	/** Kept inside the viewport (see `context-menu-position.ts`). */
	protected readonly position = clampedMenuPosition(this.host, this.x, this.y);

	protected readonly entries = computed<CanvasContextMenuEntry[]>(() =>
		buildCanvasContextMenuEntries({
			hasClipboard: this.hasClipboard(),
			showGrid: this.showGrid(),
			showRulers: this.showRulers(),
		}),
	);

	private readonly actions: CanvasContextMenuActions = {
		paste: () => this.paste.emit(),
		openLayoutGallery: () => this.openLayoutGallery.emit(),
		resetSlide: () => this.resetSlide.emit(),
		openFormatBackground: () => this.openFormatBackground.emit(),
		toggleGrid: () => this.toggleGrid.emit(),
		toggleRulers: () => this.toggleRulers.emit(),
	};

	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.closed.emit();
	}

	@HostListener('document:pointerdown', ['$event'])
	onDocumentPointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}
		if (!this.host.nativeElement.contains(target)) {
			this.closed.emit();
		}
	}

	/** Run the chosen command, then close: every item closes the menu. */
	protected run(id: CanvasContextMenuCommandId): void {
		runCanvasContextMenuCommand(id, this.actions);
		this.closed.emit();
	}
}
