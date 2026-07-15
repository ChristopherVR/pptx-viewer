import { describe, expect, it } from 'vitest';

import { validateSlideTransitions } from './pptx-validator-transitions';
import type { ValidationIssue } from './pptx-validator-types';

const STRICT_P = 'http://purl.oclc.org/ooxml/presentationml/main';
const STRICT_R = 'http://purl.oclc.org/ooxml/officeDocument/relationships';
const TRANSITIONAL_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const TRANSITIONAL_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function validate(xml: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	validateSlideTransitions(xml, 'ppt/slides/slide1.xml', issues);
	return issues;
}

describe('slide transition conformance validation', () => {
	it.each([
		[STRICT_P, STRICT_R],
		[TRANSITIONAL_P, TRANSITIONAL_R],
	])('accepts valid Strict/Transitional transitions independent of prefix', (p, r) => {
		const issues = validate(`<x:sld xmlns:x="${p}" xmlns:rel="${r}">
			<x:transition spd="med" advClick="false" advTm="4294967295">
				<x:fade/><x:sndAc><x:stSnd loop="1"><x:snd rel:embed="rId4" name="Chime"/></x:stSnd></x:sndAc>
			</x:transition>
		</x:sld>`);
		expect(issues).toStrictEqual([]);
	});

	it('reports invalid speed, boolean, time, and effect choice', () => {
		const issues = validate(`<p:sld xmlns:p="${TRANSITIONAL_P}">
			<p:transition spd="instant" advClick="yes" advTm="4294967296">
				<p:fade/><p:wipe/>
			</p:transition>
		</p:sld>`);
		expect(issues.map((issue) => issue.code)).toStrictEqual(
			expect.arrayContaining([
				'TRANSITION_INVALID_SPEED',
				'TRANSITION_INVALID_BOOLEAN',
				'TRANSITION_INVALID_TIME',
				'TRANSITION_INVALID_CHOICE',
			]),
		);
	});

	it('requires exactly one sound choice and an embedded WAV relationship', () => {
		const issues = validate(`<p:sld xmlns:p="${STRICT_P}" xmlns:r="${STRICT_R}">
			<p:transition><p:fade/><p:sndAc><p:stSnd loop="maybe"><p:snd/></p:stSnd><p:endSnd/></p:sndAc></p:transition>
		</p:sld>`);
		expect(issues.map((issue) => issue.code)).toStrictEqual(
			expect.arrayContaining(['TRANSITION_INVALID_SOUND']),
		);

		const missingRelationship = validate(`<p:sld xmlns:p="${STRICT_P}">
			<p:transition><p:fade/><p:sndAc><p:stSnd><p:snd/></p:stSnd></p:sndAc></p:transition>
		</p:sld>`);
		expect(missingRelationship.map((issue) => issue.code)).toContain(
			'TRANSITION_MISSING_SOUND_RELATIONSHIP',
		);
	});

	it('ignores transition-shaped markup outside PresentationML namespaces', () => {
		const issues = validate(
			'<v:sld xmlns:v="urn:vendor"><v:transition spd="wrong"><v:fade/><v:wipe/></v:transition></v:sld>',
		);
		expect(issues).toStrictEqual([]);
	});
});
