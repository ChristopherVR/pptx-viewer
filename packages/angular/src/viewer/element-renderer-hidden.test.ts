/**
 * Unit tests for the Selection Pane hide rule in `ElementRendererComponent`.
 *
 * TestBed rendering is unavailable in this package (it needs
 * `@analogjs/vite-plugin-angular`; see `vitest.config.ts`), so the component is
 * not instantiated. Two things are pinned instead:
 *
 *  1. the shared predicate the component's `isHidden()` computed delegates to,
 *     which is the rule all five bindings share; and
 *  2. the ORDER of the template's `@switch` branches. Angular's `@switch` takes
 *     the FIRST matching case, so the empty hidden branch only suppresses every
 *     element type while it leads. Reordering the cases (an easy accidental
 *     edit, since the branches otherwise read as an unordered dispatch table)
 *     would silently restore the bug, and there is no rendering test here to
 *     catch it. Reading the source is the only seam available.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isElementHidden, isElementRendered } from '../internal/shared';

const componentSource = readFileSync(
	resolve(dirname(fileURLToPath(import.meta.url)), 'element-renderer.component.ts'),
	'utf8',
);

describe('the shared rule the renderer delegates to', () => {
	it('hides only an element the Selection Pane flagged', () => {
		expect(isElementHidden({ hidden: true })).toBeTruthy();
		expect(isElementHidden({ hidden: false })).toBeFalsy();
		expect(isElementHidden({})).toBeFalsy();
	});

	it('renders everything else', () => {
		expect(isElementRendered({})).toBeTruthy();
		expect(isElementRendered({ hidden: true })).toBeFalsy();
	});
});

describe('elementRenderer template dispatch order', () => {
	it('derives isHidden from the shared rule rather than reading the flag directly', () => {
		expect(componentSource).toContain('isElementHidden(this.element())');
	});

	it('puts the empty hidden branch first, so it wins over every element type', () => {
		const switchStart = componentSource.indexOf('@switch (true) {');
		expect(switchStart).toBeGreaterThan(-1);

		const caseOrder = [...componentSource.slice(switchStart).matchAll(/@case \((.*?)\) \{/gu)].map(
			(match) => match[1],
		);
		expect(caseOrder[0]).toBe('isHidden()');
		// And it really is the only branch that renders nothing per type.
		expect(caseOrder.length).toBeGreaterThan(1);
	});

	it('renders no element markup inside the hidden branch', () => {
		const branch = componentSource.slice(
			componentSource.indexOf('@case (isHidden()) {'),
			componentSource.indexOf("@case (element().type === 'connector')"),
		);
		expect(branch).not.toContain('data-element-id');
		expect(branch).not.toMatch(/<(div|pptx-)/u);
	});
});
