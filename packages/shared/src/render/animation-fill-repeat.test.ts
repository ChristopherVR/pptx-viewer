import { describe, expect, it } from 'vitest';

import {
	applySpeedToDuration,
	resolveEffectTiming,
	resolveIterationCount,
	shouldHoldEndState,
} from './animation-fill-repeat';

describe('applySpeedToDuration', () => {
	it('leaves the duration unchanged when speed is absent', () => {
		expect(applySpeedToDuration(undefined, 500)).toBe(500);
	});

	it('leaves the duration unchanged for a non-positive speed', () => {
		expect(applySpeedToDuration(0, 500)).toBe(500);
		expect(applySpeedToDuration(-10, 500)).toBe(500);
	});

	it('plays faster (shorter duration) for a speed above 100%', () => {
		expect(applySpeedToDuration(200, 1000)).toBe(500);
		expect(applySpeedToDuration(150, 900)).toBe(600);
	});

	it('plays slower (longer duration) for a speed below 100%', () => {
		expect(applySpeedToDuration(50, 500)).toBe(1000);
	});

	it('never rounds down to zero', () => {
		expect(applySpeedToDuration(100000, 1)).toBe(1);
	});
});

describe('resolveIterationCount', () => {
	it('prefers an explicit repeatCount over repeatDur', () => {
		expect(resolveIterationCount(3, 10000, 500)).toBe(3);
	});

	it('defaults to a single iteration when neither is set', () => {
		expect(resolveIterationCount(undefined, undefined, 500)).toBe(1);
	});

	it('treats an indefinite repeatDur as infinite', () => {
		expect(resolveIterationCount(undefined, Infinity, 500)).toBe(Infinity);
	});

	it('derives a finite iteration count from repeatDur / duration', () => {
		expect(resolveIterationCount(undefined, 2000, 500)).toBe(4);
	});

	it('rounds and floors at one iteration for a very short repeatDur', () => {
		expect(resolveIterationCount(undefined, 10, 500)).toBe(1);
	});
});

describe('shouldHoldEndState', () => {
	it('holds an emphasis effect explicitly marked fill=hold', () => {
		expect(shouldHoldEndState({ presetClass: 'emph', fill: 'hold' })).toBeTruthy();
	});

	it('holds a motion path explicitly marked fill=freeze or fill=transition', () => {
		expect(shouldHoldEndState({ presetClass: 'path', fill: 'freeze' })).toBeTruthy();
		expect(shouldHoldEndState({ presetClass: 'path', fill: 'transition' })).toBeTruthy();
	});

	it('reverts an emphasis effect explicitly marked fill=remove', () => {
		expect(shouldHoldEndState({ presetClass: 'emph', fill: 'remove' })).toBeFalsy();
	});

	it('reverts when fill is absent (OOXML default)', () => {
		expect(shouldHoldEndState({ presetClass: 'emph', fill: undefined })).toBeFalsy();
	});

	it('never holds an entrance or exit step: their end state is governed by visibility', () => {
		expect(shouldHoldEndState({ presetClass: 'entr', fill: 'hold' })).toBeFalsy();
		expect(shouldHoldEndState({ presetClass: 'exit', fill: 'hold' })).toBeFalsy();
	});
});

describe('resolveEffectTiming', () => {
	it('combines duration, iteration count and hold decision in one call', () => {
		const result = resolveEffectTiming(
			{
				presetClass: 'emph',
				fill: 'hold',
				speedPct: 200,
				repeatCount: undefined,
				repeatDurMs: 1000,
			},
			500,
		);
		expect(result.durationMs).toBe(250);
		expect(result.iterationCount).toBe(4);
		expect(result.holdEndState).toBeTruthy();
	});

	it('plays an auto-reverse cycle forward and backward before cleanup', () => {
		const result = resolveEffectTiming(
			{
				presetClass: 'emph',
				fill: 'hold',
				autoReverse: true,
				speedPct: undefined,
				repeatCount: undefined,
				repeatDurMs: undefined,
			},
			250,
		);
		expect(result.durationMs).toBe(250);
		expect(result.iterationCount).toBe(2);
		expect(result.activeDurationMs).toBe(500);
	});

	it('counts each repeated auto-reverse cycle as a forward/backward pair', () => {
		const result = resolveEffectTiming(
			{
				presetClass: 'emph',
				fill: 'remove',
				autoReverse: true,
				speedPct: undefined,
				repeatCount: 3,
				repeatDurMs: undefined,
			},
			200,
		);
		expect(result.iterationCount).toBe(6);
		expect(result.activeDurationMs).toBe(1200);
	});
});
