import * as core from 'pptx-viewer-core/chart';
import { describe, expect, it } from 'vitest';

import * as blankDisplay from './chart-blank-display';
import * as boxStats from './chart-box-whisker-stats';
import * as regression from './chart-overlays-regression';
import * as stackedSeries from './chart-stacked-series';

describe('chart data compatibility entries', () => {
	it('retains the original exports as the canonical core functions', () => {
		const canonical = { ...core };
		for (const entry of [regression, boxStats, blankDisplay, stackedSeries]) {
			for (const [name, value] of Object.entries(entry)) {
				expect(value).toBe(canonical[name as keyof typeof canonical]);
			}
		}
	});
});
