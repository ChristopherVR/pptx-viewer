---
title: Einschränkungen
description: Was die Core-Engine und die Viewer-Bindings nicht unterstützen - vor der Einführung der Bibliothek lesen.
---

# Einschränkungen

::: warning Vor der Einführung lesen
`pptx-viewer` deckt einen großen Teil der OpenXML-Spezifikation ab, manches wird aber angenähert, ist schreibgeschützt oder durch die Browser-Plattform begrenzt. Diese Seite dokumentiert bekannte Einschränkungen; sie ist keine erschöpfende Kompatibilitätsgarantie für jede Office-Funktion oder jede Erweiterung von Drittanbietern. Prüfen Sie `data.warnings` nach dem Laden einer Präsentation und lesen Sie [OpenXML-Konformität](/architecture/openxml-conformance) für das formale Abdeckungsmanifest.
:::

## Core-Engine (`pptx-viewer-core`)

| Funktion        | Status                                         | Hinweise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.ppt`-Export   | Teilweise                                      | Freihandeingaben, SmartArt, Diagramme und 3D-Modelle öffnen sich in PowerPoint jetzt wieder als bearbeitbare Objekte, über ein eingebettetes OOXML-Round-Trip-Paket (verifiziert durch erneutes Öffnen in PowerPoint per COM); nur PowerPoint 97-2003 selbst sieht die Ersatzdarstellung. Weiterhin verlustbehaftet: Bilder außer PNG/JPEG werden zu einem Platzhalter, die eigenen Master-Textformat-Überschreibungen einer Präsentation werden nicht geschrieben, Video und Audio außer WAV werden zu einem Bild herabgestuft, und der Import verschlüsselter `.ppt`-Dateien unterstützt nur RC4 CryptoAPI. Siehe [OpenXML-Konformität](/architecture/openxml-conformance#ppt-export-ceiling).             |
| SmartArt-Layout | Angenähert ohne zwischengespeicherte Zeichnung | Präsentationen, die ohne die zwischengespeicherte `dsp:drawing` gespeichert wurden, werden von einer DiagramML-Engine pro Datenpunkt (143 Layouts) oder vom älteren Familien-Interpreter angeordnet. Von 229 per COM erstellten Galerie-Fixtures erzeugen 228 dieselbe Formenmenge wie PowerPoint, 143 treffen dessen Geometrie auf 1 % genau (181 auf 5 %) und 129 jede Schriftgröße. Name and Title Organization Chart, die beschrifteten und Tabellen-Hierarchien, horizontale Organigramme mit Assistenten und drei Layouts (Arrow Ribbon, Balance, Varying Width List) bleiben ungenau. Siehe [OpenXML-Konformität](/architecture/openxml-conformance#smartart-layout-ground-truth) für die Messbelege. |

### Animationen erstellen

Ein im Animationsbereich erstellter Effekt wird in den bestehenden `p:timing`-Baum der Folie eingearbeitet; die vorhandenen Effekte der Präsentation bleiben byte-identisch. Bekannte Lücken:

- **Einige gespeicherte Effekte fallen in PowerPoint noch auf eine Überblendung zurück.** Eingangs-, Ausgangs- und Hervorhebungseffekte werden mit PowerPoints eigenem Verhaltensbaum geschrieben (Einfliegen, Schweben, Springen, Vergrößern und Drehen, die Filter-Einblendungen, Pulsieren, Wippen, Welle und andere, verifiziert durch erneutes Öffnen in PowerPoint); Kriechen und Spirale werden weiterhin als Überblendung gespeichert, und Blinken ist eine Annäherung.
- **Einige Voreinstellungen werden bei der Wiedergabe angenähert:** `strips`, `wedge`, der Kreis-Ausgang und der `slide`-Filter spielen so ab wie PowerPoint (an dessen eigene aufgezeichnete Frames angepasst), und `cover`/`uncover`/`push`/`pull` schneiden so wie PowerPoint; etwa 40 PowerPoint-Voreinstellungs-IDs spielen weiterhin einen Ersatzeffekt ab (zum Beispiel werden Einfaches Drehen und Hinausschweben als Überblendung abgespielt), und die Bezeichnungen des Voreinstellungskatalogs für IDs ab 27 stimmen noch nicht alle mit PowerPoints Namen überein.
- **Teilweise unterstützt:** buchstabenweises Kräuseln innerhalb eines absatzweisen Aufbaus wird nicht abgespielt; ein `p14:bounceEnd` von 100 % (kein Weg mehr übrig, was PowerPoint selbst unstet darstellt) wird auf 95 % begrenzt. Auslöser auf Medien-Textmarken ("Bei Textmarke"), die p15-Übergänge mit ihren Richtungsoptionen und die Richtung Ein/Aus des Zoom-Übergangs lassen sich in allen fünf Bindings erstellen, und die Ausschwingkurve von "Abprallen am Ende" ist an PowerPoints eigene Frames angepasst.

### Lücken zur Laufzeit erkennen

Sie müssen nicht raten, ob eine Datei an eine Einschränkung stößt. Die Ladepipeline meldet viele nicht unterstützte oder angenäherte Konstrukte (nicht alle: Animations-Ersatzeffekte etwa lösen keine Warnung aus) in `data.warnings`, typisiert als `PptxCompatibilityWarning`:

```ts
interface PptxCompatibilityWarning {
	code: string; // stable machine-readable code
	message: string;
	severity: 'info' | 'warning';
	scope: 'presentation' | 'slide' | 'element' | 'save';
	slideId?: string; // present for slide/element-scoped warnings
	elementId?: string;
	xmlPath?: string; // where in the package the construct lives
}
```

Prüfen Sie `data.warnings` nach `load()` (und nach `save()`), wenn Ihre Anwendung Nutzern Hinweise zur Wiedergabetreue anzeigen oder Funktionen pro Datei freischalten oder sperren soll.

Unter [Laufzeitumgebungen](/guide/runtime-environments) steht, wo welcher Teil von `pptx-viewer` läuft (Browser / Node.js / Web Worker), und welches plattformspezifische Verhalten aus der Browser-Sandbox folgt statt aus einer fehlenden Funktion.

## Framework-Viewer (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning CSS-basiertes Rendering tauscht einige visuelle Effekte gegen Genauigkeit an anderer Stelle
Folien werden als HTML/CSS statt als Canvas gerendert. Das ergibt scharfen Text bei jeder Zoomstufe, native Barrierefreiheit und DOM-Interaktivität. Der Preis dafür: Einige PowerPoint-Effekte haben kein exaktes CSS-Gegenstück und werden angenähert.
:::

### Angenäherte visuelle Effekte

| Effekt                                                                                          | Status                                          | Hinweise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3D-Formen und -Szenen (`a:sp3d` / `a:scene3d`)                                                  | Metall-Restfehler                               | Metallmaterialien wirkten unter Lichtaufbauten mit hoher Elevation früher ausgewaschen; das Glanzlicht hat jetzt eine eigene, begrenzte Elevation, neu angepasst an 134 PowerPoint-Renderings (mittlerer absoluter Fehler 75,0 auf 36,4 auf einer 0-255-Skala), sodass ein kleinerer Restfehler bleibt. Die Abschrägungskorrektur für relaxedInset/slope/hardEdge vom 16.09.2026 wurde noch nicht erneut gegen ein frisches PowerPoint-Rendering verifiziert. Siehe [Visuelle Effekttreue](/guide/visual-effects) für die Herkunft.                                                                                                                                                                                                                                                                                                                                                  |
| WordArt-Hüllenverformungen (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Can-Voreinstellungen bei manchen Tiefen ungenau | Glyphen werden nach Bogenlänge entlang der oberen und unteren Kurve platziert. Neu gemessen gegen PowerPoints `Slide.Export` (1920 px breit, Noto Sans, Verdana und Arial, 2026-09-25): Die Can-Voreinstellungen erreichen bei den meisten Tiefen eine Tinten-IoU von 0,94-0,97 mit einem mittleren Konturfehler von 0,8-1,7 px (95. Perzentil 1,5-6 px), `inflate` / `deflate` 0,96-0,97. Bei 9 von 20 gemessenen `adj`-Werten (`textCanUp` 80000-93333, `textCanDown` 3333-23333) beendet PowerPoint eine oder beide Textzeilen etwa 1,2 % der Feldbreite zu früh und neigt die Glyphen; das ist nicht nachgebildet (IoU dort 0,73-0,86). Schriften, deren Datei nicht erhältlich ist, verwenden einen aus der Browserdarstellung nachgezeichneten Umriss, der auf 0,002 IoU genau mit der echten Schriftdatei übereinstimmt. Siehe [Visuelle Effekttreue](/guide/visual-effects). |

Spiegelungen, weiche Kanten und Pfadverläufe sind ebenfalls Annäherungen, halten dem Vergleich mit echtem PowerPoint aber gut stand; siehe [Visuelle Effekttreue](/guide/visual-effects) für die Technik und die per COM gemessenen Belege zu jedem einzelnen Effekt.

### Bekannte Render- und Bearbeitungslücken (Audit 09/2026)

Ein Audit vom September 2026 gegen echtes PowerPoint fand diese noch offenen Lücken:

- **Das Speichern einer bearbeiteten Folie kann noch kleinere Markup-Details verändern.** Formeln, Zeilenumbrüche, geerbte Formatierung, Master-Textformate, Design-Hintergründe, Kommentar-Zeitstempel, Bildfüllungen, Medien-Klickaktionen, Run-Sprachen und -Eigenschaften, Ruby-Runs, Umrissbreiten, Innenschattenfarben, Verlaufseinzüge, Aufzählungszeichenfarben bei einem geerbten Aufzählungszeichen, Tabulatorausrichtung sowie Metadaten von Animationen und Audio und unveränderte Diagramme überstehen den Round-Trip, und `docProps` wird beim Speichern aktualisiert wie bei PowerPoint. Auf einer neu geschriebenen Folie bleibt ein kleiner Rest: Ein leeres `<a:pPr/>` wird entfernt, ein bloßes `<a:p/>` erhält einen leeren Run, das `endParaRPr` der Notizen und `prstTxWarp/avLst` können entfallen, und die Wörter- und Absatzzahlen in `docProps/app.xml` werden nicht neu berechnet. Unbearbeitete Folien überstehen den Round-Trip unverändert.
- **Text:** Der ostasiatische Zeilenumbruch folgt innerhalb eines Laufs den hängenden Satzzeichen (`hangingPunct`) und Kinsoku-Regeln (`eaLnBrk`) von PowerPoint, ein Umbruch zwischen zwei unterschiedlich formatierten Läufen ostasiatischen Texts folgt jedoch weiterhin den Regeln des Browsers, und ein hängendes `、` oder `。`, dem direkt eine schließende Klammer folgt, wird mit ihr umbrochen, statt zu hängen (noch nicht mit PowerPoint verglichen).
- **Diagramme:** Felder und Legenden von Datenbeschriftungen werden nach einer Schätzung der Textbreite bemessen statt gemessen, und Kreisdiagrammbeschriftungen an der Position `bestFit` liegen näher an der Mitte, als PowerPoint sie platziert.
- **3D-Modelle** ignorieren die in PowerPoint festgelegte Kamera, Transformation und Beleuchtung.
- **Die Editor-Abdeckung** ist eine Teilmenge von PowerPoint: Mehrere Menüband-Galerien sind noch nicht verfügbar. Punkte bearbeiten (mit den Zeichenwerkzeugen Freihandform: Form und Kurve), Formen zusammenführen, das Zuschneiden von Bildern auf der Zeichenfläche (Zuschneidegriffe, Auf Seitenverhältnis zuschneiden, Ausfüllen, Einpassen), Inhalte einfügen, die Kontextmenüs für leere Zeichenfläche und Elemente, die Mehrfachauswahl im Folienbereich, eine echte Animationsvorschau an Ort und Stelle und die üblichen Bearbeitungs-Tastenkürzel sind in allen fünf Bindings verfügbar.

## EMF/WMF-Metadateien (Abhängigkeit `emf-converter`)

::: info Nicht der Code dieses Repositorys
`emf-converter` ist ein eigenständiges npm-Paket mit eigenem Repository; `pptx-viewer-core` nutzt es nur. Die folgende Tabelle beschreibt, was dieses Paket heute leistet; falls beide einmal voneinander abweichen, sind seine eigenen Release-Notes maßgeblich.
:::

::: warning Canvas-API erforderlich
Die Konvertierung von Metadateien benötigt `OffscreenCanvas` oder `HTMLCanvasElement`. Reines Node.js ohne Canvas-Polyfill wird für EMF/WMF-Bilder nicht unterstützt (der Rest der Core-Engine läuft in Node problemlos).
:::

| Funktion                   | Status                      | Hinweise                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verlaufs- und Texturpinsel | Resampling-Restfehler       | Verläufe, Musterpinsel und EMF+-Texturpinsel (seit 3.3.0 auch mit komprimierten Bitmaps) werden mit exakten Farbstopps und exakter Kachelung gerendert; die Musterfilterung des Browsers hinterlässt einen kleinen Unterschied bei der Kantenglättung gegenüber Windows GDI+ (gemessen in der README des Pakets).                                                                                |
| Rasteroperationen          | Exakt                       | Alle 256 ROP3-Codes und alle bitweisen ROP2-Stiftmodi werden exakt ausgewertet, auch innerhalb von `BeginPath`/`EndPath`-Pfaden (seit 3.3.0).                                                                                                                                                                                                                                                    |
| Text und Transformationen  | Schrift-Engine des Browsers | Glyphenmetriken können von Windows GDI abweichen: `ExtTextOut`-`dx`-Arrays, das Vorzeichen der `LOGFONT`-Höhe und der Escapement-Wert werden berücksichtigt, ohne `dx`-Array hängt der Abstand aber von der Schriftersetzung des Browsers ab. Gedrehte und gescherte Weltmatrizen wirken auf Formen, Blits und Text (seit 3.3.0); Text unter einer Scherung verwendet einen einzigen Drehwinkel. |

## Weiterführende Seiten

- [Einführung](/de/guide/introduction) - was das Projekt insgesamt unterstützt.
- [Architektur](/de/guide/architecture) - warum es diese Kompromisse gibt.
- [OpenXML-Konformität](/architecture/openxml-conformance) - die formale Definition von "unterstützt", die das Abdeckungsmanifest verwendet.
- [Visuelle Effekttreue](/guide/visual-effects) - CSS/SVG-Effektannäherungen, bestätigt gegen echtes PowerPoint.
- [Laufzeitumgebungen](/guide/runtime-environments) - wo welcher Teil von `pptx-viewer` läuft, und Plattformhinweise zur Browser-Sandbox.
