/**
 * bar-chart-3d-materials.ts: turns {@link resolveBarBoxFaceFills}'s (or, for a
 * round shape, {@link resolveBarRoundFaceFills}'s) pure per-face fill
 * descriptors into the actual `THREE.Material`(s) for one bar3D mesh, loading
 * `c:pictureOptions` picture-fill textures asynchronously.
 *
 * A mesh with no picture fill anywhere keeps the pre-existing single uniform
 * `MeshPhongMaterial` (no behaviour change, no texture-loader overhead) - see
 * {@link resolveBarBoxFaceFills}/{@link resolveBarRoundFaceFills}'s own "all
 * plain colour" fast path. Once a picture is resolved for at least one face,
 * this always builds a face-material array (a 6-entry array in three's own
 * `BoxGeometry` per-face order, `+x,-x,+y,-y,+z,-z`, for a `box`; a 3-entry
 * array in `CylinderGeometry`/`ConeGeometry`'s own material-group order,
 * lateral surface/top cap/bottom cap, for a round shape), even for faces that
 * stay plain-coloured, since a `THREE.Mesh` cannot mix a single material with
 * a per-face array on the same geometry.
 *
 * Texture loads are async: every picture-targeted face mounts with a plain
 * white `MeshPhongMaterial` (so the box is never invisible/black while
 * loading) and swaps in `material.map` once the image decodes. The scene's
 * own render loop is continuous (`requestAnimationFrame` every frame, not
 * on-demand), so the swapped-in texture appears on the very next frame with
 * no extra "re-render" plumbing needed here.
 *
 * @module bar-chart-3d-materials
 */
import type * as THREE from 'three';

import type { BarBoxFaceFill } from './bar-chart-3d-face-fill';
import {
	resolveBarBoxFaceFills,
	resolveBarRoundFaceFills,
	uniformBoxColor,
	uniformRoundColor,
} from './bar-chart-3d-face-fill';
import type { BarChart3DBox } from './bar-chart-3d-layout';
import type { ChartSeriesLike } from './chart-datapoint-style';

type ThreeModule = typeof THREE;

/** `c:ser`/`c:dPt` picture-fill inputs threaded into the interactive bar3D scene. */
export interface BarBoxPictureContext {
	series: ReadonlyArray<ChartSeriesLike>;
}

/**
 * Loads and caches picture-fill textures for one mounted bar3D scene: two
 * boxes referencing the same `c:ser/c:pictureOptions` (or the same `c:dPt`
 * image reused across points) share one underlying image load, only cloning
 * the decoded texture per face so each face's own repeat/offset stays
 * independent.
 */
export interface BarChart3DTextureManager {
	/** Load (or reuse a cached, in-flight) base texture for `url`. */
	load: (url: string) => Promise<THREE.Texture>;
	/** Dispose every base texture this manager has loaded. Call once, on scene teardown, after every box's own {@link BarBoxMaterialResult.dispose}. */
	disposeAll: () => void;
}

/** Create a texture manager backed by `three.TextureLoader`, scoped to one mounted scene. */
export function createBarChart3DTextureManager(three: ThreeModule): BarChart3DTextureManager {
	const loader = new three.TextureLoader();
	const cache = new Map<string, Promise<THREE.Texture>>();
	const loaded: THREE.Texture[] = [];

	return {
		load(url: string): Promise<THREE.Texture> {
			const cached = cache.get(url);
			if (cached) {
				return cached;
			}
			const pending = new Promise<THREE.Texture>((resolve, reject) => {
				loader.load(
					url,
					(texture) => {
						loaded.push(texture);
						resolve(texture);
					},
					undefined,
					reject,
				);
			});
			cache.set(url, pending);
			return pending;
		},
		disposeAll() {
			for (const texture of loaded) {
				texture.dispose();
			}
			loaded.length = 0;
			cache.clear();
		},
	};
}

/** Everything one box mesh's picture-fill materials need: series/context plus the scene's shared texture manager. */
export interface BarBoxPictureAssets {
	context: BarBoxPictureContext;
	textures: BarChart3DTextureManager;
}

/** The material(s) for one bar3D box mesh, plus how to free every resource it owns. */
export interface BarBoxMaterialResult {
	/** A single material (no picture anywhere on this box) or a 6-entry `BoxGeometry` face-material array. */
	material: THREE.Material | THREE.Material[];
	/** Dispose every material this box owns, and any texture clone it created (never the shared base textures; see {@link BarChart3DTextureManager.disposeAll}). */
	dispose: () => void;
}

const FACE_ORDER: ReadonlyArray<'posX' | 'negX' | 'posY' | 'negY' | 'posZ' | 'negZ'> = [
	'posX',
	'negX',
	'posY',
	'negY',
	'posZ',
	'negZ',
];

function buildColorMaterial(three: ThreeModule, color: string): THREE.MeshPhongMaterial {
	return new three.MeshPhongMaterial({ color, shininess: 30 });
}

/**
 * Build one `BoxGeometry` face's material. A picture face mounts a plain
 * white `MeshPhongMaterial` (white so `map * color` paints the picture
 * unmodified once it lands, matching the SVG `<pattern>` fill) and swaps its
 * `map` in once the shared texture manager resolves the image, cloning the
 * base texture so this face's own `repeat` never affects a sibling face or
 * box sharing the same underlying image. `isDisposed` guards the async
 * continuation against a box disposed (e.g. the chart unmounted, or the deck
 * navigated away) before its texture finished loading.
 */
function buildFaceMaterial(
	three: ThreeModule,
	fill: BarBoxFaceFill,
	textures: BarChart3DTextureManager,
	ownedTextures: THREE.Texture[],
	isDisposed: () => boolean,
): THREE.Material {
	if (fill.kind === 'color') {
		return buildColorMaterial(three, fill.color);
	}
	const material = buildColorMaterial(three, '#ffffff');
	textures
		.load(fill.imageUrl)
		.then((base) => {
			const texture = base.clone();
			texture.wrapS = three.RepeatWrapping;
			texture.wrapT = three.RepeatWrapping;
			texture.repeat.set(fill.repeatX, fill.repeatY);
			texture.needsUpdate = true;
			if (isDisposed()) {
				texture.dispose();
				return undefined;
			}
			ownedTextures.push(texture);
			material.map = texture;
			material.needsUpdate = true;
			return undefined;
		})
		.catch(() => {
			// Image failed to load/decode: keep the white fallback material
			// rather than throwing out of an async continuation, matching every
			// other optional-asset load in this renderer.
		});
	return material;
}

/** Build a `BarBoxMaterialResult` from an already-resolved fill array, one material per array entry (matching order = matching `THREE` `materialIndex`). */
function buildMaterialArrayResult(
	three: ThreeModule,
	fills: readonly BarBoxFaceFill[],
	textures: BarChart3DTextureManager,
): BarBoxMaterialResult {
	let disposed = false;
	const ownedTextures: THREE.Texture[] = [];
	const materials = fills.map((fill) =>
		buildFaceMaterial(three, fill, textures, ownedTextures, () => disposed),
	);
	return {
		material: materials,
		dispose: () => {
			disposed = true;
			for (const material of materials) {
				material.dispose();
			}
			for (const texture of ownedTextures) {
				texture.dispose();
			}
		},
	};
}

/**
 * Build the material(s) for one bar3D mesh. `assets` is `undefined` for a
 * scene mounted with no series/picture context (every pre-existing caller),
 * which keeps the original single uniform `MeshPhongMaterial` behaviour
 * unchanged. When `assets` is given: a `box`-shaped bar resolves
 * {@link resolveBarBoxFaceFills} (up to a 6-entry `BoxGeometry` face-material
 * array); a round shape (cylinder/cone/pyramid/coneToMax/pyramidToMax)
 * resolves {@link resolveBarRoundFaceFills} (up to a 3-entry
 * `CylinderGeometry`/`ConeGeometry` material-group array: lateral surface,
 * top cap, bottom cap - see this module's `BarRoundFaceFills` import for the
 * `materialIndex` order this array must match). Either shape returns a
 * single uniform material instead when no picture targets any of its faces
 * (the common no-picture case), same as before per-face targeting existed.
 */
export function buildBarBoxMaterial(
	three: ThreeModule,
	box: BarChart3DBox,
	assets: BarBoxPictureAssets | undefined,
): BarBoxMaterialResult {
	if (!assets) {
		const material = buildColorMaterial(three, box.color);
		return { material, dispose: () => material.dispose() };
	}

	const isRound = box.shape !== undefined && box.shape !== 'box';
	if (isRound) {
		const roundFills = resolveBarRoundFaceFills(box, assets.context.series);
		const solid = uniformRoundColor(roundFills);
		if (solid !== undefined) {
			const material = buildColorMaterial(three, solid);
			return { material, dispose: () => material.dispose() };
		}
		return buildMaterialArrayResult(
			three,
			[roundFills.side, roundFills.end, roundFills.bottom],
			assets.textures,
		);
	}

	const fills = resolveBarBoxFaceFills(box, assets.context.series);
	const solid = uniformBoxColor(fills);
	if (solid !== undefined) {
		const material = buildColorMaterial(three, solid);
		return { material, dispose: () => material.dispose() };
	}
	return buildMaterialArrayResult(
		three,
		FACE_ORDER.map((face) => fills[face]),
		assets.textures,
	);
}
