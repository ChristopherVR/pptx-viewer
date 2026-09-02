import { PresentationBuilder } from 'pptx-viewer-core';
import type { PptxData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { MasterViewTarget } from './master-view';
import {
	applyMasterViewCrudAction,
	masterViewCrudActions,
	masterViewCrudFailureKey,
} from './master-view-crud';

function actionMap(data: PptxData, target: MasterViewTarget) {
	return Object.fromEntries(masterViewCrudActions(data, target).map((a) => [a.id, a]));
}

describe('masterViewCrudFailureKey', () => {
	it("names the part kind for core's single inUse reason", () => {
		expect(masterViewCrudFailureKey('deleteMaster', 'inUse')).toBe('pptx.masterView.masterInUse');
		expect(masterViewCrudFailureKey('deleteLayout', 'inUse')).toBe('pptx.masterView.layoutInUse');
	});

	it('maps the other reasons one-to-one', () => {
		expect(masterViewCrudFailureKey('deleteMaster', 'lastMaster')).toBe(
			'pptx.masterView.lastMaster',
		);
		expect(masterViewCrudFailureKey('renameLayout', 'notFound')).toBe('pptx.masterView.notFound');
	});
});

describe('masterViewCrudActions', () => {
	it('returns [] outside the slides tab', () => {
		const notesTarget: MasterViewTarget = { tab: 'notes', masterIndex: 0, layoutIndex: null };
		expect(
			masterViewCrudActions({ slides: [], slideMasters: [] } as unknown as PptxData, notesTarget),
		).toStrictEqual([]);
	});

	it('disables layout-scoped actions when the master itself is selected', async () => {
		const { data } = await PresentationBuilder.create();
		const masterTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: null };
		const actions = actionMap(data, masterTarget);
		expect(actions.duplicateLayout.enabled).toBeFalsy();
		expect(actions.deleteLayout.enabled).toBeFalsy();
		expect(actions.renameLayout.enabled).toBeFalsy();
		expect(actions.addLayout.enabled).toBeTruthy();
	});

	it('enables deleteLayout for an unused layout and disables it for one a slide uses', async () => {
		const { data, createSlide } = await PresentationBuilder.create();
		const blankIndex = data.slideMasters![0].layouts!.findIndex((l) => l.name === 'Blank');
		const layoutTarget: MasterViewTarget = {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: blankIndex,
		};
		expect(actionMap(data, layoutTarget).deleteLayout).toMatchObject({ enabled: true });

		data.slides.push(createSlide('Blank').build());
		const actions = actionMap(data, layoutTarget);
		expect(actions.deleteLayout.enabled).toBeFalsy();
		expect(actions.deleteLayout.disabledReasonKey).toBe('pptx.masterView.layoutInUse');
	});

	it('disables deleteMaster with lastMaster when there is only one master', async () => {
		const { data } = await PresentationBuilder.create();
		const masterTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: null };
		const actions = actionMap(data, masterTarget);
		expect(actions.deleteMaster.enabled).toBeFalsy();
		expect(actions.deleteMaster.disabledReasonKey).toBe('pptx.masterView.lastMaster');
	});
});

describe('applyMasterViewCrudAction', () => {
	it('addLayout selects the newly-created layout', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const masterTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: null };
		const result = await applyMasterViewCrudAction(handler, data, 'addLayout', masterTarget);
		expect(result.ok).toBeTruthy();
		if (!result.ok) {
			return;
		}
		expect(result.target.layoutIndex).not.toBeNull();
		const selected = result.data.slideMasters![0].layouts![result.target.layoutIndex!];
		expect(selected).toBeDefined();
	});

	it('duplicateLayout selects the duplicate', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const titleIndex = data.slideMasters![0].layouts!.findIndex((l) => l.name === 'Title Slide');
		const layoutTarget: MasterViewTarget = {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: titleIndex,
		};
		const result = await applyMasterViewCrudAction(handler, data, 'duplicateLayout', layoutTarget);
		expect(result.ok).toBeTruthy();
		if (!result.ok) {
			return;
		}
		const selected = result.data.slideMasters![0].layouts![result.target.layoutIndex!];
		expect(selected.name).toBe('Title Slide 2');
	});

	it('deleteLayout clears the layout selection back to the master', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const blankIndex = data.slideMasters![0].layouts!.findIndex((l) => l.name === 'Blank');
		const layoutTarget: MasterViewTarget = {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: blankIndex,
		};
		const result = await applyMasterViewCrudAction(handler, data, 'deleteLayout', layoutTarget);
		expect(result.ok).toBeTruthy();
		if (!result.ok) {
			return;
		}
		expect(result.target.layoutIndex).toBeNull();
		expect(result.target.masterIndex).toBe(0);
	});

	it('deleteLayout refuses (inUse) when a slide references it, leaving data untouched', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const blankIndex = data.slideMasters![0].layouts!.findIndex((l) => l.name === 'Blank');
		data.slides.push(createSlide('Blank').build());
		const layoutTarget: MasterViewTarget = {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: blankIndex,
		};
		const result = await applyMasterViewCrudAction(handler, data, 'deleteLayout', layoutTarget);
		expect(result).toStrictEqual({ ok: false, reason: 'inUse' });
	});

	it('renameLayout requires options.name', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const blankIndex = data.slideMasters![0].layouts!.findIndex((l) => l.name === 'Blank');
		const layoutTarget: MasterViewTarget = {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: blankIndex,
		};
		const missingName = await applyMasterViewCrudAction(
			handler,
			data,
			'renameLayout',
			layoutTarget,
		);
		expect(missingName).toStrictEqual({ ok: false, reason: 'notFound' });

		const renamed = await applyMasterViewCrudAction(handler, data, 'renameLayout', layoutTarget, {
			name: 'My Blank',
		});
		expect(renamed.ok).toBeTruthy();
		if (!renamed.ok) {
			return;
		}
		expect(renamed.data.slideMasters![0].layouts![blankIndex].name).toBe('My Blank');
	});

	it('addMaster then deleteMaster round-trips the selection back to master 0', async () => {
		const { handler, data } = await PresentationBuilder.create();
		const masterTarget: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: null };
		const added = await applyMasterViewCrudAction(handler, data, 'addMaster', masterTarget);
		expect(added.ok).toBeTruthy();
		if (!added.ok) {
			return;
		}
		expect(added.target.masterIndex).toBe(1);

		const deleted = await applyMasterViewCrudAction(
			added.handler,
			added.data,
			'deleteMaster',
			added.target,
		);
		expect(deleted.ok).toBeTruthy();
		if (!deleted.ok) {
			return;
		}
		expect(deleted.data.slideMasters!).toHaveLength(1);
		expect(deleted.target.masterIndex).toBe(0);
	});
});
