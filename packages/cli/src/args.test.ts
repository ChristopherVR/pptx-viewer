import { describe, expect, it } from 'vitest';

import { parseArgs } from './args';

describe('parseArgs', () => {
	it('defaults help, yes, and scaffold to false with no flags', () => {
		expect(parseArgs([])).toStrictEqual({ help: false, yes: false, scaffold: false });
	});

	it('parses --target, --pm, and --dir with their values', () => {
		expect(parseArgs(['--target', 'react,mcp', '--pm', 'bun', '--dir', 'my-app'])).toStrictEqual({
			help: false,
			yes: false,
			scaffold: false,
			target: 'react,mcp',
			pm: 'bun',
			dir: 'my-app',
		});
	});

	it('parses --yes, --help, and --scaffold as booleans', () => {
		expect(parseArgs(['--yes', '--help', '--scaffold'])).toStrictEqual({
			help: true,
			yes: true,
			scaffold: true,
		});
		expect(parseArgs(['-y', '-h'])).toStrictEqual({ help: true, yes: true, scaffold: false });
	});

	it('rejects an unknown flag', () => {
		expect(() => parseArgs(['--bogus'])).toThrow('Unknown option: --bogus');
	});

	it('rejects a flag missing its value', () => {
		expect(() => parseArgs(['--target'])).toThrow('--target needs a value');
	});

	it('rejects an unrecognized package manager', () => {
		expect(() => parseArgs(['--pm', 'npmm'])).toThrow(/--pm must be one of/u);
	});
});
