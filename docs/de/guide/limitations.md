---
title: Einschrankungen
description: Was im Core-Engine und den Viewer-Bindungen nicht unterstuzt wird - vor der Einfuhrung lesen.
---

# Einschrankungen

::: warning Vor der Einfuhrung lesen
`pptx-viewer` deckt einen grossen Teil der OpenXML-Spezifikation ab, aber einiges ist approximiert, schreibgeschutzt oder durch die Browser-Plattform begrenzt. Diese Seite listet nur auf, was Sie **nicht** oder nur teilweise tun konnen. Alles andere ladt, bearbeitet, rendert und speichert einwandfrei; siehe [OpenXML-Konformitat](/architecture/openxml-conformance) fur das formale Abdeckungsmanifest.
:::

## Core-Engine (`pptx-viewer-core`)

- **Binares Alt-Format `.ppt`** - Import funktioniert (auch mit RC4-CryptoAPI-Passwortschutz uber `load(buffer, { password })`), aber gespeichert wird immer als `.pptx`, genau wie PowerPoint selbst es tut. Die altere Office-95-RC4/XOR-Verschleierung wird nicht unterstutzt. Da das Format vor DrawingML liegt, gibt es kein Theme-Font-Schema (der Konverter erzeugt eines aus der ersten gefundenen Schriftart) und Effekte ohne binares Aquivalent werden vereinfacht.
- **OLE-Objekte** - Inhalt ist schreibgeschutzt (Vorschaubild, Download oder Offnen in neuem Tab), da der Browser die native Anwendung nicht ausfuhren kann. Der Objektname (`p:oleObj/@name`) ist editierbar, aber nur Metadaten: PowerPoint backt die sichtbare Icon-Beschriftung in das Icon-Bild selbst ein, und das wird hier nicht neu erzeugt.
- **SmartArt-Layout** - Ist die vorberechnete Zeichnung von PowerPoint in der Datei vorhanden, wird sie exakt verwendet; andernfalls approximiert ein DiagramML-Interpreter (alle zehn `dgm:alg`-Typen, Constraints, Regeln) das Layout. Organigramme sind gegen echte COM-Fixtures verifiziert (Topologie, Einrucktiefe, Fan-Verhalten, Zeilen-vs-Spalten-Wahl); tiefere `chMax`-Gruppierung kommt in echten PowerPoint-Dateien ohnehin nicht vor.
- **Element-Koordinaten** - Position/Groesse werden intern als exakte EMU-Werte gefuhrt und beim Speichern byte-genau reproduziert, auch fur verschachtelte Gruppen und nach Verschieben/Skalieren (COM-verifiziert fur zahlreiche Rotations- und Gruppenfaelle). Zwei kombinierte Bearbeitungsfaelle bei nicht-rechten Winkeln landen nur innerhalb von 1 EMU (1/914400 Zoll) des COM-Referenzwerts, weil PowerPoints eigene trigonometrische Rundung bei irrationalen Winkeln davon abweicht, nicht wegen eines Formelfehlers.
- **Archivgroesse** - Ein Zip-Bomb-Schutz begrenzt standardmassig 500 MiB unkomprimiert (uber `maxUncompressedBytes` anpassbar) und 65.536 Archiveintraege; beides wird mit `ZipBombError` durchgesetzt.
- **Ubergangsdauer** - `p14:dur` wird im Office-2010-Namensraum mit `mc:Ignorable` geschrieben, da `CT_SlideTransition` kein natives `dur`-Attribut kennt; altere Reader als PowerPoint 2010 fallen auf die `spd`-Geschwindigkeit zuruck.

### Animationserstellung

Ein im Animationsbereich erstellter Effekt wird in den bestehenden `p:timing`-Baum der Folie eingefugt; die vorhandenen Effekte bleiben byte-identisch. Innerhalb dessen:

- **Effektton (`p:stSnd`)** - Nur eine eigene Audiodatei oder "Kein Ton" ist wahlbar; PowerPoints eigene Systemtone (Applaus, Kamera, Chime, ...) sind Microsoft-Assets und liegen diesem Repository nicht bei.
- **`p:bldP/p:tmplLst`/`p:tmpl`** - Wird typisiert geparst und rundtrip-fest gespeichert, aber bei der Wiedergabe nicht berucksichtigt: PowerPoint nutzt diese Vorlagen nur, um eine Gliederungsebene ohne eigenen Effekt zu initialisieren, und die sichtbare Ebene hat bereits einen eigenen Knoten in `p:timing/p:tnLst`.
- **`p:animEffect/@filter` `image`** - 26 der 27 SMIL-Filterfamilien rendern einen echten Effekt. `pixelate` ist ein eigens gebautes Mosaik aus SVG-Filtern (COM-Frame-Vergleich zeigt, dass PowerPoint 2016 dafur selbst keine Animation zeigt, sondern direkt zum Endzustand springt). `image` hatte einen zweiten, separat autorisierten Bild-Layer ersetzen mussen, den die OOXML-Nutzlast nie enthalt, weshalb es hierfur keinen Ersatz gibt.

### Diagrammformatierung und ChartEx

- **`c:pictureOptions` bei 3D-Balken** - Wenn eine nicht adressierte Flache nur eine Bildfullung hat, tastet PowerPoint den Pixel an Position (0,0) des Bildes ab und fullt die Flache mit dieser Farbe (COM-verifiziert); dieser Renderer holt den Pixelwert asynchron nach und faerbt den Chart nach, sobald er vorliegt. Die optionale three.js-3D-Szene rendert echte Bildtexturen pro Flache auch auf Zylinder-, Kegel- und Pyramiden-Balken, nicht nur auf quaderformigen.
- **Office-Chart-Erweiterungen (`c15:`/`c16:`/`c16r3:`)** - Ein grosser Teil ist modelliert und rundtrip-fest: Serien-/Punkt-Identitat, Kreisdiagramm-Fuhrungslinien, "#N/A als leer anzeigen", "Werte aus Zellen"-Beschriftungen und gefilterte Serien. Ein reiner Kategoriefilter braucht kein Modell, da PowerPoint ihn als verkurzten Cache jeder verbleibenden Serie schreibt. `c15:filteredCategoryTitle`/`filteredSeriesTitle`, `c15:xForSave` und `c15:datalabelsRange`/`dlblRangeCache` werden nur als roher `extLst`-Passthrough durchgereicht, weil PowerPoint 2016 sie uber COM nicht erzeugen liess und kein Korpus-Beispiel dafur existiert.

### Tabellen, Geometrie und Medienbearbeitung

- **`onStopAudio` im Headless-Export** - Der Trigger wartet normalerweise auf das `ended`-Ereignis eines echten `<audio>`/`<video>`-Elements. Fehlt ein solches Element (Headless-Export oder nicht gemountetes Medium), greift ein Timer mit geschatzter Dauer, genau wie PowerPoint es selbst fur seine eigene "Nach vorherigem"-Audioverkettung schreibt.

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

- **3D-Formen und -Szenen (`a:sp3d`/`a:scene3d`)** - Die `perspective*`- und `isometric*`-Kamerapresets sind als exakte, COM-gemessene `matrix3d`-Homographie umgesetzt, keine grobe Rotation. `oblique*`/`legacyOblique*`/`legacyPerspective*`/`orthographicFront` lassen die Vorderflache flach (COM-bestatigt; nur die extrudierten Seitenflachen reagieren). Eine explizite `a:camera/a:rot`/`@fov`/`@zoom`-Angabe nutzt weiterhin das altere rotationsbasierte Modell. Die Extrusionstiefe wird als echte `translateZ`-Seitenflache gerendert; welche Seite sichtbar ist, wurde fur die meisten Presets per COM vermessen, einige zeigen wie in PowerPoint selbst gar keine Flache. Abschragung/Material sind CSS-`box-shadow`/`filter`-Schichten statt echter Geometrie/Beleuchtung; die Highlight-Richtung ist fur die meisten Bevel-Profile COM-verifiziert, fur zwei Profile ohne klares Signal ungepruft. Der Bodenebenen-Schatten (`a:backdrop`) wird bewusst nicht mehr synthetisch gerendert, weil eine stark geneigte Ebene einen nicht-konvexen Schatten wirft, den kein CSS `box-shadow` abbilden kann. WordArt/Textfelder unter `a:bodyPr/a:scene3d` nutzen dieselbe Kamerafunktion wie Formen.
- **Reflexionen** - Ein gespiegelter Geschwisterknoten (mit `@sx`/`@sy`/`@kx`/`@ky`/`@rot`/`@fadeDir`/`@algn`), der den vollstandigen gerenderten Inhalt spiegelt: Fullung, Kontur und Text bei Formen/Bildern, rekursiv jedes Kind bei Gruppen. Ein Kind mit eigener Reflexion innerhalb einer gespiegelten Gruppe wird doppelt gespiegelt, genau wie PowerPoint es aus dem bereits gerenderten Gruppeninhalt zusammensetzt.
- **Weiche Kanten (`a:softEdge`)** - SVG-Alpha-Feather-Filter (weicht nur den Rand auf, nicht das gesamte Element).
- **Pfadverlaufe** - Typ `circle`/`shape`: elliptischer Radialverlauf. Typ `rect`: verschachtelte achsenparallele Rechteckbander, um PowerPoints eckiges Verlaufsfeld nachzubilden (kein natives CSS/SVG-Radialverlauf hat eckige Ecken).
- **WordArt-Textverformungen** - Jedes `a:prstTxWarp`-Preset rendert als echter SVG-Text. Bogen/Welle/Kreis/Ring/Knopf/Slant/Fade/Cascade folgen einem gebogenen `textPath`; `inflate`/`deflate`/`can` rendern jeden Buchstaben mit eigener affiner Transformation entlang der Hullkurve, bei kurzen Bildunterschriften in bis zu 24 Teilstucke gesplittet, um die Abweichung zu verringern. Gegen echtes PowerPoint per COM stimmt die Kurvenmathematik auf etwa 0,2% im Mittel; einzelne Buchstaben bleiben bei gewohnlichen Bildunterschriften innerhalb von etwa 1-2%.
- **Filmische 3D-Ubergange** - Werden mit CSS-Keyframes (Perspektive/Rotation/Rollen) auf 2D-Ebenen animiert, kein echtes volumetrisches 3D. Die meisten Presets sind per COM-`CreateVideo`-Framevergleich gegen PowerPoint 2016 verifiziert. `vortex`, `honeycomb`, `glitter`, `shred`, `fracture`, `curtains` und `airplane` zerlegen sich in echtem PowerPoint in viele einzelne Fragmente/Partikel, was eine einzelne CSS-Ebene nicht wortgetreu abbilden kann; sie behalten einen richtungskonsistenten Platzhalter.

### Plattformgebundenes Verhalten

- **Schriften** - Text nutzt im Browser verfugbare Schriften; fehlende Schriften fallen auf Systemstandards zuruck. In der PPTX eingebettete Schriften werden injiziert, wenn vorhanden.
- **Medien-Codecs** - Audio/Video-Wiedergabe hangt vom Browser ab (WMV und altere Codecs spielen moglicherweise nicht); DRM-geschutzte Medien spielen nicht.
- **Morph-Ubergange** - Elemente werden per `!!`-Namensgebung, `a16:creationId`/nativer Shape-ID oder Typ-Nahe zugeordnet. Ein reiner Selection-Pane-Name ohne `!!`-Prafix zahlt nicht (gegen echtes PowerPoint bestatigt). Ein Element ohne Gegenstuck auf der nachsten Folie uberblendet statt zu morphen, genau wie in PowerPoint.
- **Raster-Export** - PNG/JPEG/PDF nutzt `html2canvas`, das `backdrop-filter`, CSS-Custom-Properties oder CSS-3D-Transformationen nicht reproduzieren kann; fur eine vektorbasierte Alternative den SVG-Export nutzen.
- **Export-Auflosung** - Canvas-Exporte sind durch die maximale Canvas-Grosse des Browsers begrenzt (typischerweise 16.384 oder 32.768 Pixel pro Seite).
- **Prasentations-Tastenkurzel** - `F5`/`Shift+F5` werden auf PowerPoints "Von Anfang"/"Ab aktueller Folie" gemappt, sobald der Viewer den Fokus hat und keine Show lauft; damit ladt ein einfaches `F5` die Seite dann nicht mehr neu. `Ctrl+F5` und der Browser-Reload-Button bleiben unberuhrt.
- **Eingeschrankte Bearbeitung** - Ein mit `p:modifyVerifier`-Passwort gespeichertes Deck offnet sich schreibgeschutzt; "Trotzdem bearbeiten" pruft das Passwort gegen jeden von ECMA-376 erlaubten Hash-Algorithmus. Ein Verifier ohne `saltData` kann nicht gepruft werden und fallt auf ein bedingungsloses "Trotzdem bearbeiten" zuruck; per COM bestatigt schreibt echtes PowerPoint immer ein Salt, dieser Fall kommt also aus echten Dateien nicht vor.
- **OLE-Aktionsverben** - Ein Klick auf `ppaction://ole?verb=N` offnet immer die eingebettete Datei, unabhangig vom Verb, weil der Browser die eigentliche Zielanwendung nicht starten kann.
- **Programm-Ausfuhrungsaktionen** - `ppaction://program` wird geparst und rundtrip-fest gespeichert, aber ein Klick tut in einer Show nichts, da ein Browser keine lokale ausfuhrbare Datei starten kann.
- **Kleine Bildschirme** - Die UI passt sich bis zu etwa 360-px-Telefonen an, aber die datendichtesten Panels (z. B. der volle Diagrammeditor) sind auf einem Tablet oder groesser besser nutzbar.

## EMF/WMF-Metadateien (`emf-converter`-Abhaengigkeit)

::: info Nicht der Code dieses Repositories
`emf-converter` ist ein eigenstandiges npm-Paket mit eigenem Repository; `pptx-viewer-core` konsumiert es nur. Die Tabelle unten beschreibt den heutigen Stand dieses Pakets; bei Abweichungen sind dessen eigene Release-Notes massgeblich.
:::

::: warning Canvas-API erforderlich
Die Metadatei-Konvertierung benotigt `OffscreenCanvas` oder `HTMLCanvasElement`. Reines Node.js ohne Canvas-Polyfill wird fur EMF/WMF-Bilder nicht unterstutzt (der Rest der Core-Engine lauft in Node problemlos).
:::

- **Verlaufsfullungen** - GDI+ lineare und Pfadverlaufe werden vereinfacht nur mit ihrer Primarfarbe gerendert.
- **Rasteroperationen** - GDI-ROP-Blending-Modi (XOR, NOT, AND, ...) werden ignoriert.
- **Clipping** - Nur ein einzelner Pfad wird unterstutzt; kombinierte GDI-Regionsoperationen (Vereinigung/Schnitt/Ausschluss) nicht.
- **Ausgabegrosse** - Auf 4096 x 4096 Pixel begrenzt.
- **Text** - Nutzt die Schrift-Engine des Browsers; Glyphenmetriken konnen von Windows GDI abweichen.

## Weiterfuhrende Links

- [Einfuhrung](/de/guide/introduction) - was das Projekt insgesamt unterstuzt.
- [Architektur](/de/guide/architecture) - warum diese Kompromisse existieren.
- [OpenXML-Konformitat](/architecture/openxml-conformance) - die formale Definition von "unterstutzt", die das Abdeckungsmanifest verwendet.
