import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { GroupPptxElement, OlePptxElement, PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { getOleObjectTypeLabel } from 'pptx-viewer-core';

import type { ConnectorArrowControl } from '../internal/shared';
import {
	CONNECTOR_ARROW_CONTROLS,
	CONNECTOR_ARROW_SIZE_VALUES,
	connectorArrowPatch,
	connectorArrowValue,
} from '../internal/shared';
import { schemaLabelKey } from './schema-token-labels';

/**
 * Arrowhead width / length steps, i.e. the `a:headEnd/@w` and `@len` values.
 *
 * Re-exported from the shared descriptor table so a unit test can pin the
 * offered set while the labels change (the package's suite is TestBed-free, so
 * the template is out of reach).
 */
export const ARROW_SIZE_VALUES = CONNECTOR_ARROW_SIZE_VALUES;
const GEOMETRIES = [
	['straightConnector1', 'Straight'],
	['bentConnector2', 'Bent'],
	['bentConnector3', 'Double Bent'],
	['bentConnector4', 'Triple Bent'],
	['bentConnector5', 'Quad Bent'],
	['curvedConnector2', 'Curved'],
	['curvedConnector3', 'Curved (Cubic)'],
	['curvedConnector4', 'Curved 4'],
	['curvedConnector5', 'Curved 5'],
] as const;

export function connectorStylePatch(
	element: PptxElement,
	update: Partial<ShapeStyle>,
): Partial<PptxElement> {
	const current = (element as { shapeStyle?: ShapeStyle }).shapeStyle;
	return { shapeStyle: { ...current, ...update } } as Partial<PptxElement>;
}

@Component({
	selector: 'pptx-element-misc-properties',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (connector()) {
			<section class="card" aria-label="Connector">
				<h3>Connector</h3>
				<!--
					Selection is expressed with [selected] on each option rather than
					[value] on the select: Angular applies an element's own property
					bindings before the @for below it has produced any options, so a
					[value] naming a token was assigned to an EMPTY select and dropped
					back to the first entry. Every one of these dropdowns therefore read
					"none" / "Small" no matter what the deck authored, and the card
					silently misreported the connector it was editing.
				-->
				<label class="geometry">
					<span>Geometry</span>
					<select aria-label="Geometry" (change)="onConnectorType($event)">
						@for (geometry of geometries; track geometry[0]) {
							<option [value]="geometry[0]" [selected]="geometry[0] === connectorType()">
								{{ geometry[1] }}
							</option>
						}
					</select>
				</label>
				<div class="grid">
					@for (control of arrowControls; track control.styleKey) {
						<label>
							<span>{{ control.labelKey | translate }}</span>
							<select
								[attr.aria-label]="control.labelKey | translate"
								(change)="onArrow(control, $event)"
							>
								@for (value of control.values; track value) {
									<option [value]="value" [selected]="value === arrowValue(control)">
										{{ optionLabelKey(control, value) | translate }}
									</option>
								}
							</select>
						</label>
					}
				</div>
			</section>
		}
		@if (group(); as value) {
			<section class="card" aria-label="Group">
				<h3>Group</h3>
				<p>{{ value.children.length }} children</p>
			</section>
		}
		@if (ole(); as value) {
			<section class="card" [attr.aria-label]="'pptx.ole.title' | translate">
				<h3>{{ 'pptx.ole.title' | translate }}</h3>
				<dl>
					<div>
						<dt>{{ 'pptx.ole.type' | translate }}</dt>
						<dd>{{ oleType() }}</dd>
					</div>
					@if (value.fileName) {
						<div>
							<dt>{{ 'pptx.ole.fileName' | translate }}</dt>
							<dd [title]="value.fileName">{{ value.fileName }}</dd>
						</div>
					}
					<div>
						<dt>{{ 'pptx.ole.linkStatus' | translate }}</dt>
						<dd>{{ (value.isLinked ? 'pptx.ole.linked' : 'pptx.ole.embedded') | translate }}</dd>
					</div>
				</dl>
			</section>
		}
	`,
	styles: `
		.card {
			padding: 8px 0;
			border-bottom: 1px solid var(--pptx-inspector-border, #333);
			font-size: 11px;
		}
		h3 {
			margin: 0 0 6px;
			color: var(--pptx-inspector-muted, #999);
			font-size: 10px;
			text-transform: uppercase;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 6px;
		}
		label {
			display: grid;
			gap: 3px;
			color: var(--pptx-inspector-muted, #aaa);
		}
		.geometry {
			margin-bottom: 6px;
		}
		select {
			min-width: 0;
			padding: 3px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
		}
		p {
			margin: 0;
			color: var(--pptx-inspector-muted, #aaa);
		}
		dl {
			display: grid;
			gap: 5px;
			margin: 0;
		}
		dl div {
			display: flex;
			justify-content: space-between;
			gap: 8px;
		}
		dt {
			color: var(--pptx-inspector-muted, #aaa);
		}
		dd {
			margin: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	`,
})
export class ElementMiscPropertiesComponent {
	readonly element = input.required<PptxElement>();
	readonly patch = output<Partial<PptxElement>>();
	/**
	 * The six arrowhead dropdowns, described once in shared. Angular used to
	 * declare its own value order and interpolate sentence-case captions
	 * ("Start arrow"), which read differently from the other four bindings.
	 */
	protected readonly arrowControls = CONNECTOR_ARROW_CONTROLS;
	protected readonly geometries = GEOMETRIES;
	protected readonly connector = computed(() => this.element().type === 'connector');
	protected readonly connectorType = computed(
		() => (this.element() as { shapeType?: string }).shapeType ?? 'straightConnector1',
	);
	protected readonly group = computed(() =>
		this.element().type === 'group' ? (this.element() as GroupPptxElement) : undefined,
	);
	protected readonly ole = computed(() =>
		this.element().type === 'ole' ? (this.element() as OlePptxElement) : undefined,
	);
	protected readonly oleType = computed(() => getOleObjectTypeLabel(this.ole()?.oleObjectType));

	/**
	 * Spell one option. Resolving a KEY (not finished text) keeps the wording
	 * live under `OnPush`, since `TranslatePipe` marks the view for check when
	 * the language changes. See `schema-token-labels`.
	 */
	protected optionLabelKey(control: ConnectorArrowControl, value: string): string {
		return schemaLabelKey(control.optionLabelKeys, value);
	}
	protected arrowValue(control: ConnectorArrowControl): string {
		return connectorArrowValue(control, (this.element() as { shapeStyle?: ShapeStyle }).shapeStyle);
	}
	protected onArrow(control: ConnectorArrowControl, event: Event): void {
		this.updateStyle(connectorArrowPatch(control, (event.target as HTMLSelectElement).value));
	}
	protected onConnectorType(event: Event): void {
		this.patch.emit({
			shapeType: (event.target as HTMLSelectElement).value,
		} as Partial<PptxElement>);
	}
	private updateStyle(update: Partial<ShapeStyle>): void {
		this.patch.emit(connectorStylePatch(this.element(), update));
	}
}
