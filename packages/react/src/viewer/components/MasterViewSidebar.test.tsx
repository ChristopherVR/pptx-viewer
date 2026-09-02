// @vitest-environment happy-dom
import type { MasterViewCrudAction } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MasterViewSidebar } from './MasterViewSidebar';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const CRUD_ACTIONS: MasterViewCrudAction[] = [
	{ id: 'addLayout', labelKey: 'pptx.masterView.addLayout', enabled: true },
	{
		id: 'deleteLayout',
		labelKey: 'pptx.masterView.deleteLayout',
		enabled: false,
		disabledReasonKey: 'pptx.masterView.layoutInUse',
	},
];

describe('masterViewSidebar CRUD buttons', () => {
	it('renders one button per action, disabled ones carry the reason as a title', () => {
		act(() => {
			root.render(
				<MasterViewSidebar
					slideMasters={[]}
					activeMasterIndex={0}
					activeLayoutIndex={null}
					canvasSize={{ width: 960, height: 540 }}
					masterViewTab='slides'
					notesMaster={undefined}
					handoutMaster={undefined}
					handoutSlidesPerPage={6}
					canEdit
					onSelectMaster={() => {}}
					onSelectLayout={() => {}}
					onCollapse={() => {}}
					onTabChange={() => {}}
					crudActions={CRUD_ACTIONS}
					onCrudAction={() => {}}
					onHandoutSlidesPerPageChange={() => {}}
					onNotesMasterBackgroundChange={() => {}}
					onHandoutMasterBackgroundChange={() => {}}
					onSlidesBackgroundChange={() => {}}
				/>,
			);
		});

		const addButton = container.querySelector(
			'[data-testid="pptx-master-crud-addLayout"]',
		) as HTMLButtonElement;
		const deleteButton = container.querySelector(
			'[data-testid="pptx-master-crud-deleteLayout"]',
		) as HTMLButtonElement;
		expect(addButton).not.toBeNull();
		expect(addButton.disabled).toBeFalsy();
		expect(deleteButton.disabled).toBeTruthy();
		// No i18next instance is configured in this test environment, so `t()`
		// returns the raw key; the point here is that the disabled reason key
		// reaches the title attribute at all, not the translated English text.
		expect(deleteButton.title).toBe('pptx.masterView.layoutInUse');
	});

	it('clicking an enabled button calls onCrudAction with its id', () => {
		const onCrudAction = vi.fn();
		act(() => {
			root.render(
				<MasterViewSidebar
					slideMasters={[]}
					activeMasterIndex={0}
					activeLayoutIndex={null}
					canvasSize={{ width: 960, height: 540 }}
					masterViewTab='slides'
					notesMaster={undefined}
					handoutMaster={undefined}
					handoutSlidesPerPage={6}
					canEdit
					onSelectMaster={() => {}}
					onSelectLayout={() => {}}
					onCollapse={() => {}}
					onTabChange={() => {}}
					crudActions={CRUD_ACTIONS}
					onCrudAction={onCrudAction}
					onHandoutSlidesPerPageChange={() => {}}
					onNotesMasterBackgroundChange={() => {}}
					onHandoutMasterBackgroundChange={() => {}}
					onSlidesBackgroundChange={() => {}}
				/>,
			);
		});

		const addButton = container.querySelector(
			'[data-testid="pptx-master-crud-addLayout"]',
		) as HTMLButtonElement;
		act(() => addButton.click());
		expect(onCrudAction).toHaveBeenCalledWith('addLayout');
	});
});
