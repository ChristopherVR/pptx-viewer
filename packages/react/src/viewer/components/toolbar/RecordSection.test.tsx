// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';

import { RecordSection } from './RecordSection';

vi.mock(import('react-i18next'), () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

test('routes both native Record intents once and cleans up on unmount', () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	const target = document.createElement('div');
	const root = createRoot(target);
	const beginning = vi.fn();
	const current = vi.fn();
	act(() =>
		root.render(<RecordSection onRecordFromBeginning={beginning} onRecordFromCurrent={current} />),
	);
	expect(target.querySelectorAll('pptx-ui-ribbon-group')).toHaveLength(4);
	expect(target.querySelectorAll('pptx-ui-ribbon-command[disabled]')).toHaveLength(4);
	const hosts = ['record.record.fromBeginning', 'record.record.fromCurrent'].map((id) =>
		target.querySelector(`[data-ribbon-control="${id}"]`)!,
	);
	act(() =>
		hosts.forEach((host) => host.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click()),
	);
	expect(beginning).toHaveBeenCalledOnce();
	expect(current).toHaveBeenCalledOnce();
	act(() => root.unmount());
	hosts.forEach((host) => host.dispatchEvent(new CustomEvent('command-request')));
	expect(beginning).toHaveBeenCalledOnce();
	expect(current).toHaveBeenCalledOnce();
});
