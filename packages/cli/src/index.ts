#!/usr/bin/env node
import { existsSync } from 'node:fs';

import { parseArgs } from './args';
import type { ParsedArgs } from './args';
import { bold, cyan, dim, gray, green, red, yellow } from './colors';
import { checkCompat } from './compat';
import { detectPackageManager, installCommand } from './package-manager';
import { confirm, input, multiSelect, selectOption } from './prompt';
import { assertSingleFramework, findTargetsByIds, mergePackages, parseTargetIds } from './resolve';
import { runCommand } from './run-command';
import { sanitizeProjectName, scaffoldProject } from './scaffold';
import { TARGETS } from './targets';
import type { Target } from './targets';

function printBanner(): void {
	console.log(`\n${bold(cyan('pptx-viewer'))} ${dim('· interactive installer')}`);
}

function printUsage(): void {
	printBanner();
	console.log(`
${bold('Usage:')} npx @christophervr/pptx-viewer [options]

${bold('Options:')}
  ${cyan('--target <ids>')}  Skip the picker; comma-separated, any of: ${TARGETS.map((t) => t.id).join(', ')}
                   (react, vue, and angular are mutually exclusive; pick at most one)
  ${cyan('--scaffold')}      Bootstrap a brand-new starter project instead of installing here
  ${cyan('--dir <name>')}    Project directory name for --scaffold
  ${cyan('--pm <manager>')}  Package manager to use: bun, pnpm, yarn, npm (default: auto-detected)
  ${cyan('--yes, -y')}       Skip confirmation prompts
  ${cyan('--help, -h')}      Show this help

${bold('Examples:')}
  ${gray('npx @christophervr/pptx-viewer')}
  ${gray('npx @christophervr/pptx-viewer --target react,mcp --yes')}
  ${gray('npx @christophervr/pptx-viewer --target react --scaffold --dir my-app --yes')}
`);
}

async function resolveTargets(requested: string | undefined): Promise<Target[]> {
	if (requested) {
		const targets = findTargetsByIds(parseTargetIds(requested));
		console.log(`${green('✔')} ${targets.map((t) => t.label).join(', ')}`);
		return targets;
	}
	if (!process.stdin.isTTY) {
		throw new Error('Not running in a terminal: pass --target explicitly (see --help).');
	}
	return multiSelect(
		'What are you building with pptx-viewer? (you can pick more than one)',
		TARGETS,
	);
}

/** Ask the user to confirm past a compatibility warning; non-interactively, just warn and proceed. */
async function confirmCompat(cwd: string, targets: Target[]): Promise<boolean> {
	for (const target of targets) {
		const result = checkCompat(cwd, target);
		if (result.compatible) {
			continue;
		}
		console.log(`\n${yellow('Warning:')} ${result.message}`);
		if (process.stdin.isTTY) {
			const proceed = await confirm('Continue anyway?');
			if (!proceed) {
				return false;
			}
		}
	}
	return true;
}

interface ScaffoldChoice {
	useScaffold: boolean;
	scaffoldTarget?: Target;
}

/** Decide install-vs-scaffold. Scaffolding is only offered when exactly one scaffoldable target is picked. */
async function resolveScaffoldChoice(
	installTargets: Target[],
	args: ParsedArgs,
): Promise<ScaffoldChoice> {
	// At most one scaffoldable (react/vue/angular) target can reach here:
	// assertSingleFramework already rejected picking more than one in main().
	const scaffoldable = installTargets.filter((t) => t.scaffold);

	if (args.scaffold) {
		if (scaffoldable.length !== 1) {
			throw new Error('--scaffold requires exactly one of: react, vue, angular to be selected.');
		}
		return { useScaffold: true, scaffoldTarget: scaffoldable[0] };
	}

	if (scaffoldable.length === 1 && process.stdin.isTTY) {
		const choice = await selectOption('Install into the current project, or scaffold a new one?', [
			{ label: 'Install here', description: 'Add the package(s) to the project in this directory' },
			{
				label: 'Scaffold a new project',
				description: 'Bootstrap a brand-new starter app in its own folder',
			},
		]);
		return {
			useScaffold: choice.label === 'Scaffold a new project',
			scaffoldTarget: scaffoldable[0],
		};
	}

	return { useScaffold: false };
}

async function runScaffoldMode(
	target: Target,
	args: ParsedArgs,
	configTargets: Target[],
	cwd: string,
): Promise<void> {
	const recipe = target.scaffold;
	if (!recipe) {
		throw new Error(`${target.label} has no scaffold recipe.`);
	}

	const defaultName = `pptx-${target.id}-app`;
	const rawName =
		args.dir ??
		(process.stdin.isTTY ? await input('Project directory name', defaultName) : defaultName);
	const projectName = sanitizeProjectName(rawName);
	const pm = args.pm ?? detectPackageManager(cwd);

	console.log(
		`\n${bold('About to scaffold')} "${cyan(projectName)}" with ${recipe.command} (${target.label}), then install with ${pm}.\n`,
	);
	if (!args.yes && process.stdin.isTTY) {
		const proceed = await confirm('Continue?');
		if (!proceed) {
			console.log(`\n${dim('Skipped.')}`);
			return;
		}
	}

	const result = await scaffoldProject(recipe, projectName, pm, cwd);
	if (!result.patchedFile) {
		console.log(
			`\n${yellow('Scaffolded the project, but could not find an entry file to wire up automatically.')} ` +
				`See the quick-start snippet below and add it yourself.`,
		);
	}

	console.log(
		`\n${green('✔')} ${bold('Done.')} Next steps:\n\n  ${cyan(`cd ${projectName}`)}\n  ${cyan(`${pm} run dev`)}\n\n${target.nextSteps}\n`,
	);
	for (const configTarget of configTargets) {
		console.log(`${configTarget.nextSteps}\n`);
	}
}

async function runInstallMode(
	installTargets: Target[],
	configTargets: Target[],
	args: ParsedArgs,
	cwd: string,
): Promise<void> {
	if (installTargets.length > 0) {
		if (!existsSync(`${cwd}/package.json`)) {
			throw new Error(
				`No package.json found in ${cwd}. Run "npm init -y" first, then re-run this command.`,
			);
		}

		const proceedPastCompat = await confirmCompat(cwd, installTargets);
		if (!proceedPastCompat) {
			console.log(`\n${red('Aborted.')}`);
			return;
		}

		const packages = mergePackages(installTargets);
		const pm = args.pm ?? detectPackageManager(cwd);
		const [command, cmdArgs] = installCommand(pm, packages);
		console.log(`\n${bold('About to run:')} ${cyan(`${command} ${cmdArgs.join(' ')}`)}\n`);

		if (!args.yes && process.stdin.isTTY) {
			const proceed = await confirm('Install now?');
			if (!proceed) {
				console.log(
					`\n${dim('Skipped.')} Run this yourself when ready:\n  ${cyan(`${command} ${cmdArgs.join(' ')}`)}\n`,
				);
				return;
			}
		}

		const exitCode = await runCommand(command, cmdArgs, cwd);
		if (exitCode !== 0) {
			throw new Error(`${command} exited with code ${exitCode}`);
		}

		console.log(`\n${green('✔')} ${bold('Done.')} Next steps:`);
		for (const target of installTargets) {
			console.log(`\n${target.nextSteps}\n`);
		}
	}

	for (const target of configTargets) {
		console.log(`\n${target.nextSteps}\n`);
	}
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printUsage();
		return;
	}

	printBanner();
	const targets = await resolveTargets(args.target);
	assertSingleFramework(targets);

	const installTargets = targets.filter((t) => t.mode === 'install');
	const configTargets = targets.filter((t) => t.mode === 'print-config');
	const cwd = process.cwd();

	const { useScaffold, scaffoldTarget } = await resolveScaffoldChoice(installTargets, args);
	if (useScaffold && scaffoldTarget) {
		await runScaffoldMode(scaffoldTarget, args, configTargets, cwd);
		return;
	}

	await runInstallMode(installTargets, configTargets, args, cwd);
}

main().catch((err: unknown) => {
	const message = err instanceof Error ? err.message : String(err);
	console.error(`${red('✘ Error:')} ${message}`);
	process.exit(1);
});
