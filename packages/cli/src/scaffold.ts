import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { installCommand } from './package-manager';
import type { PackageManager } from './package-manager';
import { runCommand } from './run-command';
import type { ScaffoldRecipe } from './targets';

/** Keep a user-supplied project name filesystem- and shell-safe (see run-command.ts). */
export function sanitizeProjectName(name: string): string {
	const cleaned = name
		.trim()
		.replace(/[^a-zA-Z0-9._-]+/gu, '-')
		.replace(/-{2,}/gu, '-')
		.replace(/^-+|-+$/gu, '');
	return cleaned || 'pptx-viewer-app';
}

/** The first of `candidates` (relative paths) that exists under `projectDir`, or null. */
export function findEntryFile(projectDir: string, candidates: string[]): string | null {
	for (const candidate of candidates) {
		if (existsSync(join(projectDir, candidate))) {
			return candidate;
		}
	}
	return null;
}

export interface ScaffoldResult {
	projectDir: string;
	/** Relative path of the entry file that got overwritten, or null if none of `entryCandidates` matched. */
	patchedFile: string | null;
}

/**
 * Bootstrap a new project with the framework's own scaffolding tool (Vite, Angular
 * CLI, ...), wire in the pptx-viewer quick-start example, then install the viewer
 * package and its companions.
 */
export async function scaffoldProject(
	recipe: ScaffoldRecipe,
	projectName: string,
	pm: PackageManager,
	cwd: string,
): Promise<ScaffoldResult> {
	// Run the scaffolder silently: its "Done. Now run: cd ..." messages are
	// confusing because our own post-scaffold steps haven't completed yet.
	const scaffoldExit = await runCommand(
		'npx',
		['--yes', recipe.command, ...recipe.args(projectName)],
		cwd,
		{ silent: true },
	);
	if (scaffoldExit !== 0) {
		throw new Error(`${recipe.command} exited with code ${scaffoldExit}`);
	}

	const projectDir = join(cwd, projectName);
	const patchedFile = findEntryFile(projectDir, recipe.entryCandidates);
	if (patchedFile) {
		writeFileSync(join(projectDir, patchedFile), recipe.entryContent);
	}

	// Write any extra files the recipe defines (i18n setup, main.ts overrides, etc.)
	if (recipe.extraFiles) {
		for (const [relativePath, content] of Object.entries(recipe.extraFiles)) {
			const fullPath = join(projectDir, relativePath);
			mkdirSync(dirname(fullPath), { recursive: true });
			writeFileSync(fullPath, content);
		}
	}

	if (recipe.extraPackages.length > 0) {
		const [command, args] = installCommand(pm, recipe.extraPackages);
		const installExit = await runCommand(command, args, projectDir);
		if (installExit !== 0) {
			throw new Error(`${command} exited with code ${installExit}`);
		}
	}

	return { projectDir, patchedFile };
}
