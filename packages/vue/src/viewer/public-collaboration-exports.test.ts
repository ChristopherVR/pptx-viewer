import { describe, expect, it } from 'vitest';

import {
	CollaborationCursors,
	CollaborationStatusIndicator,
	FollowModeBar,
	RemoteSelectionOverlay,
	useCollaboration,
	useCollaborativeHistory,
	useCollaborativeState,
	usePresenceTracking,
	useYjsProvider,
} from './index';

describe('stable collaboration exports', () => {
	it('exposes collaboration composables and UI components', () => {
		expect(useCollaboration).toBeTypeOf('function');
		expect(useYjsProvider).toBeTypeOf('function');
		expect(usePresenceTracking).toBeTypeOf('function');
		expect(useCollaborativeState).toBeTypeOf('function');
		expect(useCollaborativeHistory).toBeTypeOf('function');
		expect(CollaborationCursors).toBeTruthy();
		expect(CollaborationStatusIndicator).toBeTruthy();
		expect(RemoteSelectionOverlay).toBeTruthy();
		expect(FollowModeBar).toBeTruthy();
	});
});
