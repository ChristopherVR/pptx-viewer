import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	ConnectorArrowType,
	GroupPptxElement,
	OlePptxElement,
	PptxElement,
	ShapeStyle,
} from 'pptx-viewer-core';
import { getOleObjectTypeLabel } from 'pptx-viewer-core';

const ARROWS: readonly ConnectorArrowType[] = [
	'none',
	'triangle',
	'arrow',
	'stealth',
	'diamond',
	'oval',
];
const SIZES = ['sm', 'med', 'lg'] as const;

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
				<div class="grid">
					@for (end of ends; track end) {
						<label>
							<span>{{ end }} arrow</span>
							<select [value]="arrowValue(end)" (change)="onArrow(end, $event)">
								@for (arrow of arrows; track arrow) {
									<option [value]="arrow">{{ arrowLabel(arrow) | translate }}</option>
								}
							</select>
						</label>
						<label>
							<span>{{ end }} width</span>
							<select [value]="sizeValue(end, 'Width')" (change)="onSize(end, 'Width', $event)">
								@for (size of sizes; track size) {
									<option [value]="size">{{ size }}</option>
								}
							</select>
						</label>
						<label>
							<span>{{ end }} length</span>
							<select [value]="sizeValue(end, 'Length')" (change)="onSize(end, 'Length', $event)">
								@for (size of sizes; track size) {
									<option [value]="size">{{ size }}</option>
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
	protected readonly arrows = ARROWS;
	protected readonly sizes = SIZES;
	protected readonly ends = ['Start', 'End'] as const;
	protected readonly connector = computed(() => this.element().type === 'connector');
	protected readonly group = computed(() =>
		this.element().type === 'group' ? (this.element() as GroupPptxElement) : undefined,
	);
	protected readonly ole = computed(() =>
		this.element().type === 'ole' ? (this.element() as OlePptxElement) : undefined,
	);
	protected readonly oleType = computed(() => getOleObjectTypeLabel(this.ole()?.oleObjectType));

	protected arrowLabel(value: ConnectorArrowType): string {
		return `pptx.arrowhead.${value}`;
	}
	protected arrowValue(end: 'Start' | 'End'): ConnectorArrowType {
		return (
			((this.element() as { shapeStyle?: ShapeStyle }).shapeStyle?.[
				`connector${end}Arrow`
			] as ConnectorArrowType) ?? 'none'
		);
	}
	protected sizeValue(end: 'Start' | 'End', dimension: 'Width' | 'Length'): string {
		return String(
			(this.element() as { shapeStyle?: ShapeStyle }).shapeStyle?.[
				`connector${end}Arrow${dimension}`
			] ?? 'med',
		);
	}
	protected onArrow(end: 'Start' | 'End', event: Event): void {
		this.updateStyle({ [`connector${end}Arrow`]: (event.target as HTMLSelectElement).value });
	}
	protected onSize(end: 'Start' | 'End', dimension: 'Width' | 'Length', event: Event): void {
		this.updateStyle({
			[`connector${end}Arrow${dimension}`]: (event.target as HTMLSelectElement).value,
		});
	}
	private updateStyle(update: Partial<ShapeStyle>): void {
		this.patch.emit(connectorStylePatch(this.element(), update));
	}
}
