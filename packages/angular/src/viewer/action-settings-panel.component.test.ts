/**
 * action-settings-panel.component.test.ts: unit tests for the pending-type rule
 * that makes "Go to URL" / "Go to Slide" reachable in the Action Settings panel.
 *
 * No Angular TestBed: component rendering needs `@analogjs/vite-plugin-angular`
 * (a follow-up), so the template's predicates are factored into the pure
 * `displayedActionType` / `withPendingActionType` helpers and tested directly,
 * matching the rest of this package (see `inspector-panel.component.test.ts`).
 * `displayedActionType(...) === 'url'` is literally the `@if` that renders the
 * URL input, so asserting it asserts the input appears.
 *
 * Reference bindings: packages/react/src/viewer/components/inspector/
 * ActionSettingsPanel.tsx and packages/svelte/.../ActionTriggerFields.svelte.
 */
import { describe, expect, it } from 'vitest';

import { canCommitActionType } from '../internal/shared';
import {
	displayedActionType,
	NO_PENDING_ACTION_TYPE,
	withPendingActionType,
} from './action-settings-panel.component';

describe('displayedActionType', () => {
	it('shows "none" for an element with no action', () => {
		expect(displayedActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', undefined)).toBe('none');
	});

	it('reveals the URL input as soon as "Go to URL" is picked, with no committed action', () => {
		const pending = withPendingActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', 'url');

		expect(displayedActionType(pending, 'shape-1', 'click', undefined)).toBe('url');
		// A target-less url action would round-trip to "none", so it must not be
		// committed yet; the panel holds the pick instead.
		expect(canCommitActionType('url', {})).toBeFalsy();
	});

	it('reveals the slide spinner as soon as "Go to Slide" is picked', () => {
		const pending = withPendingActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'hover', 'slide');

		expect(displayedActionType(pending, 'shape-1', 'hover', undefined)).toBe('slide');
		expect(displayedActionType(pending, 'shape-1', 'click', undefined)).toBe('none');
	});

	it('round-trips the action once its target is entered', () => {
		const pending = withPendingActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', 'url');

		expect(canCommitActionType('url', { url: 'https://example.com/' })).toBeTruthy();
		// The committed element now says "url" too, so the panel stays put.
		expect(displayedActionType(pending, 'shape-1', 'click', 'url')).toBe('url');
	});

	it('keeps the committed type when nothing has been picked', () => {
		expect(displayedActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', 'nextSlide')).toBe(
			'nextSlide',
		);
	});

	it('drops a half-made pick when the inspector moves to another element', () => {
		const pending = withPendingActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', 'url');

		expect(displayedActionType(pending, 'shape-2', 'click', undefined)).toBe('none');
	});
});

describe('withPendingActionType', () => {
	it('keeps both triggers of the same element independent', () => {
		const first = withPendingActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', 'url');
		const both = withPendingActionType(first, 'shape-1', 'hover', 'slide');

		expect(both.types).toStrictEqual({ click: 'url', hover: 'slide' });
	});

	it('replaces the record wholesale when the element changes', () => {
		const first = withPendingActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', 'url');
		const moved = withPendingActionType(first, 'shape-2', 'hover', 'slide');

		expect(moved).toStrictEqual({ elementId: 'shape-2', types: { hover: 'slide' } });
	});
});
