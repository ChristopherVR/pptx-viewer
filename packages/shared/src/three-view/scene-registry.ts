/**
 * Maps a {@link ThreeViewSpec} `kind` to its lazily-imported scene factory.
 *
 * Each scene module is a separate dynamic import, so a deck with only charts
 * never downloads the SmartArt scene code (and vice versa), and nothing here
 * pulls `three` into the main bundle: scenes receive `three` through their
 * mount context.
 *
 * @module three-view/scene-registry
 */
import type { ThreeViewSceneFactory, ThreeViewSpec } from './types';

type SpecOf<K extends ThreeViewSpec['kind']> = Extract<ThreeViewSpec, { kind: K }>['spec'];

type Loader<K extends ThreeViewSpec['kind']> = () => Promise<ThreeViewSceneFactory<SpecOf<K>>>;

const loaders: { [K in ThreeViewSpec['kind']]: Loader<K> } = {
	chart: async () => (await import('../render/chart-3d-view-scene')).mountChart3DView,
	smartart: async () => (await import('../smartart-3d/view-scene')).mountSmartArt3DView,
};

/** Resolve the scene factory for a spec kind. */
export async function loadThreeViewScene<K extends ThreeViewSpec['kind']>(
	kind: K,
): Promise<ThreeViewSceneFactory<SpecOf<K>>> {
	return loaders[kind]() as Promise<ThreeViewSceneFactory<SpecOf<K>>>;
}
