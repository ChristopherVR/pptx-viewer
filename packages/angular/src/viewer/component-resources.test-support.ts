import { readFileSync } from 'node:fs';

import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

export function readViewerTestResource(url: string): string {
	return readFileSync(new URL(url, import.meta.url), 'utf8');
}

/** Load authored external templates before plain JIT TestBed inspects a component. */
export function resolveViewerComponentResources(): Promise<void> {
	return resolveComponentResources(async (url) => readViewerTestResource(url));
}
