/**
 * table-cell-formatting.component.test.ts: unit tests for the per-cell
 * text/fill colour theme-swatch wiring.
 *
 * `onColorCommit` is a plain method taking a style-key pair and a
 * `ThemeColorPickerCommit`, tested directly (no TestBed, see
 * `vitest.config.ts`); the template wiring that reaches it (which field
 * passes which key pair) is pinned as a source-text guard, the technique
 * `ribbon-color-popover.component.test.ts` established for this package.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';
import { TableCellFormattingComponent } from './table-cell-formatting.component';

/** Access the protected handler the template binds to. */
interface FormattingHandlers {
	onColorCommit: (
		hexKey: 'color' | 'backgroundColor',
		refKey: 'colorRef' | 'backgroundColorRef',
		commit: { hex: string; ref: unknown },
	) => void;
	updateStyle: (patch: Record<string, unknown>) => void;
}

function createComponent(): TableCellFormattingComponent {
	return runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new TableCellFormattingComponent(),
	);
}

describe('tableCellFormattingComponent colour theme wiring', () => {
	it('mounts the shared colour field for both the text and background colours', () => {
		const source = componentSource(import.meta.dirname, 'table-cell-formatting.component.ts');
		expect(source).toContain('<pptx-table-cell-color-field');
		expect(source).toContain('[selectedRef]="style().colorRef"');
		expect(source).toContain('[selectedRef]="style().backgroundColorRef"');
		expect(source).toContain("(commit)=\"onColorCommit('color', 'colorRef', $event)\"");
		expect(source).toContain(
			"(commit)=\"onColorCommit('backgroundColor', 'backgroundColorRef', $event)\"",
		);
		expect(source).toContain('TableCellColorFieldComponent');
	});

	it('onColorCommit merges both the hex and the ref into the selected cell style', () => {
		const component = createComponent();
		const patch: Array<Record<string, unknown>> = [];
		(component as unknown as { updateStyle: (p: Record<string, unknown>) => void }).updateStyle = (
			p,
		) => patch.push(p);

		(component as unknown as FormattingHandlers).onColorCommit('color', 'colorRef', {
			hex: '#4472c4',
			ref: { scheme: 'accent1' },
		});
		expect(patch).toStrictEqual([{ color: '#4472c4', colorRef: { scheme: 'accent1' } }]);

		(component as unknown as FormattingHandlers).onColorCommit(
			'backgroundColor',
			'backgroundColorRef',
			{
				hex: '#ffffff',
				ref: undefined,
			},
		);
		expect(patch[1]).toStrictEqual({ backgroundColor: '#ffffff', backgroundColorRef: undefined });
	});
});
