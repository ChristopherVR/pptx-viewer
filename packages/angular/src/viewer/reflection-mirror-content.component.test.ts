/**
 * reflection-mirror-content.component.test.ts
 *
 * `ReflectionMirrorContentComponent` paints the full mirrored CONTENT inside
 * an `a:reflection` wrapper (fill, outline, text body, and - for a group -
 * its children), replacing the earlier "resolved fill / picture <img> only"
 * mirror. No Angular TestBed here, matching every other `*-renderer`
 * component test in this package (see `accessibility-text-panel.component.test.ts`):
 * this pins the source wiring (selector, self-recursion for groups, and every
 * mount point that must reference the component) plus the pure logic
 * (`getReflectionOverlay`, covered in `element-effect-defs.test.ts`).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function read(file: string): string {
	return readFileSync(path.join(__dirname, file), 'utf8');
}

describe('reflectionMirrorContentComponent wiring', () => {
	const source = read('reflection-mirror-content.component.ts');
	// Only the inline `template:` literal, not the doc comment above the
	// class (which mentions both terms in prose), so the two "stays inert" /
	// "never calls" checks below assert what the rendered DOM actually gets.
	const template = source.slice(source.indexOf('template: `'), source.lastIndexOf('`,'));

	it('declares the pptx-reflection-mirror-content selector', () => {
		expect(source).toContain("selector: 'pptx-reflection-mirror-content'");
	});

	it('recurses into itself for a group child (self-referencing standalone component)', () => {
		expect(source).toContain('imports: [');
		expect(source).toContain('ReflectionMirrorContentComponent');
		expect(source).toContain('<pptx-reflection-mirror-content');
	});

	it('reuses the SAME pure builders the live element uses, not a re-derived cascade', () => {
		expect(source).toContain('getShapeFillStrokeStyle');
		expect(source).toContain('getEffectFillOverlay');
		expect(source).toContain('getStrokeOutline');
		expect(source).toContain('getSoftEdgeFilterDef');
		expect(source).toContain('getSubpathFillOverlay');
	});

	it('reuses SlideTextBlockComponent for text, not a simplified re-paint', () => {
		expect(source).toContain('SlideTextBlockComponent');
		expect(template).toContain('<pptx-slide-text-block');
		// The mirror is inert: SlideTextBlockComponent's `interactive` input is
		// left at its default (`false`), never passed `true` here.
		expect(template).not.toMatch(/pptx-slide-text-block[^>]*\[interactive\]/u);
	});

	it('stays inert: no data-element-id, no interactive bindings', () => {
		expect(template).not.toContain('data-element-id');
		expect(template).not.toContain('(click)');
	});

	it('never calls getReflectionOverlay itself, so a mirror cannot grow a mirror of itself', () => {
		expect(template).not.toContain('getReflectionOverlay');
	});

	it('declares a topLevel input defaulting to true, so the outer mount point needs no wiring', () => {
		expect(source).toMatch(/readonly topLevel = input<boolean>\(true\)/u);
	});

	it('suppresses THIS element’s own reflection only when topLevel, not its children', () => {
		// The recursive group-child call passes `[topLevel]="false"`: a child is
		// not the element being mirrored, so its OWN reflection (if any) must
		// still render, nested inside the parent's mirror.
		expect(template).toContain('[topLevel]="false"');
		// Both a re-mirrored self (nested reflection) and the group-child
		// recursion exist; the nested-self calls pass `[topLevel]="true"`.
		expect(template).toContain('[topLevel]="true"');
	});

	it('renders its own nested reflection (ownReflection) in both the group and leaf branches', () => {
		const occurrences = template.match(/ownReflection\(\)/gu) ?? [];
		// Once in each branch's `@if` guard.
		expect(occurrences.length).toBeGreaterThanOrEqual(2);
	});

	it('applies boxStyle (group shadow/glow/soft-edge filter) to the group wrapper too, not just the leaf box', () => {
		const groupBranchStart = template.indexOf('@if (isGroup())');
		const groupBranchEnd = template.indexOf('} @else {', groupBranchStart);
		const groupBranch = template.slice(groupBranchStart, groupBranchEnd);
		expect(groupBranch).toContain('[ngStyle]="boxStyle()"');
		expect(groupBranch).toContain('softEdge()');
	});
});

describe('group-level a:reflection mounting (element-renderer.component.html)', () => {
	const html = read('element-renderer.component.html');

	it('mounts the reflection mirror inside the group branch, not only the shape branch', () => {
		const groupCaseStart = html.indexOf("@case (element().type === 'group')");
		const groupCaseEnd = html.indexOf('@case (isImageLike())', groupCaseStart);
		expect(groupCaseStart).toBeGreaterThan(-1);
		const groupCase = html.slice(groupCaseStart, groupCaseEnd);
		expect(groupCase).toContain('reflection()');
		expect(groupCase).toContain('<pptx-reflection-mirror-content');
	});
});

describe('picture a:reflection mounting (image-renderer.component.ts)', () => {
	const source = read('image-renderer.component.ts');

	it('mounts the reflection mirror (regression: this never rendered one before)', () => {
		expect(source).toContain('getReflectionOverlay');
		expect(source).toContain('<pptx-reflection-mirror-content');
		expect(source).toContain('ReflectionMirrorContentComponent');
	});
});
