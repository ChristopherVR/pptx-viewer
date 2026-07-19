import { describe, expect, it } from 'vitest';

import { shouldAutoFollowBroadcaster } from './collaboration-broadcast-follow';

describe('shouldAutoFollowBroadcaster', () => {
	it('a viewer auto-follows the owner broadcaster', () => {
		expect(
			shouldAutoFollowBroadcaster({ localRole: 'viewer', broadcasterRole: 'owner' }),
		).toBeTruthy();
	});

	it('a collaborator does NOT auto-follow the owner', () => {
		expect(
			shouldAutoFollowBroadcaster({ localRole: 'collaborator', broadcasterRole: 'owner' }),
		).toBeFalsy();
	});

	it('the owner does NOT auto-follow itself', () => {
		expect(
			shouldAutoFollowBroadcaster({ localRole: 'owner', broadcasterRole: 'owner' }),
		).toBeFalsy();
	});

	it('a viewer does NOT follow a non-owner (collaborator) peer', () => {
		expect(
			shouldAutoFollowBroadcaster({ localRole: 'viewer', broadcasterRole: 'collaborator' }),
		).toBeFalsy();
	});

	it('an undefined local role never auto-follows', () => {
		expect(
			shouldAutoFollowBroadcaster({ localRole: undefined, broadcasterRole: 'owner' }),
		).toBeFalsy();
	});
});
