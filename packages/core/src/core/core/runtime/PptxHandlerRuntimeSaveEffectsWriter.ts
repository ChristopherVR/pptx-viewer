import { XmlObject } from '../../types';
import type { ShapeStyle } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveShapeStyleWriter';
import { writeShapeEffects } from './save-shape-effects';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Serialize visual effects (shadow, glow, reflection, blur, soft edge),
	 * effectDag, 3D scene, and 3D shape properties to the given spPr XML object.
	 *
	 * The whole body lives in {@link writeShapeEffects} as a free function so
	 * the colocated unit test can import and drive the REAL logic (it used to
	 * keep a private copy - "its mixin chain crashes on load" - which meant it
	 * could not fail when production drifted). This method only supplies the
	 * runtime-bound effect builders.
	 */
	protected applyEffectsAndThreeD(spPr: XmlObject, shapeStyle: ShapeStyle): void {
		// When the shape carries a preset-shadow name, prefer prstShdw over the
		// generic outerShdw to preserve PowerPoint's preset-shadow semantics
		// (CT_PresetShadowEffect §20.1.8.49).
		const presetShadowXml = shapeStyle.presetShadowName
			? this.buildPresetShadowXml(shapeStyle)
			: undefined;
		writeShapeEffects(spPr, shapeStyle, {
			outerShadowXml: presetShadowXml ? undefined : this.buildOuterShadowXml(shapeStyle),
			presetShadowXml,
			innerShadowXml: this.buildInnerShadowXml(shapeStyle),
			glowXml: this.buildGlowXml(shapeStyle),
			softEdgeXml: this.buildSoftEdgeXml(shapeStyle),
			reflectionXml: this.buildReflectionXml(shapeStyle),
			blurXml: this.buildBlurXml(shapeStyle),
			fillOverlayXml: this.buildFillOverlayXml(shapeStyle),
		});
	}
}
