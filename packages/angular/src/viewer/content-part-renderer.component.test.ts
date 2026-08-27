/**
 * Angular had no `contentPart` case in `element-renderer.component.html`, so a
 * `p:contentPart` element landed on `@default` and painted the "unsupported"
 * placeholder. That went unnoticed because real PowerPoint ink never reached
 * the InkML decoder at all: the `p14` capability set omitted `contentPart`, so
 * no deck in the corpus ever produced one.
 *
 * These assertions target the shared decision function plus the template wiring
 * (the case exists and names the component), which is exactly the split that
 * used to hide the gap: the helper maths was fine, the template never called it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ContentPartPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildContentPartStrokes,
	contentPartViewBox,
} from '../internal/shared-src/render/content-part-strokes';

const inked = (): ContentPartPptxElement =>
	({
		id: 'cp1',
		type: 'contentPart',
		x: 160,
		y: 200,
		width: 340,
		height: 128,
		inkStrokes: [
			{ path: 'M 0 64 L 8 85', color: '#E81123', width: 1.89, opacity: 1 },
			{ path: 'M 255 64 L 267 119', color: '#0078D7', width: 3.78, opacity: 1 },
		],
	}) as ContentPartPptxElement;

describe('contentPart renderer (angular)', () => {
	it('is registered and reachable from the element-renderer template', () => {
		const template = readFileSync(path.join(__dirname, 'element-renderer.component.html'), 'utf8');
		expect(template).toContain(`element().type === 'contentPart'`);
		expect(template).toContain('<pptx-content-part-renderer');

		const component = readFileSync(path.join(__dirname, 'element-renderer.component.ts'), 'utf8');
		expect(component).toContain('ContentPartRendererComponent');

		const renderer = readFileSync(
			path.join(__dirname, 'content-part-renderer.component.ts'),
			'utf8',
		);
		expect(renderer).toContain(`selector: 'pptx-content-part-renderer'`);
		expect(renderer).toContain('buildContentPartStrokes');
	});

	it('projects each ink stroke with its InkML brush colour and converted width', () => {
		const strokes = buildContentPartStrokes(inked());
		expect(strokes).toHaveLength(2);
		expect(strokes[0].color).toBe('#E81123');
		expect(strokes[0].width).toBe(1.89);
		expect(strokes[0].circles).toBeNull();
		expect(strokes[1].color).toBe('#0078D7');
		expect(contentPartViewBox(inked())).toBe('0 0 340 128');
	});

	it('projects nothing when the ink part decoded no strokes', () => {
		expect(
			buildContentPartStrokes({ ...inked(), inkStrokes: undefined } as ContentPartPptxElement),
		).toHaveLength(0);
	});

	it('projects calligraphic nib marks (not circles) for a stroke with tilt data', () => {
		const withTilt: ContentPartPptxElement = {
			...inked(),
			inkStrokes: [
				{
					path: 'M 0 0 L 10 0 L 20 0',
					color: '#000000',
					width: 2,
					opacity: 1,
					tiltAngles: [0, Math.PI / 4, Math.PI / 2],
					tiltMagnitudes: [0.2, 0.6, 0.9],
				},
			],
		};
		const [strokeView] = buildContentPartStrokes(withTilt);
		expect(strokeView.circles).toBeNull();
		expect(strokeView.nibMarks).not.toBeNull();
		expect(strokeView.nibMarks?.length).toBeGreaterThan(0);
	});

	it('wires the nib-mark ellipse branch into the template', () => {
		const renderer = readFileSync(
			path.join(__dirname, 'content-part-renderer.component.ts'),
			'utf8',
		);
		expect(renderer).toContain('stroke.nibMarks');
		expect(renderer).toContain('<ellipse');
	});
});
