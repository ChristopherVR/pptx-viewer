import { describe, expect, it } from 'vitest';

import type { PptxAiConfig } from '../../internal/shared-ai';
import { aiToggleVisible } from './ai-gating';

describe('aiToggleVisible', () => {
	it('hides the toggle when no ai config is supplied', () => {
		expect(aiToggleVisible(undefined)).toBeFalsy();
	});

	it('shows the toggle when an ai config is supplied', () => {
		const config: PptxAiConfig = {
			connection: { kind: 'endpoint', api: '/api/ai' },
		};
		expect(aiToggleVisible(config)).toBeTruthy();
	});
});
