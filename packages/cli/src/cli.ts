#!/usr/bin/env node
import { red } from './colors';
import { runCli } from './orchestrate';

runCli().catch((err: unknown) => {
	const message = err instanceof Error ? err.message : String(err);
	console.error(`${red('✘ Error:')} ${message}`);
	process.exit(1);
});
