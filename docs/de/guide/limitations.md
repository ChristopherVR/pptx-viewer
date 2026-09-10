---
title: Einschrankungen
description: Was im Core-Engine und den Viewer-Bindungen nicht unterstuzt wird - vor der Einfuhrung lesen.
---

# Einschrankungen

::: warning Vor der Einfuhrung lesen
`pptx-viewer` deckt einen grossen Teil der OpenXML-Spezifikation ab, aber einiges ist approximiert, schreibgeschutzt oder durch die Browser-Plattform begrenzt. Diese Seite listet nur auf, was Sie **nicht** oder nur teilweise tun konnen. Alles andere ladt, bearbeitet, rendert und speichert einwandfrei; siehe [OpenXML-Konformitat](/architecture/openxml-conformance) fur das formale Abdeckungsmanifest.
:::

## Core-Engine (`pptx-viewer-core`)

- **`.ppt`-Hyperlinks, OLE-Einbettungen und nicht unterstuetzte Elemente** - Tinte, SmartArt, Diagramme und 3D-Modelle werden aus `.ppt` alle als gerastertes Bild statt als bearbeitbares Objekt exportiert, weil PowerPoints eigener Bearbeitungspfad fuer Tinte und SmartArt auf einer undokumentierten Formeigenschaft beruht und der Diagramm- und 3D-Fallback einem alten Format ohne oeffentliche Spezifikation entspricht. Siehe [OpenXML-Konformitaet](/architecture/openxml-conformance#ppt-export-ceiling) fuer die Messbelege.
- **SmartArt-Layout** - Praesentationen, die ohne die zwischengespeicherte `dsp:drawing` gespeichert wurden, werden vom Interpreter angeordnet, der 226 der 227 per COM erstellten Galerie-Fixtures auf 1 % genau nachbildet; siehe [OpenXML-Konformitaet](/architecture/openxml-conformance#smartart-layout-ground-truth) fuer die Messbelege.

### Animationserstellung

Ein im Animationsbereich erstellter Effekt wird in den bestehenden `p:timing`-Baum der Folie eingefugt; die vorhandenen Effekte bleiben byte-identisch. Alle 27 SMIL-Filterfamilien (`p:animEffect/@filter`) rendern einen echten Effekt, der PowerPoints eigener Wiedergabe entspricht, einschliesslich `pixelate`, das standardmassig genau das Verhalten zeigt, das PowerPoint selbst zeigt (sofortiger Sprung zum Endzustand); siehe [Visuelle Effekttreue](/guide/visual-effects) fur die Belege. `image`, die 27. Familie, ist ebenfalls keine Lucke: siehe [OpenXML-Konformitat](/architecture/openxml-conformance).

### Lucken zur Laufzeit erkennen

Die Ladepipeline meldet jede nicht unterstutzte oder approximierte Konstruktion in `data.warnings`, typisiert als `PptxCompatibilityWarning` (mit `code`, `severity`, `scope`, optional `slideId`/`elementId`/`xmlPath`). Prufen Sie `data.warnings` nach `load()` (und nach `save()`), wenn Ihre Anwendung Nutzern Genauigkeitshinweise anzeigen oder Funktionen pro Datei sperren soll.

## Laufzeitumgebungen

- **Browser** - Voller Funktionsumfang: Parsen, Rendern, Bearbeiten, Export, Zusammenarbeit.
- **Node.js (und Serverless)** - Nur Core: `pptx-viewer-core` ist DOM-frei (Laden, Bearbeiten, Speichern, Markdown/SVG-Konvertierung, Verschlusselung). Die UI-Bindungen, der Raster-Export (`html2canvas`) und die EMF/WMF-Konvertierung sind Browser-Funktionen.
- **Web Worker** - Gleicher Umfang wie Node.js: die Engine hat keine DOM-Abhangigkeit.

## Framework-Viewer (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning CSS-basiertes Rendering tauscht einige visuelle Effekte gegen Fidelitat an anderer Stelle
Folien werden als HTML/CSS statt als Canvas gerendert, was scharfen Text bei jedem Zoom, native Barrierefreiheit und DOM-Interaktivitat ergibt. Der Kompromiss: einige PowerPoint-Effekte haben kein exaktes CSS-Aquivalent und werden approximiert.
:::

### Visuelle Effekt-Annaherungen

- **3D-Formen und -Szenen (`a:sp3d`/`a:scene3d`)** - Die Abschraegungen relaxedInset, slope und hardEdge zeigen einen Hell-dann-Dunkel-Querschnitt, den das einzelne Hoehenmodell nicht nachbilden kann, und `metal`-Materialien uebersaettigen bei Beleuchtungs-Rigs mit hoher Elevation, weil der Specular-Term an die Diffus-Elevation gekoppelt ist. Alles andere im 3D-Modell ist per COM gemessen; siehe [Visuelle Effekttreue](/guide/visual-effects) fuer die Belege.
- **WordArt-Textverformungen** - Die `can`-Presets behalten einen horizontalen Restfehler von 5-18 %, weil PowerPoints Buchstabenabstand entlang des Zylinders noch nicht hergeleitet ist, und Schriften ohne verfuegbare Datei nutzen statt der exakten Umriss-Verformung eine affine Anpassung pro Buchstabe (etwa 1-2 % Abweichung); ein sehr kurzer, stark gedehnter Absatz kann noch leicht in die Nachbarzeile hineinragen. Siehe [Visuelle Effekttreue](/guide/visual-effects) fuer die Belege.

## EMF/WMF-Metadateien (`emf-converter`-Abhaengigkeit)

::: info Nicht der Code dieses Repositories
`emf-converter` ist ein eigenstandiges npm-Paket mit eigenem Repository; `pptx-viewer-core` konsumiert es nur. Die Tabelle unten beschreibt den heutigen Stand dieses Pakets; bei Abweichungen sind dessen eigene Release-Notes massgeblich.
:::

::: warning Canvas-API erforderlich
Die Metadatei-Konvertierung benotigt `OffscreenCanvas` oder `HTMLCanvasElement`. Reines Node.js ohne Canvas-Polyfill wird fur EMF/WMF-Bilder nicht unterstutzt (der Rest der Core-Engine lauft in Node problemlos).
:::

- **Verlaufsfullungen** - GDI+ lineare und radiale Verlaufe werden bereits exakt gerendert, einschliesslich Farbstopps, Voreinstellungen, Mischfaktoren und Transformationen. Die anstehende Version erganzt WrapMode-Kachelung fur achsparallele lineare Verlaufe; gewinkelte gekachelte Verlaufe und gekachelte Pfadverlaufe werden weiterhin geklemmt statt gekachelt.
- **Rasteroperationen** - GDI-ROP2-Stift- und Pinselmodi werden bereits exakt gerendert. Die anstehende Version erganzt exakte Pixel-fur-Pixel-ROP3-Operationen fur `BitBlt`/`StretchBlt`/`StretchDIBits`: `SRCCOPY`, `SRCPAINT`, `SRCAND`, `SRCINVERT`, `SRCERASE`, `NOTSRCCOPY`, `NOTSRCERASE`, `MERGEPAINT`, `PATCOPY`, `DSTINVERT`, `BLACKNESS`, `WHITENESS`. `MERGECOPY`, `PATPAINT` und `PATINVERT` werden weiterhin auf eine Kopie reduziert.
- **Text** - Nutzt die Schrift-Engine des Browsers; Glyphenmetriken konnen von Windows GDI abweichen. Die anstehende Version beachtet `ExtTextOut`-`dx`-Arrays exakt, erhalt das Vorzeichen der `LOGFONT`-Hohe, rotiert Text nach Escapement/Orientation und behebt einen Versatzfehler im Schriftnamen; ohne `dx`-Array hangt der Glyphenabstand weiterhin von der Schriftersetzung des Browsers ab.

## Weiterfuhrende Links

- [Einfuhrung](/de/guide/introduction) - was das Projekt insgesamt unterstuzt.
- [Architektur](/de/guide/architecture) - warum diese Kompromisse existieren.
- [OpenXML-Konformitat](/architecture/openxml-conformance) - die formale Definition von "unterstutzt", die das Abdeckungsmanifest verwendet.
