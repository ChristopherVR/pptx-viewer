import { readFileSync } from 'node:fs';

import { PptxHandler as CoreHandler } from 'ooxml-core/pptx';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../index';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

describe('canonical core dependency', () => {
	it('declares an installable core automation release', () => {
		expect(manifest.dependencies['ooxml-core']).toBe('>=0.11.0 <1');
	});
	it('does not install the viewer facade and a second document engine', () => {
		expect(manifest.dependencies['pptx-viewer-core']).toBeUndefined();
	});
	it('re-exports the same engine used by the document tools', () => {
		expect(PptxHandler).toBe(CoreHandler);
	});
});
