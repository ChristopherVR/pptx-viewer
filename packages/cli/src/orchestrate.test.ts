/* oxlint-disable eslint/one-var -- independent per-test locals, not intended as one statement */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParsedArgs } from './args';
import {
	confirmCompat,
	printBanner,
	printUsage,
	resolveScaffoldChoice,
	resolveTargets,
	runCli,
	runInstallMode,
	runScaffoldMode,
} from './orchestrate';
import { confirm, input, multiSelect, selectOption } from './prompt';
import { runCommand } from './run-command';
import { TARGETS } from './targets';
import type { ScaffoldRecipe, Target } from './targets';

vi.mock(import('./prompt'), () => ({
	confirm: vi.fn(),
	input: vi.fn(),
	multiSelect: vi.fn(),
	selectOption: vi.fn(),
}));

vi.mock(import('./run-command'), () => ({
	runCommand: vi.fn(),
}));

const mockConfirm = vi.mocked(confirm);
const mockInput = vi.mocked(input);
const mockMultiSelect = vi.mocked(multiSelect);
const mockSelectOption = vi.mocked(selectOption);
const mockRunCommand = vi.mocked(runCommand);

/** Real `process.stdin.isTTY` may be `undefined`, `true`, or `false` depending on how the test runner was invoked; pin it per test. */
function setTTY(value: boolean): void {
	Object.defineProperty(process.stdin, 'isTTY', { value, configurable: true, writable: true });
}

function baseArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
	return { help: false, yes: false, scaffold: false, ...overrides };
}

function makeTarget(overrides: Partial<Target> = {}): Target {
	return {
		id: 'fixture',
		label: 'Fixture',
		description: 'A fixture target',
		mode: 'install',
		packages: ['fixture-pkg'],
		nextSteps: 'Fixture next steps',
		...overrides,
	};
}

function makeScaffoldTarget(
	recipeOverrides: Partial<ScaffoldRecipe> = {},
	targetOverrides: Partial<Target> = {},
): Target {
	return makeTarget({
		id: 'fixture-fw',
		label: 'Fixture Framework',
		group: 'framework',
		scaffold: {
			command: 'create-fixture@latest',
			args: (dir: string) => [dir, '--template', 'fixture'],
			extraPackages: ['fixture-viewer'],
			entryCandidates: ['src/App.fixture'],
			entryContent: '// fixture entry',
			...recipeOverrides,
		},
		...targetOverrides,
	});
}

let logSpy: ReturnType<typeof vi.spyOn>;

function loggedText(): string {
	return logSpy.mock.calls.map((call) => String(call[0])).join('\n');
}

beforeEach(() => {
	logSpy = vi.spyOn(console, 'log').mockReturnValue(undefined);
	// Silence expected error output (rejection-path tests) without asserting on it.
	vi.spyOn(console, 'error').mockReturnValue(undefined);
	mockConfirm.mockReset();
	mockInput.mockReset();
	mockMultiSelect.mockReset();
	mockSelectOption.mockReset();
	mockRunCommand.mockReset().mockResolvedValue(0);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('printBanner / printUsage', () => {
	it('printBanner announces the tool name', () => {
		printBanner();
		expect(loggedText()).toContain('pptx-viewer');
		expect(loggedText()).toContain('interactive installer');
	});

	it('printUsage documents every flag and lists every target id', () => {
		printUsage();
		const text = loggedText();
		expect(text).toContain('Usage:');
		expect(text).toContain('--target <ids>');
		expect(text).toContain('--scaffold');
		expect(text).toContain('--dir <name>');
		expect(text).toContain('--pm <manager>');
		expect(text).toContain('--yes, -y');
		expect(text).toContain('--help, -h');
		for (const target of TARGETS) {
			expect(text).toContain(target.id);
		}
	});
});

describe('resolveTargets', () => {
	it('resolves a single requested id and announces it', async () => {
		const targets = await resolveTargets('react');
		expect(targets.map((t) => t.id)).toStrictEqual(['react']);
		expect(loggedText()).toContain('React');
	});

	it('trims, lowercases, and dedupes a comma-separated request', async () => {
		const targets = await resolveTargets(' React , react ,MCP');
		expect(targets.map((t) => t.id)).toStrictEqual(['react', 'mcp']);
	});

	it('rejects an unknown target id', async () => {
		await expect(resolveTargets('not-a-real-target')).rejects.toThrow(
			/Unknown target "not-a-real-target"/,
		);
	});

	it('rejects with no --target and no TTY', async () => {
		setTTY(false);
		await expect(resolveTargets(undefined)).rejects.toThrow(/Not running in a terminal/);
		expect(mockMultiSelect).not.toHaveBeenCalled();
	});

	it('falls back to the interactive picker with no --target and a TTY', async () => {
		setTTY(true);
		const picked = [TARGETS.find((t) => t.id === 'vue')!];
		mockMultiSelect.mockResolvedValue(picked);
		const targets = await resolveTargets(undefined);
		expect(targets).toBe(picked);
		expect(mockMultiSelect).toHaveBeenCalledWith(
			expect.stringContaining('What are you building'),
			TARGETS,
		);
	});
});

describe('confirmCompat', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'orchestrate-compat-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const react = TARGETS.find((t) => t.id === 'react')!;

	function installReact(version: string): void {
		mkdirSync(join(dir, 'node_modules', 'react'), { recursive: true });
		writeFileSync(join(dir, 'node_modules', 'react', 'package.json'), JSON.stringify({ version }));
	}

	it('proceeds without prompting when everything is compatible', async () => {
		const proceed = await confirmCompat(dir, [react]);
		expect(proceed).toBeTruthy();
		expect(mockConfirm).not.toHaveBeenCalled();
	});

	it('warns but proceeds automatically when incompatible and not a TTY', async () => {
		installReact('17.0.2');
		setTTY(false);
		const proceed = await confirmCompat(dir, [react]);
		expect(proceed).toBeTruthy();
		expect(mockConfirm).not.toHaveBeenCalled();
		expect(loggedText()).toContain('Warning:');
		expect(loggedText()).toContain('react@17.0.2');
	});

	it('asks to continue past an incompatibility on a TTY, and honours "yes"', async () => {
		installReact('17.0.2');
		setTTY(true);
		mockConfirm.mockResolvedValue(true);
		const proceed = await confirmCompat(dir, [react]);
		expect(proceed).toBeTruthy();
		expect(mockConfirm).toHaveBeenCalledWith('Continue anyway?');
	});

	it('stops and reports incompatible when the user declines on a TTY', async () => {
		installReact('17.0.2');
		setTTY(true);
		mockConfirm.mockResolvedValue(false);
		const proceed = await confirmCompat(dir, [react]);
		expect(proceed).toBeFalsy();
	});

	it('checks every target, stopping at the first declined incompatibility', async () => {
		installReact('17.0.2');
		const angular = TARGETS.find((t) => t.id === 'angular')!;
		setTTY(true);
		mockConfirm.mockResolvedValueOnce(false);
		const proceed = await confirmCompat(dir, [react, angular]);
		expect(proceed).toBeFalsy();
		expect(mockConfirm).toHaveBeenCalledOnce();
	});
});

describe('resolveScaffoldChoice', () => {
	it('honours --scaffold when exactly one scaffoldable target is selected', async () => {
		const fw = makeScaffoldTarget();
		const choice = await resolveScaffoldChoice([fw], baseArgs({ scaffold: true }));
		expect(choice).toStrictEqual({ useScaffold: true, scaffoldTarget: fw });
	});

	it('ignores non-scaffoldable targets when counting scaffoldable candidates', async () => {
		const fw = makeScaffoldTarget();
		const core = makeTarget({ id: 'core', scaffold: undefined });
		const choice = await resolveScaffoldChoice([fw, core], baseArgs({ scaffold: true }));
		expect(choice).toStrictEqual({ useScaffold: true, scaffoldTarget: fw });
	});

	it('rejects --scaffold when nothing scaffoldable was selected', async () => {
		const core = makeTarget({ id: 'core', scaffold: undefined });
		await expect(resolveScaffoldChoice([core], baseArgs({ scaffold: true }))).rejects.toThrow(
			/--scaffold requires exactly one of/,
		);
	});

	it('rejects --scaffold when more than one scaffoldable target was selected', async () => {
		const fw1 = makeScaffoldTarget({}, { id: 'fw1' });
		const fw2 = makeScaffoldTarget({}, { id: 'fw2' });
		await expect(resolveScaffoldChoice([fw1, fw2], baseArgs({ scaffold: true }))).rejects.toThrow(
			/--scaffold requires exactly one of/,
		);
	});

	it('offers the install-vs-scaffold prompt on a TTY with exactly one scaffoldable target', async () => {
		const fw = makeScaffoldTarget();
		setTTY(true);
		mockSelectOption.mockResolvedValue({
			label: 'Scaffold a new project',
			description: 'Bootstrap a brand-new starter app in its own folder',
		});
		const choice = await resolveScaffoldChoice([fw], baseArgs());
		expect(choice).toStrictEqual({ useScaffold: true, scaffoldTarget: fw });
		expect(mockSelectOption).toHaveBeenCalledOnce();
	});

	it('installs in place when "Install here" is picked on the prompt', async () => {
		const fw = makeScaffoldTarget();
		setTTY(true);
		mockSelectOption.mockResolvedValue({
			label: 'Install here',
			description: 'Add the package(s) to the project in this directory',
		});
		const choice = await resolveScaffoldChoice([fw], baseArgs());
		expect(choice).toStrictEqual({ useScaffold: false, scaffoldTarget: fw });
	});

	it('skips the prompt and installs in place when not a TTY', async () => {
		const fw = makeScaffoldTarget();
		setTTY(false);
		const choice = await resolveScaffoldChoice([fw], baseArgs());
		expect(choice).toStrictEqual({ useScaffold: false });
		expect(mockSelectOption).not.toHaveBeenCalled();
	});

	it('skips the prompt when nothing scaffoldable was selected', async () => {
		const core = makeTarget({ id: 'core', scaffold: undefined });
		setTTY(true);
		const choice = await resolveScaffoldChoice([core], baseArgs());
		expect(choice).toStrictEqual({ useScaffold: false });
		expect(mockSelectOption).not.toHaveBeenCalled();
	});

	it('skips the prompt when more than one scaffoldable target was selected without --scaffold', async () => {
		const fw1 = makeScaffoldTarget({}, { id: 'fw1' });
		const fw2 = makeScaffoldTarget({}, { id: 'fw2' });
		setTTY(true);
		const choice = await resolveScaffoldChoice([fw1, fw2], baseArgs());
		expect(choice).toStrictEqual({ useScaffold: false });
		expect(mockSelectOption).not.toHaveBeenCalled();
	});
});

describe('runScaffoldMode', () => {
	let cwd: string;

	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), 'orchestrate-scaffold-'));
	});

	afterEach(() => {
		rmSync(cwd, { recursive: true, force: true });
	});

	it('rejects a target with no scaffold recipe', async () => {
		const target = makeTarget({ scaffold: undefined });
		await expect(runScaffoldMode(target, baseArgs({ yes: true }), [], cwd)).rejects.toThrow(
			/has no scaffold recipe/,
		);
		expect(mockRunCommand).not.toHaveBeenCalled();
	});

	it('runs the preflight check before anything else, and surfaces its error', async () => {
		const preflight = vi.fn(() => {
			throw new Error('Node.js too old');
		});
		const target = makeScaffoldTarget({ preflight });
		await expect(runScaffoldMode(target, baseArgs({ yes: true }), [], cwd)).rejects.toThrow(
			'Node.js too old',
		);
		expect(preflight).toHaveBeenCalledOnce();
		expect(mockRunCommand).not.toHaveBeenCalled();
		expect(mockInput).not.toHaveBeenCalled();
	});

	it('uses --dir verbatim (sanitized) without prompting', async () => {
		const target = makeScaffoldTarget();
		await runScaffoldMode(target, baseArgs({ yes: true, dir: 'My Cool App!!' }), [], cwd);
		expect(mockInput).not.toHaveBeenCalled();
		expect(loggedText()).toContain('My-Cool-App');
	});

	it('prompts for a project name on a TTY with no --dir', async () => {
		const target = makeScaffoldTarget();
		setTTY(true);
		mockInput.mockResolvedValue('typed-name');
		await runScaffoldMode(target, baseArgs({ yes: true }), [], cwd);
		expect(mockInput).toHaveBeenCalledWith('Project directory name', 'pptx-fixture-fw-app');
		expect(loggedText()).toContain('typed-name');
	});

	it('falls back to the default name with no --dir and no TTY', async () => {
		const target = makeScaffoldTarget();
		setTTY(false);
		await runScaffoldMode(target, baseArgs({ yes: true }), [], cwd);
		expect(mockInput).not.toHaveBeenCalled();
		expect(loggedText()).toContain('pptx-fixture-fw-app');
	});

	it('includes a defaultInclude optional extra automatically off a TTY', async () => {
		const target = makeScaffoldTarget({
			optionalExtras: [{ prompt: 'Include real-time collab?', packages: ['collab-pkg'] }],
		});
		setTTY(false);
		await runScaffoldMode(target, baseArgs({ yes: true, dir: 'app' }), [], cwd);
		expect(mockConfirm).not.toHaveBeenCalled();
		// scaffoldProject issues a second runCommand call to install extraPackages
		// once the optional extra's packages are merged in.
		const installCall = mockRunCommand.mock.calls[1];
		expect(installCall[1]).toStrictEqual(expect.arrayContaining(['collab-pkg']));
	});

	it('skips a defaultInclude:false optional extra automatically off a TTY', async () => {
		const target = makeScaffoldTarget({
			optionalExtras: [
				{ prompt: 'Include experimental X?', packages: ['x-pkg'], defaultInclude: false },
			],
		});
		setTTY(false);
		await runScaffoldMode(target, baseArgs({ yes: true, dir: 'app' }), [], cwd);
		expect(mockConfirm).not.toHaveBeenCalled();
		// Only the base extraPackages install call happens; no packages beyond
		// what the recipe already declared.
		const installCall = mockRunCommand.mock.calls[1];
		expect(installCall[1]).not.toStrictEqual(expect.arrayContaining(['x-pkg']));
	});

	it('asks about each optional extra on a TTY and only merges accepted ones', async () => {
		const target = makeScaffoldTarget({
			optionalExtras: [
				{ prompt: 'Include collab?', packages: ['collab-pkg'] },
				{ prompt: 'Include analytics?', packages: ['analytics-pkg'] },
			],
		});
		setTTY(true);
		mockInput.mockResolvedValue('app');
		// Two optional-extra prompts, then the final "Continue?" gate - all three
		// go through `confirm()` on a TTY without --yes.
		mockConfirm
			.mockResolvedValueOnce(true)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		await runScaffoldMode(target, baseArgs(), [], cwd);
		expect(mockConfirm).toHaveBeenNthCalledWith(1, 'Include collab?');
		expect(mockConfirm).toHaveBeenNthCalledWith(2, 'Include analytics?');
		expect(mockConfirm).toHaveBeenNthCalledWith(3, 'Continue?');
		const installCall = mockRunCommand.mock.calls[1];
		expect(installCall[1]).toStrictEqual(expect.arrayContaining(['collab-pkg']));
		expect(installCall[1]).not.toStrictEqual(expect.arrayContaining(['analytics-pkg']));
	});

	it('skips scaffolding entirely when the user declines the final confirmation on a TTY', async () => {
		const target = makeScaffoldTarget();
		setTTY(true);
		mockInput.mockResolvedValue('app');
		mockConfirm.mockResolvedValue(false);
		await runScaffoldMode(target, baseArgs(), [], cwd);
		expect(loggedText()).toContain('Skipped.');
		expect(mockRunCommand).not.toHaveBeenCalled();
	});

	it('never blocks on the final confirmation off a TTY, even without --yes', async () => {
		const target = makeScaffoldTarget();
		setTTY(false);
		await runScaffoldMode(target, baseArgs({ dir: 'app' }), [], cwd);
		expect(mockConfirm).not.toHaveBeenCalled();
		expect(mockRunCommand).toHaveBeenCalledWith(
			'npx',
			['--yes', 'create-fixture@latest', 'app', '--template', 'fixture'],
			cwd,
			{ silent: true },
		);
	});

	it('warns when none of the entry candidates exist to patch', async () => {
		const target = makeScaffoldTarget();
		await runScaffoldMode(target, baseArgs({ yes: true, dir: 'app' }), [], cwd);
		expect(loggedText()).toContain('could not find an entry file');
	});

	it('patches the entry file on disk when a candidate already exists', async () => {
		const projectName = 'app';
		mkdirSync(join(cwd, projectName, 'src'), { recursive: true });
		writeFileSync(join(cwd, projectName, 'src', 'App.fixture'), '// stale starter content');
		const target = makeScaffoldTarget();
		await runScaffoldMode(target, baseArgs({ yes: true, dir: projectName }), [], cwd);
		expect(loggedText()).not.toContain('could not find an entry file');
		const written = readFileSync(join(cwd, projectName, 'src', 'App.fixture'), 'utf8');
		expect(written).toBe('// fixture entry');
	});

	it('prints config-only targets (e.g. MCP) after a successful scaffold', async () => {
		const target = makeScaffoldTarget();
		const mcp = makeTarget({ id: 'mcp', mode: 'print-config', nextSteps: 'MCP CONFIG SNIPPET' });
		await runScaffoldMode(target, baseArgs({ yes: true, dir: 'app' }), [mcp], cwd);
		expect(loggedText()).toContain('MCP CONFIG SNIPPET');
	});

	it('starts the dev server after a successful scaffold', async () => {
		const target = makeScaffoldTarget();
		await runScaffoldMode(target, baseArgs({ yes: true, dir: 'app', pm: 'pnpm' }), [], cwd);
		const devCall = mockRunCommand.mock.calls.at(-1)!;
		expect(devCall[0]).toBe('pnpm');
		expect(devCall[1]).toStrictEqual(['run', 'dev']);
		expect(devCall[2]).toBe(join(cwd, 'app'));
	});

	it('prints manual fallback instructions when the dev server exits non-zero', async () => {
		// [0] scaffolder call, [1] extraPackages install (the fixture recipe has
		// one), [2] the dev server - only the last one fails here.
		mockRunCommand.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
		const target = makeScaffoldTarget();
		await runScaffoldMode(target, baseArgs({ yes: true, dir: 'app', pm: 'npm' }), [], cwd);
		expect(loggedText()).toContain('cd app');
		expect(loggedText()).toContain('npm run dev');
	});

	it('propagates a scaffold-command failure without starting a dev server', async () => {
		mockRunCommand.mockResolvedValueOnce(1);
		const target = makeScaffoldTarget();
		await expect(
			runScaffoldMode(target, baseArgs({ yes: true, dir: 'app' }), [], cwd),
		).rejects.toThrow(/create-fixture@latest exited with code 1/);
		expect(mockRunCommand).toHaveBeenCalledOnce();
	});
});

describe('runInstallMode', () => {
	let cwd: string;

	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), 'orchestrate-install-'));
	});

	afterEach(() => {
		rmSync(cwd, { recursive: true, force: true });
	});

	function writePackageJson(): void {
		writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.0' }));
	}

	it('only prints config-target next steps when nothing needs installing', async () => {
		const mcp = makeTarget({ id: 'mcp', mode: 'print-config', nextSteps: 'MCP CONFIG SNIPPET' });
		await runInstallMode([], [mcp], baseArgs(), cwd);
		expect(loggedText()).toContain('MCP CONFIG SNIPPET');
		expect(mockRunCommand).not.toHaveBeenCalled();
	});

	it('rejects when no package.json exists in cwd', async () => {
		const fw = makeTarget();
		await expect(runInstallMode([fw], [], baseArgs({ yes: true }), cwd)).rejects.toThrow(
			/No package\.json found/,
		);
		expect(mockRunCommand).not.toHaveBeenCalled();
	});

	it('aborts without installing when the user declines a compat warning', async () => {
		writePackageJson();
		const react = TARGETS.find((t) => t.id === 'react')!;
		mkdirSync(join(cwd, 'node_modules', 'react'), { recursive: true });
		writeFileSync(
			join(cwd, 'node_modules', 'react', 'package.json'),
			JSON.stringify({ version: '17.0.2' }),
		);
		setTTY(true);
		mockConfirm.mockResolvedValue(false);
		await runInstallMode([react], [], baseArgs(), cwd);
		expect(loggedText()).toContain('Aborted.');
		expect(mockRunCommand).not.toHaveBeenCalled();
	});

	it('installs immediately with --yes, no confirmation prompt', async () => {
		writePackageJson();
		const fw = makeTarget();
		await runInstallMode([fw], [], baseArgs({ yes: true, pm: 'npm' }), cwd);
		expect(mockConfirm).not.toHaveBeenCalled();
		expect(mockRunCommand).toHaveBeenCalledWith('npm', ['install', 'fixture-pkg'], cwd);
		expect(loggedText()).toContain('Fixture next steps');
	});

	it('skips the install and prints the manual command when declined on a TTY', async () => {
		writePackageJson();
		const fw = makeTarget();
		setTTY(true);
		mockConfirm.mockResolvedValue(false);
		await runInstallMode([fw], [], baseArgs({ pm: 'npm' }), cwd);
		expect(mockRunCommand).not.toHaveBeenCalled();
		expect(loggedText()).toContain('npm install fixture-pkg');
	});

	it('installs after an accepted confirmation on a TTY', async () => {
		writePackageJson();
		const fw = makeTarget();
		setTTY(true);
		mockConfirm.mockResolvedValue(true);
		await runInstallMode([fw], [], baseArgs({ pm: 'npm' }), cwd);
		expect(mockRunCommand).toHaveBeenCalledWith('npm', ['install', 'fixture-pkg'], cwd);
	});

	it('never blocks on confirmation off a TTY, even without --yes', async () => {
		writePackageJson();
		const fw = makeTarget();
		setTTY(false);
		await runInstallMode([fw], [], baseArgs({ pm: 'npm' }), cwd);
		expect(mockConfirm).not.toHaveBeenCalled();
		expect(mockRunCommand).toHaveBeenCalledWith('npm', ['install', 'fixture-pkg'], cwd);
	});

	it('rejects when the install command exits non-zero', async () => {
		writePackageJson();
		mockRunCommand.mockResolvedValue(1);
		const fw = makeTarget();
		await expect(runInstallMode([fw], [], baseArgs({ yes: true, pm: 'npm' }), cwd)).rejects.toThrow(
			/npm exited with code 1/,
		);
	});

	it('merges packages across multiple install targets and dedupes shared ones', async () => {
		writePackageJson();
		const a = makeTarget({ id: 'a', packages: ['shared-pkg', 'a-only'] });
		const b = makeTarget({ id: 'b', packages: ['shared-pkg', 'b-only'] });
		await runInstallMode([a, b], [], baseArgs({ yes: true, pm: 'npm' }), cwd);
		expect(mockRunCommand).toHaveBeenCalledWith(
			'npm',
			['install', 'shared-pkg', 'a-only', 'b-only'],
			cwd,
		);
	});

	it('prints both install-target and config-target next steps together', async () => {
		writePackageJson();
		const fw = makeTarget({ nextSteps: 'INSTALL NEXT STEPS' });
		const mcp = makeTarget({ id: 'mcp', mode: 'print-config', nextSteps: 'CONFIG NEXT STEPS' });
		await runInstallMode([fw], [mcp], baseArgs({ yes: true, pm: 'npm' }), cwd);
		const text = loggedText();
		expect(text).toContain('INSTALL NEXT STEPS');
		expect(text).toContain('CONFIG NEXT STEPS');
	});

	it('respects an explicit --pm override', async () => {
		writePackageJson();
		const fw = makeTarget();
		await runInstallMode([fw], [], baseArgs({ yes: true, pm: 'pnpm' }), cwd);
		expect(mockRunCommand).toHaveBeenCalledWith('pnpm', ['add', 'fixture-pkg'], cwd);
	});
});

describe('runCli (end-to-end argv wiring, real TARGETS)', () => {
	let cwd: string;
	let originalArgv: string[];
	let originalCwd: () => string;
	let exitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), 'orchestrate-cli-'));
		originalArgv = process.argv;
		originalCwd = process.cwd;
		process.cwd = () => cwd;
		exitSpy = vi.spyOn(process, 'exit').mockReturnValue(undefined as never);
	});

	afterEach(() => {
		process.argv = originalArgv;
		process.cwd = originalCwd;
		rmSync(cwd, { recursive: true, force: true });
	});

	function setArgv(...args: string[]): void {
		process.argv = ['node', 'cli.js', ...args];
	}

	it('--help prints usage without touching the filesystem or spawning anything', async () => {
		setArgv('--help');
		await runCli();
		expect(loggedText()).toContain('Usage:');
		expect(mockRunCommand).not.toHaveBeenCalled();
		expect(exitSpy).not.toHaveBeenCalled();
	});

	it('installs a single UI binding end-to-end with --target and --yes', async () => {
		writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'x' }));
		setArgv('--target', 'react', '--yes', '--pm', 'npm');
		await runCli();
		expect(mockRunCommand).toHaveBeenCalledOnce();
		const [command, args, invokedCwd] = mockRunCommand.mock.calls[0];
		expect(command).toBe('npm');
		expect(args[0]).toBe('install');
		expect(args).toContain('pptx-react-viewer');
		expect(invokedCwd).toBe(cwd);
		expect(loggedText()).toContain('PowerPointViewer');
	});

	it('rejects two UI frameworks selected together', async () => {
		setArgv('--target', 'vue,angular', '--yes');
		await expect(runCli()).rejects.toThrow(/can't be selected together/);
		expect(mockRunCommand).not.toHaveBeenCalled();
	});

	it('rejects an unknown --target id', async () => {
		setArgv('--target', 'not-a-real-target');
		await expect(runCli()).rejects.toThrow(/Unknown target "not-a-real-target"/);
	});

	it('rejects a non-interactive run with no --target', async () => {
		setTTY(false);
		setArgv();
		await expect(runCli()).rejects.toThrow(/Not running in a terminal/);
	});

	it('the MCP target prints config without installing or needing a package.json', async () => {
		setArgv('--target', 'mcp', '--yes');
		await runCli();
		expect(mockRunCommand).not.toHaveBeenCalled();
		expect(loggedText()).toContain('mcpServers');
	});

	it('installs a UI binding plus MCP together in one run', async () => {
		writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'x' }));
		setArgv('--target', 'react,mcp', '--yes', '--pm', 'npm');
		await runCli();
		expect(mockRunCommand).toHaveBeenCalledOnce();
		const text = loggedText();
		expect(text).toContain('PowerPointViewer');
		expect(text).toContain('mcpServers');
	});

	it('scaffolds a fresh project end-to-end with --scaffold --yes', async () => {
		setTTY(false);
		setArgv('--target', 'vanilla', '--scaffold', '--yes', '--dir', 'my-vanilla-app', '--pm', 'npm');
		await runCli();
		expect(loggedText()).toContain('About to scaffold');
		expect(loggedText()).toContain('my-vanilla-app');
		// The scaffolder call plus the dev-server call, at minimum.
		expect(mockRunCommand.mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it('rejects --scaffold combined with a non-scaffoldable single target', async () => {
		setArgv('--target', 'core', '--scaffold', '--yes');
		await expect(runCli()).rejects.toThrow(/--scaffold requires exactly one of/);
	});
});
