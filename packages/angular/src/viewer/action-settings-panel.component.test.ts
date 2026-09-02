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
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

describe('wave-4 action types (customShow / openFile / openPresentation)', () => {
	it('reveals the custom-show select + return-after checkbox as soon as it is picked', () => {
		const pending = withPendingActionType(NO_PENDING_ACTION_TYPE, 'shape-1', 'click', 'customShow');
		expect(displayedActionType(pending, 'shape-1', 'click', undefined)).toBe('customShow');
		// A target-less customShow action would name no show, so it must not be
		// committed yet; the panel holds the pick until an id is chosen.
		expect(canCommitActionType('customShow', {})).toBeFalsy();
		expect(canCommitActionType('customShow', { customShowId: '3' })).toBeTruthy();
	});

	it('openFile / openPresentation commit immediately (their target is filled in afterwards)', () => {
		expect(canCommitActionType('openFile', {})).toBeTruthy();
		expect(canCommitActionType('openPresentation', {})).toBeTruthy();
	});

	it('renders the custom-show target select, return-after checkbox, and file/presentation target input', () => {
		// The per-trigger target controls live in the sub-component
		// `ActionTargetFieldsComponent`, split out to keep this file under the
		// repo's 300-LOC cap.
		const source = readFileSync(path.join(__dirname, 'action-target-fields.component.ts'), 'utf8');
		expect(source).toContain('data-testid="pptx-action-custom-show"');
		expect(source).toContain('data-testid="pptx-action-custom-show-return"');
		expect(source).toContain("type() === 'openFile' || type() === 'openPresentation'");
		expect(source).toContain('@for (show of customShows(); track show.id)');
	});

	it('the panel wires the sub-component to its own state and commit handlers', () => {
		const source = readFileSync(path.join(__dirname, 'action-settings-panel.component.ts'), 'utf8');
		expect(source).toContain('<pptx-action-target-fields');
		expect(source).toContain('[type]="typeFor(trigger)"');
		expect(source).toContain('[customShows]="customShows()"');
		expect(source).toContain('(customShowChange)="onCustomShow($event, trigger)"');
		expect(source).toContain('(returnAfterChange)="onReturnAfter($event, trigger)"');
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
