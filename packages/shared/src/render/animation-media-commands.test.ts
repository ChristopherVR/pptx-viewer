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

	it('tolerates whitespace around the name, parens and argument', () => {
		expect(parseMediaCommand('playFrom ( 2.5 )')).toStrictEqual({
			verb: 'playFrom',
			seekSeconds: 2.5,
		});
		expect(parseMediaCommand('playFrom(  )')).toStrictEqual({ verb: 'playFrom', seekSeconds: 0 });
	});

	it('rejects a playFrom argument that is not a plain decimal', () => {
		expect(parseMediaCommand('playFrom(1.2.3)')).toBeUndefined();
		expect(parseMediaCommand('playFrom(abc)')).toBeUndefined();
		expect(parseMediaCommand('playFrom(1 2)')).toBeUndefined();
		expect(parseMediaCommand('playFromX(1)')).toBeUndefined();
	});

	// The command string comes straight from the deck, so a malicious file must
	// not be able to make this parse super-linear (CodeQL js/polynomial-redos).
	it('parses a pathological playFrom argument in linear time', () => {
		const hostile = `playFrom(${'0'.repeat(50_000)}`;
		const started = performance.now();
		expect(parseMediaCommand(hostile)).toBeUndefined();
		expect(performance.now() - started).toBeLessThan(1_000);
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

// ---------------------------------------------------------------------------
// solution-explorer.pptx slide 2: a looping background video whose p:timing
// says "start with the slide" and "toggle on click". Both halves regressed.
// ---------------------------------------------------------------------------
describe('slide-entry and click-to-toggle media commands', () => {
	/**
	 * The shape core parses out of the deck: a `mediacall` effect inside a click
	 * step that ALSO carries an `onBegin` time-node condition, which is how
	 * PowerPoint spells "this step runs when the slide appears". The collapsed
	 * `trigger` stays `'onClick'` because the sole start condition carries no
	 * event, so only `groupAutoStart` distinguishes it.
	 */
	function makeEntryCommandAnim(): PptxNativeAnimation {
		return {
			targetId: 'video1',
			trigger: 'onClick',
			commandType: 'call',
			commandString: 'playFrom(0.0)',
			startConditions: [{ delay: 0 }],
			groupAutoStart: true,
			parGroupIndex: 0,
		} as PptxNativeAnimation;
	}

	it('auto-starts the group holding a slide-entry media command', () => {
		const result = buildTimeline([makeEntryCommandAnim()]);
		expect(result.clickGroups).toHaveLength(1);
		expect(result.clickGroups[0].autoAdvance).toBeTruthy();
		expect(result.clickGroups[0].steps[0].command?.command).toBe('playFrom(0.0)');
	});

	it('still click-gates a group whose condition really is a click', () => {
		const result = buildTimeline([
			{
				...makeEntryCommandAnim(),
				startConditions: [{ event: 'onClick' }],
			} as PptxNativeAnimation,
		]);
		expect(result.clickGroups[0].autoAdvance).toBeUndefined();
	});

	it('keeps a togglePause command in its interactive sequence', () => {
		const result = buildTimeline([
			makeCommandAnim({
				trigger: 'onShapeClick',
				triggerShapeId: 'video1',
				commandString: 'togglePause',
			} as Partial<PptxNativeAnimation>),
		]);
		const sequence = result.interactiveSequences.get('video1');
		expect(sequence).toBeDefined();
		const step = sequence?.[0].steps[0];
		expect(step?.command).toStrictEqual({
			type: 'call',
			command: 'togglePause',
			targetId: 'video1',
		});
		expect(step?.elementId).toBe('');
		expect(step?.cssAnimation).toBe('');
	});

	it('maps togglePause onto the same two-way verb as togglePlay', () => {
		expect(parseMediaCommand('togglePause')).toStrictEqual({ verb: 'togglePlay' });
		expect(parseMediaCommand('TOGGLEPAUSE')).toStrictEqual({ verb: 'togglePlay' });
	});
});
