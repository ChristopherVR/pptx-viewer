import { XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { PptxHandler } from '../../PptxHandler';
import type { PptxData } from '../../types/presentation';
import {
	deleteLayout,
	deleteSlideMaster,
	duplicateLayout,
	duplicateSlideMaster,
	insertLayout,
	insertSlideMaster,
	renameLayout,
	renameSlideMaster,
} from './master-layout-crud';
import { PresentationBuilder } from './PresentationBuilder';

async function freshPresentation(): Promise<{ handler: PptxHandler; data: PptxData }> {
	const { handler, data } = await PresentationBuilder.create();
	return { handler, data };
}

/** Every slideLayout/slideMaster part path actually present in the saved ZIP. */
async function partPaths(handler: PptxHandler, data: PptxData, pattern: RegExp): Promise<string[]> {
	const JSZip = (await import('jszip')).default;
	const bytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(bytes);
	const paths: string[] = [];
	zip.forEach((relativePath) => {
		if (pattern.test(relativePath)) {
			paths.push(relativePath);
		}
	});
	return paths;
}

describe('master-layout-crud: layouts', () => {
	describe('duplicateLayout', () => {
		it('deep-copies a layout under the same master with a suffixed name', async () => {
			const { handler, data } = await freshPresentation();
			const source = data.slideMasters![0].layouts!.find((l) => l.name === 'Title Slide')!;

			const result = await duplicateLayout(handler, data, source.path);
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			expect(result.layoutId).not.toBe(source.path);

			const master = result.data.slideMasters![0];
			const duplicated = master.layouts!.find((l) => l.path === result.layoutId);
			expect(duplicated?.name).toBe('Title Slide 2');
			// The source layout is untouched.
			expect(master.layouts!.some((l) => l.name === 'Title Slide')).toBeTruthy();

			// The result is a valid package that saves and re-loads cleanly again.
			const bytes = await result.handler.save(result.data.slides);
			expect(bytes.byteLength).toBeGreaterThan(0);
		});

		it('returns notFound for an unknown layout id', async () => {
			const { handler, data } = await freshPresentation();
			const result = await duplicateLayout(handler, data, 'ppt/slideLayouts/nope.xml');
			expect(result).toStrictEqual({ ok: false, reason: 'notFound' });
		});
	});

	describe('deleteLayout', () => {
		it('removes an unused layout and prunes sldLayoutIdLst', async () => {
			const { handler, data } = await freshPresentation();
			const target = data.slideMasters![0].layouts!.find((l) => l.name === 'Blank')!;
			const beforeCount = data.slideMasters![0].layouts!.length;

			const result = await deleteLayout(handler, data, target.path);
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			const master = result.data.slideMasters![0];
			expect(master.layouts!).toHaveLength(beforeCount - 1);
			expect(master.layouts!.some((l) => l.path === target.path)).toBeFalsy();

			const layoutParts = await partPaths(
				result.handler,
				result.data,
				/^ppt\/slideLayouts\/slideLayout\d+\.xml$/,
			);
			expect(layoutParts).not.toContain(target.path);

			// Re-saving after the delete still produces well-formed XML.
			const zip = await (
				await import('jszip')
			).default.loadAsync(await result.handler.save(result.data.slides));
			const masterXml = await zip.file(master.path)?.async('string');
			expect(XMLValidator.validate(masterXml!)).toBeTruthy();
		});

		it('refuses to delete a layout a slide references', async () => {
			const { handler, data, createSlide } = await PresentationBuilder.create();
			const target = data.slideMasters![0].layouts!.find((l) => l.name === 'Blank')!;
			data.slides.push(createSlide('Blank').build());

			const result = await deleteLayout(handler, data, target.path);
			expect(result).toStrictEqual({ ok: false, reason: 'inUse' });
		});

		it('returns notFound for an unknown layout id', async () => {
			const { handler, data } = await freshPresentation();
			const result = await deleteLayout(handler, data, 'ppt/slideLayouts/nope.xml');
			expect(result).toStrictEqual({ ok: false, reason: 'notFound' });
		});
	});

	describe('renameLayout', () => {
		it('renames a layout and the change survives a reload', async () => {
			const { handler, data } = await freshPresentation();
			const target = data.slideMasters![0].layouts!.find((l) => l.name === 'Blank')!;

			const result = await renameLayout(handler, data, target.path, 'My Blank');
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			const master = result.data.slideMasters![0];
			expect(master.layouts!.find((l) => l.path === target.path)?.name).toBe('My Blank');
		});
	});

	describe('insertLayout', () => {
		it('adds a default layout when no definition is supplied', async () => {
			const { handler, data } = await freshPresentation();
			const beforeCount = data.slideMasters![0].layouts!.length;
			const masterId = data.slideMasters![0].path;

			const result = await insertLayout(handler, data, masterId);
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			const master = result.data.slideMasters![0];
			expect(master.layouts!).toHaveLength(beforeCount + 1);
			expect(master.layouts!.some((l) => l.path === result.layoutId)).toBeTruthy();
		});

		it('returns notFound for an unknown master id', async () => {
			const { handler, data } = await freshPresentation();
			const result = await insertLayout(handler, data, 'ppt/slideMasters/nope.xml');
			expect(result).toStrictEqual({ ok: false, reason: 'notFound' });
		});
	});
});

describe('master-layout-crud: slide masters', () => {
	describe('insertSlideMaster', () => {
		it('adds a second master with the standard 11 layouts', async () => {
			const { handler, data } = await freshPresentation();
			const result = await insertSlideMaster(handler, data);
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			expect(result.data.slideMasters!).toHaveLength(2);
			const newMaster = result.data.slideMasters!.find((m) => m.path === result.masterId)!;
			expect(newMaster.layouts!).toHaveLength(11);
			// Shares the first master's theme rather than forking a new one.
			expect(newMaster.themePath).toBe(data.slideMasters![0].themePath);

			const zip = await (
				await import('jszip')
			).default.loadAsync(await result.handler.save(result.data.slides));
			const masterXml = await zip.file(result.masterId)?.async('string');
			expect(XMLValidator.validate(masterXml!)).toBeTruthy();
		});
	});

	describe('duplicateSlideMaster', () => {
		it('deep-copies a master and its layouts with a numeric-prefix name', async () => {
			const { handler, data } = await freshPresentation();
			const sourceId = data.slideMasters![0].path;
			const sourceLayoutCount = data.slideMasters![0].layouts!.length;

			const result = await duplicateSlideMaster(handler, data, sourceId);
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			expect(result.data.slideMasters!).toHaveLength(2);
			const duplicated = result.data.slideMasters!.find((m) => m.path === result.masterId)!;
			expect(duplicated.layouts!).toHaveLength(sourceLayoutCount);
			expect(duplicated.name).toBe('1_Office Theme');
		});

		it('returns notFound for an unknown master id', async () => {
			const { handler, data } = await freshPresentation();
			const result = await duplicateSlideMaster(handler, data, 'ppt/slideMasters/nope.xml');
			expect(result).toStrictEqual({ ok: false, reason: 'notFound' });
		});
	});

	describe('deleteSlideMaster', () => {
		it('refuses to delete the only master', async () => {
			const { handler, data } = await freshPresentation();
			const result = await deleteSlideMaster(handler, data, data.slideMasters![0].path);
			expect(result).toStrictEqual({ ok: false, reason: 'lastMaster' });
		});

		it('refuses to delete a master a slide still uses via one of its layouts', async () => {
			const { handler, data, createSlide } = await PresentationBuilder.create();
			const inserted = await insertSlideMaster(handler, data);
			expect(inserted.ok).toBeTruthy();
			if (!inserted.ok) {
				return;
			}
			const newMaster = inserted.data.slideMasters!.find((m) => m.path === inserted.masterId)!;
			const layoutOnNewMaster = newMaster.layouts![0];
			inserted.data.slides.push(createSlide().build());
			inserted.data.slides[0].layoutPath = layoutOnNewMaster.path;

			const result = await deleteSlideMaster(inserted.handler, inserted.data, inserted.masterId);
			expect(result).toStrictEqual({ ok: false, reason: 'inUse' });
		});

		it('removes an unused master and its layouts, pruning sldMasterIdLst', async () => {
			const { handler, data } = await freshPresentation();
			const inserted = await insertSlideMaster(handler, data);
			expect(inserted.ok).toBeTruthy();
			if (!inserted.ok) {
				return;
			}

			const result = await deleteSlideMaster(inserted.handler, inserted.data, inserted.masterId);
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			expect(result.data.slideMasters!).toHaveLength(1);
			expect(result.data.slideMasters!.some((m) => m.path === inserted.masterId)).toBeFalsy();

			const masterParts = await partPaths(
				result.handler,
				result.data,
				/^ppt\/slideMasters\/slideMaster\d+\.xml$/,
			);
			expect(masterParts).not.toContain(inserted.masterId);
		});
	});

	describe('renameSlideMaster', () => {
		it('renames a master and the change survives a reload', async () => {
			const { handler, data } = await freshPresentation();
			const masterId = data.slideMasters![0].path;

			const result = await renameSlideMaster(handler, data, masterId, 'Corporate Theme');
			expect(result.ok).toBeTruthy();
			if (!result.ok) {
				return;
			}
			expect(result.data.slideMasters!.find((m) => m.path === masterId)?.name).toBe(
				'Corporate Theme',
			);
		});
	});
});
