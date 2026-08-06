import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Cross-binding rendering contracts this binding is easy to break silently.
 *
 * No Angular TestBed in this package (see `vitest.config.ts`), so the template
 * contracts are read from the source, matching
 * `slide-canvas-show-contract.test.ts`.
 */
import { describe, expect, it } from 'vitest';

const ELEMENT_HTML = readFileSync(path.join(__dirname, 'element-renderer.component.html'), 'utf8');
const ELEMENT_TS = readFileSync(path.join(__dirname, 'element-renderer.component.ts'), 'utf8');
const CANVAS_HTML = readFileSync(path.join(__dirname, 'slide-canvas.component.html'), 'utf8');
const TABLE_HTML = readFileSync(path.join(__dirname, 'table-renderer.component.html'), 'utf8');
const TABLE_TS = readFileSync(path.join(__dirname, 'table-renderer.component.ts'), 'utf8');

describe('element marker contract', () => {
	it('marks an element when it is interactive OR explicitly marked', () => {
		// The marker means "rendered slide element carrying the contract", not
		// "editable right now": an interaction-locked template (layout/master)
		// element keeps it. React tags every canvas element and gates
		// interactivity separately, and the four ports now match.
		expect(ELEMENT_TS).toContain(
			'readonly elementMarked = computed(() => this.interactive() || this.marked());',
		);
		expect(ELEMENT_HTML).not.toContain(`[attr.data-pptx-element]="interactive() ? 'true' : null"`);
		expect(ELEMENT_HTML).toContain(`[attr.data-pptx-element]="elementMarked() ? 'true' : null"`);
	});

	it('keeps the marker on the interaction-locked template layer', () => {
		// `interactive` stays gated on editTemplateMode (layout shapes must not
		// become selectable), while `marked` keeps them in the contract.
		expect(CANVAS_HTML).toContain(`[interactive]="interactive() && editTemplateMode()"`);
		expect(CANVAS_HTML).toContain(`[marked]="interactive()"`);
	});

	it('forwards the marker to the renderers that own their own root box', () => {
		expect(ELEMENT_HTML).toContain(`[markElement]="elementMarked()"`);
		expect(ELEMENT_HTML).not.toContain(`[markElement]="interactive()"`);
	});
});

describe('table typography contract', () => {
	it('declares the shared default font family on the table root', () => {
		// Without it an unstyled cell inherits the HOST chrome's font stack, and
		// the same deck measured different type metrics in every binding.
		expect(TABLE_HTML).toContain('[style.font-family]="defaultTableFontFamily"');
		expect(TABLE_TS).toContain('readonly defaultTableFontFamily = DEFAULT_FONT_FAMILY;');
	});
});
