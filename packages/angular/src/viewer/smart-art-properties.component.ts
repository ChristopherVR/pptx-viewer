/**
 * smart-art-properties.component.ts: SmartArt editing inspector (Angular).
 *
 * Selector: `pptx-smart-art-properties`
 *
 * Presentational panel for editing a selected SmartArt element's data model:
 * per-node text editing, add item / add sub-item, remove, promote / demote,
 * reorder up / down, colour-scheme select, style toggle (flat / moderate /
 * intense), and a layout switcher. All mutations are delegated to the pure
 * helpers in `smart-art-properties-helpers.ts` (which wrap the core editing ops
 * re-exported via `editor-insert.ts`); no editing logic lives here. Every edit
 * is emitted as a complete new `PptxSmartArtData` via `smartArtDataChange`, so
 * the parent (`InspectorPanelComponent`) can commit it through
 * `EditorStateService.updateElement()` as a single undo/redo history entry.
 *
 * Ported from the React inspector:
 *   packages/react/src/viewer/components/inspector/SmartArtPropertiesPanel.tsx
 *   packages/react/src/viewer/components/inspector/SmartArtLayoutSwitcher.tsx
 *
 * Usage:
 * ```html
 * <pptx-smart-art-properties
 *   [smartArtData]="data"
 *   [canEdit]="canEdit"
 *   (smartArtDataChange)="onSmartArtChange($event)"
 * />
 * ```
 *
 * @module angular-viewer/smart-art-properties
 */

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type {
	PptxSmartArtData,
	SmartArtColorScheme,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';

import { SWITCHABLE_LAYOUT_TYPES } from './editor-insert';
import {
	addItem,
	addSubItem,
	currentColorScheme,
	currentLayout,
	currentStyle,
	demoteNode,
	isChildNode,
	moveNodeDown,
	moveNodeUp,
	promoteNode,
	removeNode,
	setColorScheme,
	setLayout,
	setNodeText,
	setStyle,
	SMART_ART_COLOR_SCHEMES,
	SMART_ART_STYLE_OPTIONS,
	smartArtNodes,
} from './smart-art-properties-helpers';

@Component({
	selector: 'pptx-smart-art-properties',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="pptx-sa-props" aria-label="SmartArt properties">
			<h3 class="pptx-sa-props__heading">SmartArt</h3>

			<!-- ── Layout switcher ──────────────────────────────────────────── -->
			<div class="pptx-sa-props__field">
				<span class="pptx-sa-props__label">Layout</span>
				<div class="pptx-sa-props__layouts" role="group" aria-label="Switch layout">
					@for (layout of layoutTypes; track layout) {
						<button
							type="button"
							class="pptx-sa-props__layout"
							[class.is-active]="activeLayout() === layout"
							[disabled]="!canEdit()"
							[attr.aria-pressed]="activeLayout() === layout"
							(click)="onLayout(layout)"
						>
							{{ layout }}
						</button>
					}
				</div>
			</div>

			<!-- ── Colour scheme ────────────────────────────────────────────── -->
			<label class="pptx-sa-props__field">
				<span class="pptx-sa-props__label">Color scheme</span>
				<select
					class="pptx-sa-props__select"
					[disabled]="!canEdit()"
					[value]="activeColorScheme()"
					(change)="onColorScheme($event)"
				>
					@for (scheme of colorSchemes; track scheme) {
						<option [value]="scheme">{{ scheme }}</option>
					}
				</select>
			</label>

			<!-- ── Style intensity ──────────────────────────────────────────── -->
			<div class="pptx-sa-props__field">
				<span class="pptx-sa-props__label">Style</span>
				<div class="pptx-sa-props__styles" role="group" aria-label="Style intensity">
					@for (styleOpt of styleOptions; track styleOpt) {
						<button
							type="button"
							class="pptx-sa-props__style"
							[class.is-active]="activeStyle() === styleOpt"
							[disabled]="!canEdit()"
							[attr.aria-pressed]="activeStyle() === styleOpt"
							(click)="onStyle(styleOpt)"
						>
							{{ styleOpt }}
						</button>
					}
				</div>
			</div>

			<!-- ── Text pane / node list ────────────────────────────────────── -->
			<div class="pptx-sa-props__pane-header">
				<span class="pptx-sa-props__label">Text pane ({{ nodes().length }})</span>
				<button
					type="button"
					class="pptx-sa-props__btn"
					[disabled]="!canEdit()"
					(click)="onAddItem()"
				>
					+ Item
				</button>
			</div>

			<ul class="pptx-sa-props__nodes" role="list">
				@for (node of nodes(); track node.id; let i = $index) {
					<li
						class="pptx-sa-props__node"
						[class.pptx-sa-props__node--child]="isChild(node)"
						[attr.data-node-id]="node.id"
					>
						<span class="pptx-sa-props__bullet">{{ isChild(node) ? '•' : i + 1 }}</span>
						<input
							type="text"
							class="pptx-sa-props__node-input"
							[disabled]="!canEdit()"
							[value]="node.text"
							placeholder="Type here"
							(change)="onNodeText($event, node.id)"
							(keydown)="onNodeKeydown($event, node.id)"
						/>
						<div class="pptx-sa-props__node-actions">
							@if (!isChild(node)) {
								<button
									type="button"
									class="pptx-sa-props__icon"
									title="Add sub-item"
									[disabled]="!canEdit()"
									(click)="onAddSubItem(node.id)"
								>
									+Sub
								</button>
							}
							<button
								type="button"
								class="pptx-sa-props__icon"
								title="Promote"
								[disabled]="!canEdit() || isChild(node) === false"
								(click)="onPromote(node.id)"
							>
								&#8592;
							</button>
							<button
								type="button"
								class="pptx-sa-props__icon"
								title="Demote"
								[disabled]="!canEdit()"
								(click)="onDemote(node.id)"
							>
								&#8594;
							</button>
							<button
								type="button"
								class="pptx-sa-props__icon"
								title="Move up"
								[disabled]="!canEdit()"
								(click)="onMoveUp(node.id)"
							>
								&#8593;
							</button>
							<button
								type="button"
								class="pptx-sa-props__icon"
								title="Move down"
								[disabled]="!canEdit()"
								(click)="onMoveDown(node.id)"
							>
								&#8595;
							</button>
							<button
								type="button"
								class="pptx-sa-props__icon pptx-sa-props__icon--danger"
								title="Remove"
								[disabled]="!canEdit() || nodes().length <= 1"
								(click)="onRemove(node.id)"
							>
								&times;
							</button>
						</div>
					</li>
				}
			</ul>

			<p class="pptx-sa-props__hint">Tab to demote, Shift+Tab to promote.</p>
		</section>
	`,
	styles: `
		.pptx-sa-props {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
			padding: 0.5rem 0;
		}

		.pptx-sa-props__heading {
			font-size: 10px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			color: var(--pptx-inspector-muted, #888);
			margin: 0;
		}

		.pptx-sa-props__field {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
		}

		.pptx-sa-props__label {
			font-size: 10px;
			color: var(--pptx-inspector-muted, #888);
		}

		.pptx-sa-props__layouts,
		.pptx-sa-props__styles {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.pptx-sa-props__layout,
		.pptx-sa-props__style,
		.pptx-sa-props__btn,
		.pptx-sa-props__icon {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			cursor: pointer;
			font-size: 10px;
			padding: 2px 6px;
			white-space: nowrap;
		}

		.pptx-sa-props__layout {
			flex: 1 0 auto;
			text-transform: capitalize;
		}

		.pptx-sa-props__style {
			flex: 1 0 auto;
			text-transform: capitalize;
		}

		.pptx-sa-props__layout.is-active,
		.pptx-sa-props__style.is-active {
			background: var(--pptx-inspector-active, #0078d4);
			border-color: var(--pptx-inspector-active, #0078d4);
			color: #fff;
		}

		.pptx-sa-props__select {
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 11px;
		}

		.pptx-sa-props__pane-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.35rem;
			margin-top: 0.2rem;
		}

		.pptx-sa-props__nodes {
			list-style: none;
			margin: 0;
			padding: 0;
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
			max-height: 14rem;
			overflow-y: auto;
		}

		.pptx-sa-props__node {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			padding: 2px;
			border: 1px solid var(--pptx-inspector-border, #333);
			border-radius: 3px;
		}

		.pptx-sa-props__node--child {
			margin-left: 1rem;
			border-color: var(--pptx-inspector-border, #2a2a2a);
		}

		.pptx-sa-props__bullet {
			font-size: 9px;
			color: var(--pptx-inspector-muted, #888);
			min-width: 12px;
			text-align: center;
			flex-shrink: 0;
		}

		.pptx-sa-props__node-input {
			flex: 1;
			min-width: 0;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			border: 1px solid var(--pptx-inspector-border, #444);
			color: inherit;
			border-radius: 3px;
			padding: 2px 4px;
			font-size: 11px;
		}

		.pptx-sa-props__node-actions {
			display: flex;
			gap: 1px;
			flex-shrink: 0;
		}

		.pptx-sa-props__icon {
			padding: 1px 3px;
			font-size: 10px;
			line-height: 1.2;
		}

		.pptx-sa-props__icon--danger {
			color: var(--pptx-inspector-danger, #f47c7c);
		}

		.pptx-sa-props__layout:disabled,
		.pptx-sa-props__style:disabled,
		.pptx-sa-props__btn:disabled,
		.pptx-sa-props__icon:disabled,
		.pptx-sa-props__select:disabled,
		.pptx-sa-props__node-input:disabled {
			opacity: 0.45;
			cursor: not-allowed;
		}

		.pptx-sa-props__hint {
			font-size: 9px;
			color: var(--pptx-inspector-muted, #888);
			margin: 0.1rem 0 0;
		}
	`,
})
export class SmartArtPropertiesComponent {
	/** The SmartArt data model being edited. */
	readonly smartArtData = input.required<PptxSmartArtData>();
	/** Whether editing is enabled (read-only when false). */
	readonly canEdit = input<boolean>(true);

	/** Emits a complete new data model after any edit. */
	readonly smartArtDataChange = output<PptxSmartArtData>();

	// ── Static option lists (template-bound) ─────────────────────────────────
	protected readonly layoutTypes: readonly SmartArtLayoutType[] = SWITCHABLE_LAYOUT_TYPES;
	protected readonly colorSchemes = SMART_ART_COLOR_SCHEMES;
	protected readonly styleOptions = SMART_ART_STYLE_OPTIONS;

	// ── Derived state ─────────────────────────────────────────────────────────
	protected readonly nodes = computed(() => smartArtNodes(this.smartArtData()));
	protected readonly activeLayout = computed(() => currentLayout(this.smartArtData()));
	protected readonly activeColorScheme = computed(() => currentColorScheme(this.smartArtData()));
	protected readonly activeStyle = computed(() => currentStyle(this.smartArtData()));

	protected isChild = isChildNode;

	// ── Event handlers (each emits a fresh data model) ───────────────────────
	protected onLayout(layout: SmartArtLayoutType): void {
		this.commit(setLayout(this.smartArtData(), layout));
	}

	protected onColorScheme(event: Event): void {
		const value = selectValue(event);
		if (value === null) {
			return;
		}
		this.commit(setColorScheme(this.smartArtData(), value as SmartArtColorScheme));
	}

	protected onStyle(style: SmartArtStyle): void {
		this.commit(setStyle(this.smartArtData(), style));
	}

	protected onAddItem(): void {
		this.commit(addItem(this.smartArtData()));
	}

	protected onAddSubItem(parentId: string): void {
		this.commit(addSubItem(this.smartArtData(), parentId));
	}

	protected onRemove(nodeId: string): void {
		this.commit(removeNode(this.smartArtData(), nodeId));
	}

	protected onPromote(nodeId: string): void {
		this.commit(promoteNode(this.smartArtData(), nodeId));
	}

	protected onDemote(nodeId: string): void {
		this.commit(demoteNode(this.smartArtData(), nodeId));
	}

	protected onMoveUp(nodeId: string): void {
		this.commit(moveNodeUp(this.smartArtData(), nodeId));
	}

	protected onMoveDown(nodeId: string): void {
		this.commit(moveNodeDown(this.smartArtData(), nodeId));
	}

	protected onNodeText(event: Event, nodeId: string): void {
		const value = inputValue(event);
		if (value === null) {
			return;
		}
		this.commit(setNodeText(this.smartArtData(), nodeId, value));
	}

	protected onNodeKeydown(event: KeyboardEvent, nodeId: string): void {
		if (event.key !== 'Tab') {
			return;
		}
		event.preventDefault();
		const next = event.shiftKey
			? promoteNode(this.smartArtData(), nodeId)
			: demoteNode(this.smartArtData(), nodeId);
		this.commit(next);
	}

	/** Emit a new data model only when it differs from the current one. */
	private commit(next: PptxSmartArtData): void {
		if (!this.canEdit() || next === this.smartArtData()) {
			return;
		}
		this.smartArtDataChange.emit(next);
	}
}

// ── Module-private helpers ───────────────────────────────────────────────────

/** Read the value of a `<select>` change event. */
function selectValue(event: Event): string | null {
	const target = event.target;
	return target instanceof HTMLSelectElement ? target.value : null;
}

/** Read the value of an `<input>` change event. */
function inputValue(event: Event): string | null {
	const target = event.target;
	return target instanceof HTMLInputElement ? target.value : null;
}
