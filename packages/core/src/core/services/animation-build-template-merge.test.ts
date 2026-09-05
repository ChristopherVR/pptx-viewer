import { describe, it, expect } from 'vitest';

import type { PptxElementAnimation, PptxNativeAnimation, PptxTimingTemplate } from '../types';
import { mergeNativeBuildTemplatesIntoEditorAnimations } from './animation-build-template-merge';

const TEMPLATES: PptxTimingTemplate[] = [
	{ level: 1, timeNodeList: { 'p:par': { '@_id': '1' } }, rawXml: { '@_lvl': '1' } },
];

function nativeAnim(targetId: string, buildTemplates?: PptxTimingTemplate[]): PptxNativeAnimation {
	return { targetId, ...(buildTemplates ? { buildTemplates } : {}) } as PptxNativeAnimation;
}

describe('mergeNativeBuildTemplatesIntoEditorAnimations', () => {
	it('is a no-op when there are no native animations', () => {
		const editor: PptxElementAnimation[] = [{ elementId: 'sp1', sequence: 'byParagraph' }];
		mergeNativeBuildTemplatesIntoEditorAnimations(undefined, editor);
		expect(editor[0]?.buildTemplates).toBeUndefined();
	});

	it('is a no-op when there are no editor animations', () => {
		mergeNativeBuildTemplatesIntoEditorAnimations([nativeAnim('sp1', TEMPLATES)], undefined);
		mergeNativeBuildTemplatesIntoEditorAnimations([nativeAnim('sp1', TEMPLATES)], []);
	});

	it('copies buildTemplates from the matching native animation onto the editor entry', () => {
		const editor: PptxElementAnimation[] = [{ elementId: 'sp1', sequence: 'byParagraph' }];
		mergeNativeBuildTemplatesIntoEditorAnimations([nativeAnim('sp1', TEMPLATES)], editor);
		expect(editor[0]?.buildTemplates).toStrictEqual(TEMPLATES);
	});

	it('does not overwrite an editor entry that already carries buildTemplates', () => {
		const ownTemplates: PptxTimingTemplate[] = [
			{ level: 2, timeNodeList: {}, rawXml: { '@_lvl': '2' } },
		];
		const editor: PptxElementAnimation[] = [
			{ elementId: 'sp1', sequence: 'byParagraph', buildTemplates: ownTemplates },
		];
		mergeNativeBuildTemplatesIntoEditorAnimations([nativeAnim('sp1', TEMPLATES)], editor);
		expect(editor[0]?.buildTemplates).toStrictEqual(ownTemplates);
	});

	it('leaves an editor entry alone when no native animation targets it', () => {
		const editor: PptxElementAnimation[] = [{ elementId: 'sp2', sequence: 'byParagraph' }];
		mergeNativeBuildTemplatesIntoEditorAnimations([nativeAnim('sp1', TEMPLATES)], editor);
		expect(editor[0]?.buildTemplates).toBeUndefined();
	});

	it('ignores a native animation with no buildTemplates', () => {
		const editor: PptxElementAnimation[] = [{ elementId: 'sp1', sequence: 'byParagraph' }];
		mergeNativeBuildTemplatesIntoEditorAnimations([nativeAnim('sp1')], editor);
		expect(editor[0]?.buildTemplates).toBeUndefined();
	});
});
