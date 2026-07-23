import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	isMediaCommandAnimation,
	buildStepCommand,
	parseMediaCommand,
} from './animation-media-commands';
import { buildTimeline } from './animation-timeline-builder';

function makeCommandAnim(overrides: Partial<PptxNativeAnimation> = {}): PptxNativeAnimation {
	return {
		targetId: 'video1',
		trigger: 'onClick',
		commandType: 'call',
		commandString: 'playFrom(0.0)',
		...overrides,
	} as PptxNativeAnimation;
}

// ---------------------------------------------------------------------------
// parseMediaCommand
// ---------------------------------------------------------------------------
describe('parseMediaCommand', () => {
	it('parses playFrom with a seconds argument', () => {
		expect(parseMediaCommand('playFrom(2.5)')).toStrictEqual({
			verb: 'playFrom',
			seekSeconds: 2.5,
		});
	});

	it('parses playFrom(0.0) to a zero seek', () => {
		expect(parseMediaCommand('playFrom(0.0)')).toStrictEqual({
			verb: 'playFrom',
			seekSeconds: 0,
		});
	});

	it('defaults playFrom() with no argument to zero seconds', () => {
		expect(parseMediaCommand('playFrom()')).toStrictEqual({
			verb: 'playFrom',
			seekSeconds: 0,
		});
	});

	it('clamps a negative playFrom seek to zero', () => {
		expect(parseMediaCommand('playFrom(-3)')).toStrictEqual({
			verb: 'playFrom',
			seekSeconds: 0,
		});
	});

	it('parses play and resume as play', () => {
		expect(parseMediaCommand('play')).toStrictEqual({ verb: 'play' });
		expect(parseMediaCommand('resume')).toStrictEqual({ verb: 'play' });
	});

	it('parses pause', () => {
		expect(parseMediaCommand('pause')).toStrictEqual({ verb: 'pause' });
	});

	it('parses stop and stopMedia as stop', () => {
		expect(parseMediaCommand('stop')).toStrictEqual({ verb: 'stop' });
		expect(parseMediaCommand('stopMedia')).toStrictEqual({ verb: 'stop' });
	});

	it('parses togglePlay', () => {
		expect(parseMediaCommand('togglePlay')).toStrictEqual({ verb: 'togglePlay' });
	});

	it('is case-insensitive', () => {
		expect(parseMediaCommand('PAUSE')).toStrictEqual({ verb: 'pause' });
		expect(parseMediaCommand('PlayFrom(1)')).toStrictEqual({ verb: 'playFrom', seekSeconds: 1 });
	});

	it('returns undefined for unrecognised commands', () => {
		expect(parseMediaCommand('foo(1)')).toBeUndefined();
		expect(parseMediaCommand('')).toBeUndefined();
		expect(parseMediaCommand('   ')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// isMediaCommandAnimation / buildStepCommand
// ---------------------------------------------------------------------------
describe('isMediaCommandAnimation', () => {
	it('is truthy when a non-empty commandString is present', () => {
		expect(isMediaCommandAnimation(makeCommandAnim())).toBeTruthy();
	});

	it('is falsy without a command string', () => {
		expect(isMediaCommandAnimation({ targetId: 'x' } as PptxNativeAnimation)).toBeFalsy();
		expect(
			isMediaCommandAnimation({ targetId: 'x', commandString: '   ' } as PptxNativeAnimation),
		).toBeFalsy();
	});
});

describe('buildStepCommand', () => {
	it('builds a command payload from a command animation', () => {
		expect(buildStepCommand(makeCommandAnim())).toStrictEqual({
			type: 'call',
			command: 'playFrom(0.0)',
			targetId: 'video1',
		});
	});

	it('returns undefined for a non-command animation', () => {
		expect(buildStepCommand({ targetId: 'x' } as PptxNativeAnimation)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// buildTimeline command-step emission
// ---------------------------------------------------------------------------
describe('buildTimeline p:cmd steps', () => {
	it('emits a command step carrying the parsed command payload', () => {
		const result = buildTimeline([makeCommandAnim()]);
		expect(result.clickGroups).toHaveLength(1);
		const step = result.clickGroups[0].steps[0];
		expect(step.command).toStrictEqual({
			type: 'call',
			command: 'playFrom(0.0)',
			targetId: 'video1',
		});
	});

	it('gives the command step no visual animation and an empty element id', () => {
		const result = buildTimeline([makeCommandAnim()]);
		const step = result.clickGroups[0].steps[0];
		expect(step.cssAnimation).toBe('');
		expect(step.keyframeName).toBe('');
		expect(step.elementId).toBe('');
		expect(step.durationMs).toBe(0);
	});

	it('does not treat the command target as an entrance element', () => {
		const result = buildTimeline([makeCommandAnim()]);
		expect(result.entranceElementIds.has('video1')).toBeFalsy();
		expect(result.keyframesCss).toBe('');
	});

	it('sequences a command after a preceding onClick visual step', () => {
		const result = buildTimeline([
			{
				targetId: 'el1',
				presetClass: 'entr',
				presetId: 10,
				trigger: 'onClick',
				durationMs: 500,
			} as PptxNativeAnimation,
			makeCommandAnim({ trigger: 'afterPrevious', commandString: 'pause' }),
		]);
		// Same click-group: the visual entrance plus the folded-in command.
		expect(result.clickGroups).toHaveLength(1);
		const steps = result.clickGroups[0].steps;
		expect(steps).toHaveLength(2);
		expect(steps[0].command).toBeUndefined();
		expect(steps[1].command?.command).toBe('pause');
		// afterPrevious delay = prev.delay + prev.duration = 0 + 500.
		expect(steps[1].delayMs).toBe(500);
	});
});
