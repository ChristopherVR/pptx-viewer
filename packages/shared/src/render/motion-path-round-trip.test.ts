/**
 * Round-trip guard for motion-path authoring: a path applied through the shared
 * authoring helpers must survive save + reload AND leave real OOXML behind, not
 * just an editor-private extension. Without the second half, PowerPoint would
 * open the deck with no animation at all.
 */
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyMotionPathPreset, clearMotionPath, motionPathFor } from './motion-path-authoring';
import { motionPathPresetById } from './motion-path-presets';

async function saveAndReload(handler: PptxHandler, slides: PptxSlide[]) {
	const bytes = await handler.save(slides);
	const reloaded = new PptxHandler();
	const data = await reloaded.load(bytes.buffer as ArrayBuffer);
	return { data, bytes };
}

describe('motion path save/reload round trip', () => {
	it('keeps an applied preset path and writes it as a p:animMotion node', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Motion',
			initialSlideCount: 1,
		});
		const slide = data.slides[0];
		const elementId = 'shape-under-test';
		const slides: PptxSlide[] = [
			{ ...slide, animations: applyMotionPathPreset([], elementId, 'arcUp') },
		];

		const { data: reloaded, bytes } = await saveAndReload(handler, slides);

		const expected = motionPathPresetById('arcUp')?.path;
		expect(motionPathFor(reloaded.slides[0].animations ?? [], elementId)).toBe(expected);
		// The native timing tree must carry it too, so PowerPoint (and this
		// viewer's own slide-show engine) plays the motion after a reload.
		const native = reloaded.slides[0].nativeAnimations ?? [];
		expect(native.some((animation) => animation.motionPath === expected)).toBeTruthy();
		expect(new TextDecoder().decode(bytes).includes('animMotion')).toBeTruthy();
	});

	it('preserves the timing fields the panel edits alongside the path', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Motion timing',
			initialSlideCount: 1,
		});
		const elementId = 'shape-under-test';
		const animations = applyMotionPathPreset([], elementId, 'lineRight').map((animation) => ({
			...animation,
			durationMs: 3200,
			delayMs: 400,
			trigger: 'afterPrevious' as const,
		}));

		const { data: reloaded } = await saveAndReload(handler, [{ ...data.slides[0], animations }]);

		const entry = (reloaded.slides[0].animations ?? [])[0];
		expect(entry).toMatchObject({
			motionPath: 'M 0 0 L 0.25 0',
			durationMs: 3200,
			delayMs: 400,
			trigger: 'afterPrevious',
		});
	});

	it('drops the animation entirely once the path is cleared', async () => {
		const { handler, data } = await PptxHandler.create({
			title: 'Motion cleared',
			initialSlideCount: 1,
		});
		const elementId = 'shape-under-test';
		const applied = applyMotionPathPreset([], elementId, 'circle');

		const { data: reloaded } = await saveAndReload(handler, [
			{ ...data.slides[0], animations: clearMotionPath(applied, elementId) },
		]);

		expect(reloaded.slides[0].animations ?? []).toHaveLength(0);
	});
});
