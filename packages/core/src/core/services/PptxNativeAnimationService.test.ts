import { describe, it, expect } from "vitest";
import type { XmlObject } from "../types";
import { PptxNativeAnimationService } from "./PptxNativeAnimationService";

/**
 * Helper: wrap an animation effect in a minimal p:sld > p:timing > p:tnLst tree.
 * The `effectCTn` should be a `p:cTn` content for the effect node.
 */
function buildSlideXmlWithTiming(timingContent: XmlObject): XmlObject {
	return {
		"p:sld": {
			"p:timing": timingContent,
		},
	};
}

/**
 * Build a minimal timing tree with a single entrance animation effect.
 */
function buildSimpleEntranceSlide(
	shapeId: string,
	opts?: {
		presetId?: number;
		duration?: number;
		delay?: number;
		nodeType?: string;
	},
): XmlObject {
	const presetId = opts?.presetId ?? 10;
	const duration = opts?.duration ?? 500;
	const delay = opts?.delay ?? 0;
	const nodeType = opts?.nodeType ?? "clickEffect";

	return buildSlideXmlWithTiming({
		"p:tnLst": {
			"p:par": {
				"p:cTn": {
					"@_id": "1",
					"@_dur": "indefinite",
					"@_restart": "never",
					"@_nodeType": "tmRoot",
					"p:childTnLst": {
						"p:seq": {
							"p:cTn": {
								"@_id": "2",
								"@_dur": "indefinite",
								"@_nodeType": "mainSeq",
								"p:childTnLst": {
									"p:par": {
										"p:cTn": {
											"@_id": "3",
											"@_fill": "hold",
											"p:stCondLst": {
												"p:cond": {
													"@_delay": "indefinite",
												},
											},
											"p:childTnLst": {
												"p:par": {
													"p:cTn": {
														"@_id": "4",
														"@_presetID": String(presetId),
														"@_presetClass": "entr",
														"@_dur": String(duration),
														"@_delay": delay > 0 ? String(delay) : undefined,
														"@_nodeType": nodeType,
														"p:childTnLst": {
															"p:animEffect": {
																"p:cBhvr": {
																	"p:tgtEl": {
																		"p:spTgt": {
																			"@_spid": shapeId,
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	});
}

describe("PptxNativeAnimationService", () => {
	const service = new PptxNativeAnimationService();

	// -----------------------------------------------------------------------
	// parseNativeAnimations - basic cases
	// -----------------------------------------------------------------------
	describe("parseNativeAnimations", () => {
		it("returns undefined for empty object", () => {
			expect(service.parseNativeAnimations({})).toBeUndefined();
		});

		it("returns undefined when p:sld is missing", () => {
			expect(service.parseNativeAnimations({ foo: "bar" })).toBeUndefined();
		});

		it("returns undefined when p:timing is missing", () => {
			expect(
				service.parseNativeAnimations({ "p:sld": {} }),
			).toBeUndefined();
		});

		it("returns undefined when p:timing is not an object", () => {
			expect(
				service.parseNativeAnimations({
					"p:sld": { "p:timing": "invalid" },
				}),
			).toBeUndefined();
		});

		it("returns undefined when p:tnLst is missing", () => {
			expect(
				service.parseNativeAnimations({
					"p:sld": { "p:timing": {} },
				}),
			).toBeUndefined();
		});

		it("returns undefined when rootPar is missing", () => {
			expect(
				service.parseNativeAnimations({
					"p:sld": { "p:timing": { "p:tnLst": {} } },
				}),
			).toBeUndefined();
		});

		it("returns undefined when timing tree yields no animations", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
						},
					},
				},
			});
			expect(service.parseNativeAnimations(slideXml)).toBeUndefined();
		});

		it("parses a single entrance animation", () => {
			const slideXml = buildSimpleEntranceSlide("shape1");
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].targetId).toBe("shape1");
			expect(result![0].presetClass).toBe("entr");
			expect(result![0].presetId).toBe(10);
			expect(result![0].durationMs).toBe(500);
		});

		it("extracts trigger from nodeType 'afterPrevious'", () => {
			const slideXml = buildSimpleEntranceSlide("shape1", {
				nodeType: "afterPrevious",
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe("afterPrevious");
		});

		it("extracts trigger from nodeType 'withEffect'", () => {
			const slideXml = buildSimpleEntranceSlide("shape1", {
				nodeType: "withEffect",
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe("withPrevious");
		});

		it("extracts trigger from nodeType 'clickEffect' as onClick", () => {
			const slideXml = buildSimpleEntranceSlide("shape1", {
				nodeType: "clickEffect",
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe("onClick");
		});

		it("extracts trigger from nodeType 'afterPrev'", () => {
			const slideXml = buildSimpleEntranceSlide("shape1", {
				nodeType: "afterPrev",
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe("afterPrevious");
		});

		it("extracts trigger from nodeType 'mouseOver' as onHover", () => {
			const slideXml = buildSimpleEntranceSlide("shape1", {
				nodeType: "mouseOver",
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe("onHover");
		});

		it("extracts duration and delay", () => {
			const slideXml = buildSimpleEntranceSlide("shape1", {
				duration: 1500,
				delay: 300,
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].durationMs).toBe(1500);
			expect(result![0].delayMs).toBe(300);
		});

		it("validates preset class against known values", () => {
			// Use an invalid presetClass to make sure it's filtered
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "invalidClass",
										"@_dur": "500",
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "shape1",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].presetClass).toBeUndefined();
		});

		it("detects afterDelay trigger from stCondLst with positive delay", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"@_delay": "2000",
										"p:stCondLst": {
											"p:cond": {
												"@_delay": "2000",
											},
										},
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "shape1",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].trigger).toBe("afterDelay");
			expect(result![0].triggerDelayMs).toBe(2000);
		});

		it("parses multiple animations from nested p:par containers", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": [
									{
										"p:cTn": {
											"@_id": "2",
											"@_presetID": "10",
											"@_presetClass": "entr",
											"@_dur": "500",
											"@_nodeType": "clickEffect",
											"p:childTnLst": {
												"p:animEffect": {
													"p:cBhvr": {
														"p:tgtEl": {
															"p:spTgt": {
																"@_spid": "shape1",
															},
														},
													},
												},
											},
										},
									},
									{
										"p:cTn": {
											"@_id": "3",
											"@_presetID": "1",
											"@_presetClass": "exit",
											"@_dur": "250",
											"@_nodeType": "afterPrevious",
											"p:childTnLst": {
												"p:animEffect": {
													"p:cBhvr": {
														"p:tgtEl": {
															"p:spTgt": {
																"@_spid": "shape2",
															},
														},
													},
												},
											},
										},
									},
								],
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(2);
			expect(result![0].targetId).toBe("shape1");
			expect(result![0].presetClass).toBe("entr");
			expect(result![1].targetId).toBe("shape2");
			expect(result![1].presetClass).toBe("exit");
			expect(result![1].trigger).toBe("afterPrevious");
		});

		it("extracts motion path from p:animMotion in child nodes", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "0",
										"@_presetClass": "path",
										"@_dur": "2000",
										"p:childTnLst": {
											"p:animMotion": {
												"@_path": "M 0 0 L 1 1",
												"@_origin": "layout",
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "shapeMotion",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result).toHaveLength(1);
			expect(result![0].targetId).toBe("shapeMotion");
			expect(result![0].motionPath).toBe("M 0 0 L 1 1");
			expect(result![0].motionOrigin).toBe("layout");
		});

		it("extracts rotation from p:animRot in child nodes", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "8",
										"@_presetClass": "emph",
										"@_dur": "1000",
										"p:childTnLst": {
											"p:animRot": {
												"@_by": "21600000",
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "spinShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].rotationBy).toBe(360);
		});

		it("extracts scale from p:animScale in child nodes", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "6",
										"@_presetClass": "emph",
										"@_dur": "1000",
										"p:childTnLst": {
											"p:animScale": {
												"p:by": {
													"@_x": "150000",
													"@_y": "200000",
												},
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "scaleShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].scaleByX).toBe(1.5);
			expect(result![0].scaleByY).toBe(2.0);
		});

		it("extracts sound reference from p:stSnd", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:stSnd": {
											"p:snd": {
												"@_r:embed": "rId5",
											},
										},
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "sndShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].soundRId).toBe("rId5");
		});

		it("extracts repeat info from cTn attributes", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"@_repeatCount": "3000",
										"@_autoRev": "1",
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "repeatShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].repeatCount).toBe(3);
			expect(result![0].autoReverse).toBe(true);
		});

		it("applies build list to matching animations", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "textShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				"p:bldLst": {
					"p:bldP": {
						"@_spid": "textShape",
						"@_build": "p",
						"@_grpId": "0",
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].buildType).toBe("byParagraph");
			expect(result![0].groupId).toBe("0");
		});

		it("applies OLE chart build info to matching animations", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "chartShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				"p:bldLst": {
					"p:bldOleChart": {
						"@_spid": "chartShape",
						"@_grpId": "5",
						"@_bld": "series",
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].groupId).toBe("5");
		});

		it("preserves rawEndCondLst from the timing node", () => {
			const endCondLst = {
				"p:cond": { "@_evt": "onClick", "@_delay": "0" },
			};
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:endCondLst": endCondLst,
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "shape1",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].rawEndCondLst).toBeDefined();
			expect(
				(result![0].rawEndCondLst!["p:cond"] as XmlObject)["@_evt"],
			).toBe("onClick");
		});

		it("marks animations inside exclusive containers", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:excl": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "exclShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].exclusive).toBe(true);
		});

		it("extracts text target from p:animEffect with p:txEl", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "txtShape",
															"p:txEl": {
																"p:pRg": {
																	"@_st": "0",
																	"@_end": "3",
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].textTarget).toBeDefined();
			expect(result![0].textTarget!.type).toBe("pRg");
			expect(result![0].textTarget!.start).toBe(0);
			expect(result![0].textTarget!.end).toBe(3);
		});

		it("extracts color animation from p:animClr", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "2",
										"@_presetClass": "emph",
										"@_dur": "1000",
										"p:childTnLst": {
											// p:set provides the target ID for extractAnimationTargetId
											"p:set": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "clrShape",
														},
													},
												},
											},
											"p:animClr": {
												"@_clrSpc": "hsl",
												"@_dir": "cw",
												"p:from": {
													"a:srgbClr": { "@_val": "FF0000" },
												},
												"p:to": {
													"a:srgbClr": { "@_val": "0000FF" },
												},
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "clrShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].colorAnimation).toBeDefined();
			expect(result![0].colorAnimation!.colorSpace).toBe("hsl");
			expect(result![0].colorAnimation!.direction).toBe("cw");
			expect(result![0].colorAnimation!.fromColor).toBe("#FF0000");
			expect(result![0].colorAnimation!.toColor).toBe("#0000FF");
		});

		it("extracts command from p:cmd in child timing list", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "1",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:childTnLst": {
											// p:set provides the target ID for extractAnimationTargetId
											"p:set": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "cmdShape",
														},
													},
												},
											},
											"p:cmd": {
												"@_type": "call",
												"@_cmd": "playFrom(0)",
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "cmdShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].commandType).toBe("call");
			expect(result![0].commandString).toBe("playFrom(0)");
		});

		it("extracts iterate from p:iterate in cTn", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:par": {
									"p:cTn": {
										"@_id": "2",
										"@_presetID": "10",
										"@_presetClass": "entr",
										"@_dur": "500",
										"p:iterate": {
											"@_type": "lt",
											"@_backwards": "1",
											"p:tmPct": { "@_val": "10000" },
										},
										"p:childTnLst": {
											"p:animEffect": {
												"p:cBhvr": {
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "iterShape",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result![0].iterate).toBeDefined();
			expect(result![0].iterate!.type).toBe("lt");
			expect(result![0].iterate!.backwards).toBe(true);
			expect(result![0].iterate!.tmPct).toBe(10000);
		});
	});

	// -----------------------------------------------------------------------
	// Interactive sequences
	// -----------------------------------------------------------------------
	describe("interactive sequences", () => {
		it("parses interactive sequences with onShapeClick trigger", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_restart": "never",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:seq": [
									{
										"p:cTn": {
											"@_id": "2",
											"@_dur": "indefinite",
											"@_nodeType": "mainSeq",
											"p:childTnLst": {
												"p:par": {
													"p:cTn": {
														"@_id": "3",
														"@_presetID": "10",
														"@_presetClass": "entr",
														"@_dur": "500",
														"p:childTnLst": {
															"p:animEffect": {
																"p:cBhvr": {
																	"p:tgtEl": {
																		"p:spTgt": {
																			"@_spid":
																				"mainShape",
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
									{
										"p:cTn": {
											"@_id": "10",
											"@_dur": "indefinite",
											"@_nodeType": "interactiveSeq",
											"p:stCondLst": {
												"p:cond": {
													"@_evt": "onClick",
													"@_delay": "0",
													"p:tgtEl": {
														"p:spTgt": {
															"@_spid": "triggerButton",
														},
													},
												},
											},
											"p:childTnLst": {
												"p:par": {
													"p:cTn": {
														"@_id": "11",
														"@_presetID": "1",
														"@_presetClass": "entr",
														"@_dur": "250",
														"p:childTnLst": {
															"p:set": {
																"p:cBhvr": {
																	"p:tgtEl": {
																		"p:spTgt": {
																			"@_spid":
																				"hiddenShape",
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								],
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			expect(result!.length).toBeGreaterThanOrEqual(2);

			// Find the interactive animation
			const interactiveAnim = result!.find(
				(a) => a.trigger === "onShapeClick",
			);
			expect(interactiveAnim).toBeDefined();
			expect(interactiveAnim!.triggerShapeId).toBe("triggerButton");
			expect(interactiveAnim!.targetId).toBe("hiddenShape");
		});

		it("skips mainSeq sequences in interactive parsing", () => {
			const slideXml = buildSlideXmlWithTiming({
				"p:tnLst": {
					"p:par": {
						"p:cTn": {
							"@_id": "1",
							"@_dur": "indefinite",
							"@_nodeType": "tmRoot",
							"p:childTnLst": {
								"p:seq": {
									"p:cTn": {
										"@_id": "2",
										"@_dur": "indefinite",
										"@_nodeType": "mainSeq",
										"p:childTnLst": {
											"p:par": {
												"p:cTn": {
													"@_id": "3",
													"@_presetID": "10",
													"@_presetClass": "entr",
													"@_dur": "500",
													"p:childTnLst": {
														"p:animEffect": {
															"p:cBhvr": {
																"p:tgtEl": {
																	"p:spTgt": {
																		"@_spid": "shape1",
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});
			const result = service.parseNativeAnimations(slideXml);
			expect(result).toBeDefined();
			// All animations should be from main sequence, none onShapeClick
			for (const anim of result!) {
				expect(anim.trigger).not.toBe("onShapeClick");
			}
		});
	});

	// -----------------------------------------------------------------------
	// Error handling
	// -----------------------------------------------------------------------
	describe("error handling", () => {
		it("returns undefined and does not throw on malformed XML", () => {
			// Circular reference would cause issues in real parsing but the
			// service should catch exceptions
			const slideXml: XmlObject = {
				"p:sld": {
					"p:timing": {
						"p:tnLst": {
							"p:par": null as unknown as XmlObject,
						},
					},
				},
			};
			expect(service.parseNativeAnimations(slideXml)).toBeUndefined();
		});
	});
});
