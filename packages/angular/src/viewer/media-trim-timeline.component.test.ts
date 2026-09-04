/**
 * media-trim-timeline.component.test.ts: G19 regression for the trim scrubber's
 * end label.
 *
 * `trimEndMs` is `p14:trim/@end`'s distance from the clip's tail (COM-verified,
 * see shared `media-trim-timeline.ts`), not an absolute stop time. The label
 * used to print `trimEndMs / 1000` directly, so a 20s clip trimmed 5s off its
 * tail read "0:05.0" while the handle (already on the shared geometry) sat at
 * 15s. No Angular TestBed here (see `action-settings-panel.component.test.ts`),
 * so this pins the label to the shared conversion the template renders.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { formatMediaTime, mediaTimelineGeometry, mediaTrimEndSeconds } from '../internal/shared';

describe('mediaTrimTimelineComponent end label', () => {
	it('derives the end label from the shared distance-from-tail conversion', () => {
		const source = readFileSync(path.join(__dirname, 'media-trim-timeline.component.ts'), 'utf8');
		expect(source).toMatch(/endLabel = computed\(\(\) =>\s*formatMediaTime\(mediaTrimEndSeconds\(/);
		expect(source).not.toContain('this.trimEndMs() / 1000');
	});

	it('agrees with the handle geometry for a tail trim', () => {
		expect(formatMediaTime(mediaTrimEndSeconds(20, 5000))).toBe('0:15.0');
		expect(mediaTimelineGeometry(20, 0, 5000, 0).endPercent).toBe(75);
		expect(formatMediaTime(mediaTrimEndSeconds(20, 0))).toBe('0:20.0');
	});
});
