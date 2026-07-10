import type { ElementRendererRegistry } from '../types';
import { renderChartElement } from './chart';
import { renderTableElement } from './table';

/**
 * Register the `table` and `chart` renderers on a registry.
 *
 * Kept separate from `createDefaultRegistry` (in `./index.ts`) so the default
 * registry wiring can adopt these renderers in one place without this module
 * touching the registry file; hosts can also call it on a custom registry.
 */
export function registerTableChartRenderers(registry: ElementRendererRegistry): void {
	registry.register('table', renderTableElement);
	registry.register('chart', renderChartElement);
}
