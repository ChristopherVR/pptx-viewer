// @vitest-environment happy-dom
import type { PptxHandler, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import { PptxHandler as PptxHandlerCtor } from 'pptx-viewer-core';
import type { MasterViewTarget } from 'pptx-viewer-shared';
import React, { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMasterViewCrud } from './useMasterViewCrud';

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

interface HarnessHandle {
	handleCrudAction: (id: 'addLayout' | 'deleteLayout') => Promise<void>;
	getCrudActions: () => ReturnType<typeof useMasterViewCrud>['crudActions'];
	getSlideMasters: () => PptxSlideMaster[];
}

function Harness({
	handler,
	initialData,
	target,
	onReady,
}: {
	handler: PptxHandler;
	initialData: { slides: PptxSlide[]; slideMasters: PptxSlideMaster[] };
	target: MasterViewTarget;
	onReady: (handle: HarnessHandle) => void;
}): React.ReactElement {
	const handlerRef = useRef(handler);
	const [slides, setSlides] = useState(initialData.slides);
	const [slideMasters, setSlideMasters] = useState(initialData.slideMasters);
	const [, setActiveMasterIndex] = useState(target.masterIndex);
	const [, setActiveLayoutIndex] = useState(target.layoutIndex);
	const markDirty = vi.fn();
	const pushToast = vi.fn();

	const result = useMasterViewCrud({
		handlerRef,
		slides,
		slideMasters,
		target,
		setSlides,
		setSlideMasters,
		setActiveMasterIndex,
		setActiveLayoutIndex,
		markDirty,
		pushToast,
	});

	onReady({
		handleCrudAction: result.handleCrudAction,
		getCrudActions: () => result.crudActions,
		getSlideMasters: () => slideMasters,
	});

	return <div />;
}

describe('useMasterViewCrud', () => {
	it('disables deleteLayout for a layout still used by a slide', async () => {
		const { handler, data } = await PptxHandlerCtor.create({ initialSlideCount: 1 });
		try {
			const master = data.slideMasters![0];
			const inUseLayout = master.layouts!.find((l) => l.path === data.slides[0].layoutPath)!;
			const target: MasterViewTarget = {
				tab: 'slides',
				masterIndex: 0,
				layoutIndex: master.layouts!.indexOf(inUseLayout),
			};

			let handle: HarnessHandle | null = null;
			act(() => {
				root.render(
					<Harness
						handler={handler}
						initialData={{ slides: data.slides, slideMasters: data.slideMasters! }}
						target={target}
						onReady={(h) => {
							handle = h;
						}}
					/>,
				);
			});

			const deleteAction = handle!.getCrudActions().find((a) => a.id === 'deleteLayout');
			expect(deleteAction?.enabled).toBeFalsy();
			expect(deleteAction?.disabledReasonKey).toBe('pptx.masterView.layoutInUse');
		} finally {
			handler.dispose();
		}
	});

	it('addLayout adopts the returned handler/data: a new layout appears under the master', async () => {
		const { handler, data } = await PptxHandlerCtor.create({ initialSlideCount: 1 });
		try {
			const target: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: null };
			const before = data.slideMasters![0].layouts!.length;

			let handle: HarnessHandle | null = null;
			act(() => {
				root.render(
					<Harness
						handler={handler}
						initialData={{ slides: data.slides, slideMasters: data.slideMasters! }}
						target={target}
						onReady={(h) => {
							handle = h;
						}}
					/>,
				);
			});

			await act(async () => {
				await handle!.handleCrudAction('addLayout');
			});

			expect(handle!.getSlideMasters()[0].layouts).toHaveLength(before + 1);
		} finally {
			handler.dispose();
		}
	});
});
