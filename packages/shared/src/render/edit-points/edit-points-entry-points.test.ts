import { describe, expect, it } from 'vitest';

import { buildContextMenuEntries } from '../context-menu-commands';
import {
	isDrawingToolVisible,
	isEditPointsEnabled,
	resolveCustomization,
} from '../customization/customization-resolve';

describe('edit Points context-menu entry', () => {
	it('sits under Edit Text for an editable shape', () => {
		const ids = buildContextMenuEntries({ elementType: 'shape', editPoints: 'available' }).map(
			(e) => e.id,
		);
		expect(ids.indexOf('edit-points')).toBe(ids.indexOf('edit-text') + 1);
	});

	it('is greyed out for a noEditPoints lock', () => {
		const entry = buildContextMenuEntries({ elementType: 'shape', editPoints: 'locked' }).find(
			(e) => e.id === 'edit-points',
		);
		expect(entry?.disabled).toBeTruthy();
	});

	it('is absent for unsupported elements and multi-selections', () => {
		const has = (ctx: Parameters<typeof buildContextMenuEntries>[0]) =>
			buildContextMenuEntries(ctx).some((e) => e.id === 'edit-points');
		expect(has({ elementType: 'picture', editPoints: 'unsupported' })).toBeFalsy();
		expect(has({ elementType: 'shape' })).toBeFalsy();
		expect(
			has({ elementType: 'shape', editPoints: 'available', hasMultiSelection: true }),
		).toBeFalsy();
	});
});

describe('edit Points customisation', () => {
	it('is on by default', () => {
		const resolved = resolveCustomization(undefined);
		expect(isEditPointsEnabled(resolved)).toBeTruthy();
		expect(isDrawingToolVisible(resolved, 'curve')).toBeTruthy();
	});

	it('switches off with the feature or the menu entry', () => {
		const byFeature = resolveCustomization({ disabledFeatures: ['editPoints'] });
		expect(isEditPointsEnabled(byFeature)).toBeFalsy();
		expect(byFeature.hiddenElementCommands.has('edit-points')).toBeTruthy();
		const byEntry = resolveCustomization({
			contextMenu: { hiddenElementCommands: ['edit-points'] },
		});
		expect(isEditPointsEnabled(byEntry)).toBeFalsy();
	});

	it('hides individual Edit Points commands and drawing tools', () => {
		const resolved = resolveCustomization({
			contextMenu: { hiddenEditPointsCommands: ['delete-segment'] },
			hiddenDrawingTools: ['freeformShape'],
		});
		expect(resolved.hiddenEditPointsCommands.has('delete-segment')).toBeTruthy();
		expect(isDrawingToolVisible(resolved, 'freeformShape')).toBeFalsy();
		expect(isDrawingToolVisible(resolved, 'curve')).toBeTruthy();
	});
});
