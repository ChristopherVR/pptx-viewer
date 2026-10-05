/**
 * A flat line shape (`prst="line"`, zero height) rendered through the real
 * templates of `ElementRendererShapeComponent` and
 * `ReflectionMirrorContentComponent`. Its outline `<svg>` gets no viewBox and
 * must keep a 1px minimum box, or the browser draws nothing.
 */
import { readFileSync } from 'node:fs';

import { NgStyle } from '@angular/common';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { resolveViewerComponentResources } from './component-resources.test-support';
import { ElementRendererShapeComponent } from './element-renderer-shape.component';
import { ReflectionMirrorContentComponent } from './reflection-mirror-content.component';

beforeAll(async () => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	await resolveViewerComponentResources();
});
afterEach(() => TestBed.resetTestingModule());

const rule = {
	id: 'rule-1',
	type: 'shape',
	x: 0,
	y: 0,
	width: 400,
	height: 0,
	shapeType: 'line',
	shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
} as unknown as PptxElement;

function render<T>(component: Type<T>, template?: string): HTMLElement {
	TestBed.configureTestingModule({ imports: [component] });
	TestBed.overrideComponent(component, {
		set: {
			...(template ? { templateUrl: '', template } : {}),
			imports: [NgStyle],
			schemas: [NO_ERRORS_SCHEMA],
		},
	});
	const fixture = TestBed.createComponent(component);
	// Plain JIT does not discover signal-input metadata, so hand the input a signal.
	Object.assign(fixture.componentInstance as object, { element: signal(rule) });
	fixture.detectChanges();
	return fixture.nativeElement as HTMLElement;
}

function expectFlatOutline(root: HTMLElement): void {
	const svg = root.querySelector('svg:has(path[d="M 0 0 L 400 0"])') as SVGSVGElement | null;
	expect(svg).not.toBeNull();
	expect(svg?.getAttribute('viewBox')).toBeNull();
	expect(svg?.style.minWidth).toBe('1px');
	expect(svg?.style.minHeight).toBe('1px');
}

describe('flat line outline <svg>', () => {
	it('keeps the shape renderer outline at least 1px, with no viewBox', () => {
		expectFlatOutline(
			render(
				ElementRendererShapeComponent,
				readFileSync(`${import.meta.dirname}/element-renderer-shape.component.html`, 'utf8'),
			),
		);
	});

	it('keeps the reflection mirror outline at least 1px, with no viewBox', () => {
		expectFlatOutline(render(ReflectionMirrorContentComponent));
	});
});
