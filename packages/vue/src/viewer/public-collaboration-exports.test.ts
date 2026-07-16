import { describe, expect, it } from 'vitest';

import {
	CollaborationCursors,
	CollaborationStatusIndicator,
	FollowModeBar,
	RemoteSelectionOverlay,
	useCollaboration,
	useCollaborationWiring,
} from './index';

describe('stable collaboration exports', () => {
	it('exposes collaboration composables and UI components', () => {
		expect(useCollaboration).toBeTypeOf('function');
		expect(useCollaborationWiring).toBeTypeOf('function');
		expect(CollaborationCursors).toBeTruthy();
		expect(CollaborationStatusIndicator).toBeTruthy();
		expect(RemoteSelectionOverlay).toBeTruthy();
		expect(FollowModeBar).toBeTruthy();
	});
});
