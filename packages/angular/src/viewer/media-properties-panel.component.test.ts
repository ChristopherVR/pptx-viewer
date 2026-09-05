/**
 * media-properties-panel.component.test.ts: the properties panel's raw
 * "Trim end" number field used to bind `trimEndMs` directly.
 *
 * `trimEndMs` is `p14:trim/@end`'s distance from the clip's TAIL
 * (COM-verified, see shared `media-trim-range.ts`), not an absolute stop
 * time. React's `MediaInspector` and Vue's `MediaPropertiesPanel.vue` show an
 * absolute "End" position and convert back to the tail distance on commit;
 * this field skipped that conversion, so typing "the last 5s" of a 20s clip
 * required computing `20000 - 5000` by hand instead of typing `15000`.
 *
 * No Angular TestBed here (see `media-trim-timeline.component.test.ts` /
 * `action-settings-panel.component.test.ts`): this pins the source to the
 * shared conversion the template/computed use, plus the underlying math.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { mediaTrimEndAbsoluteMs, mediaTrimEndMsFromAbsoluteMs } from '../internal/shared';

describe('mediaPropertiesPanelComponent trim-end field', () => {
	it('reads the absolute end position through the shared conversion, not the raw field', () => {
		const source = readFileSync(
			path.join(__dirname, 'media-properties-panel.component.ts'),
			'utf8',
		);
		expect(source).toMatch(/trimEndAbsoluteMs = computed\(\(\) =>\s*mediaTrimEndAbsoluteMs\(/);
		expect(source).toMatch(/trimEndMs: mediaTrimEndMsFromAbsoluteMs\(/);
		expect(source).not.toContain('[value]="media().trimEndMs ?? 0"');
	});

	it('shows 15000 (15s) for a 20s clip with trimEndMs=5000', () => {
		expect(mediaTrimEndAbsoluteMs(20000, 5000)).toBe(15000);
	});

	it('stores 5000 (p14:trim/@end) when the user types an absolute end of 15000 on a 20s clip', () => {
		expect(mediaTrimEndMsFromAbsoluteMs(20000, 15000)).toBe(5000);
	});
});
