import { describe, expect, it } from 'vitest';

import type { PptxAiConfig } from './config';
import { makeMockBridge } from './mock-bridge';
import { ProposalStore } from './proposals';
import { buildToolExecutors, enabledToolNames } from './tools';

const CONNECTION: PptxAiConfig['connection'] = { kind: 'endpoint', api: '/api/chat' };

function setup(config: Partial<PptxAiConfig> = {}) {
	const bridge = makeMockBridge();
	const proposals = new ProposalStore(bridge);
	const full: PptxAiConfig = { connection: CONNECTION, ...config };
	const executors = buildToolExecutors(bridge, proposals, full);
	return { bridge, proposals, executors };
}

describe('tool registry', () => {
	it('dispatches read tools without staging or applying', async () => {
		const { bridge, proposals, executors } = setup();
		const result = (await executors.get('get_deck_overview')!({})) as {
			meta: { slideCount: number };
		};
		expect(result.meta.slideCount).toBe(2);
		expect(proposals.size).toBe(0);
		expect(bridge.edits).toHaveLength(0);
	});

	it('stages edits under the default (stage) policy', async () => {
		const { bridge, proposals, executors } = setup();
		const result = (await executors.get('update_element')!({
			slideIndex: 0,
			elementId: 'el-1',
			text: 'Renamed',
		})) as { staged?: boolean };
		expect(result.staged).toBeTruthy();
		expect(proposals.size).toBe(1);
		expect(bridge.edits).toHaveLength(0);

		const [proposal] = proposals.list();
		proposals.apply(proposal.id);
		expect(bridge.edits).toHaveLength(1);
		expect(bridge.getSlides()[0].elements[0]).toMatchObject({ text: 'Renamed' });
	});

	it('applies edits immediately under the auto policy', async () => {
		const { bridge, proposals, executors } = setup({ writePolicy: 'auto' });
		const result = (await executors.get('update_element')!({
			slideIndex: 0,
			elementId: 'el-1',
			x: 200,
		})) as { applied?: boolean };
		expect(result.applied).toBeTruthy();
		expect(bridge.edits).toHaveLength(1);
		expect(proposals.size).toBe(0);
	});

	it('always forces approval for delete_slides even under auto', async () => {
		const { bridge, proposals, executors } = setup({ writePolicy: 'auto' });
		const result = (await executors.get('delete_slides')!({ slideIndexes: [1] })) as {
			staged?: boolean;
			requiresApproval?: boolean;
		};
		expect(result.staged).toBeTruthy();
		expect(result.requiresApproval).toBeTruthy();
		expect(bridge.edits).toHaveLength(0);
		expect(proposals.size).toBe(1);
	});

	it('routes presentation-level tools through applyDeckData', async () => {
		const { bridge, proposals, executors } = setup();
		const result = (await executors.get('update_metadata')!({ title: 'Q3 Deck' })) as {
			applied?: boolean;
		};
		expect(result.applied).toBeTruthy();
		expect(bridge.getDeckData?.()?.coreProperties?.title).toBe('Q3 Deck');
		expect(proposals.size).toBe(0);
		expect(bridge.edits.at(-1)?.label).toBe('Update metadata');
	});

	it('reports deck tools as unavailable when the bridge cannot apply them', async () => {
		const bridge = makeMockBridge();
		delete (bridge as { applyDeckData?: unknown }).applyDeckData;
		const proposals = new ProposalStore(bridge);
		const executors = buildToolExecutors(bridge, proposals, { connection: CONNECTION });
		await expect(executors.get('update_metadata')!({ title: 'X' })).rejects.toThrow(
			/presentation-level/u,
		);
	});

	it('honours the enabled allowlist and disabled denylist', () => {
		expect(
			enabledToolNames({ connection: CONNECTION, tools: { enabled: ['get_slide'] } }),
		).toStrictEqual(['get_slide']);
		const denied = enabledToolNames({
			connection: CONNECTION,
			tools: { disabled: ['delete_slides'] },
		});
		expect(denied).not.toContain('delete_slides');
		expect(denied).toContain('get_slide');
	});

	it('routes navigation tools straight to the bridge', async () => {
		const { bridge, executors } = setup();
		await executors.get('go_to_slide')!({ slideIndex: 1 });
		expect(bridge.navigations).toStrictEqual([1]);
	});
});
