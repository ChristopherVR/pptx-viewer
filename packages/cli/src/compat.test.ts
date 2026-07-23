import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkCompat } from './compat';
import { TARGETS } from './targets';

describe('checkCompat', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'compat-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const react = TARGETS.find((t) => t.id === 'react')!;
	const core = TARGETS.find((t) => t.id === 'core')!;

	it('is compatible when the target has no compat requirement', () => {
		expect(checkCompat(dir, core)).toStrictEqual({ compatible: true, message: null });
	});

	it('is compatible when nothing is installed or declared yet', () => {
		expect(checkCompat(dir, react)).toStrictEqual({ compatible: true, message: null });
	});

	/** Write a fake installed `react` at `version` into the temp project. */
	function installReact(version: string): void {
		mkdirSync(join(dir, 'node_modules', 'react'), { recursive: true });
		writeFileSync(join(dir, 'node_modules', 'react', 'package.json'), JSON.stringify({ version }));
	}

	it('is compatible when the installed major matches', () => {
		installReact('19.2.7');
		expect(checkCompat(dir, react)).toStrictEqual({ compatible: true, message: null });
	});

	// pptx-react-viewer supports react ^18.2 || ^19 (issue #105), so a React 18
	// project must NOT be warned about.
	it('is compatible on every major the peer range admits', () => {
		installReact('18.3.1');
		expect(checkCompat(dir, react)).toStrictEqual({ compatible: true, message: null });
	});

	it('flags an incompatible installed major with a message naming both versions', () => {
		installReact('17.0.2');
		const result = checkCompat(dir, react);
		expect(result.compatible).toBeFalsy();
		expect(result.message).toContain('react@17.0.2');
		expect(result.message).toContain('React requires react@^18 or ^19');
	});

	it('lists the full supported window for a multi-major framework', () => {
		const angular = TARGETS.find((t) => t.id === 'angular')!;
		mkdirSync(join(dir, 'node_modules', '@angular', 'core'), { recursive: true });
		writeFileSync(
			join(dir, 'node_modules', '@angular', 'core', 'package.json'),
			JSON.stringify({ version: '18.2.0' }),
		);
		const result = checkCompat(dir, angular);
		expect(result.compatible).toBeFalsy();
		expect(result.message).toContain('Angular requires @angular/core@^19 or ^20 or ^21 or ^22');
	});
});
