const rect = (x, z, width, depth) => [
  [x, z],
  [x + width, z],
  [x + width, z + depth],
  [x, z + depth],
];

const centerOf = (polygon) => {
  const xs = polygon.map(([x]) => x);
  const zs = polygon.map(([, z]) => z);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
};

const room = (id, name, floorId, polygon, hint, category = "classroom", aliases = [], shortLabel = null) => ({
  id,
  name,
  floorId,
  polygon,
  labelPoint: centerOf(polygon),
  hint,
  category,
  aliases,
  shortLabel,
});

export const buildings = [
  { id: "main", name: "Budynek główny", shortName: "Budynek główny" },
  { id: "workshops", name: "Budynek pracowni", shortName: "Pracownie" },
  { id: "gym", name: "Sala gimnastyczna", shortName: "Sala gimnastyczna" },
];

const mainOutline = [
  [0, 0],
  [48, 0],
  [48, -2],
  [60, -2],
  [60, 18],
  [0, 18],
];

export const floors = [
  {
    id: "piwnica",
    buildingId: "main",
    title: "Piwnica",
    shortTitle: "Piwnica",
    level: -1,
    note: "Sala 04, gabinety psychologa i pedagoga, sala gimnastyczna, szatnia nauczycieli i sklepik szkolny.",
    outline: mainOutline,
    corridor: rect(0, 7, 60, 4),
  },
  {
    id: "parter",
    buildingId: "main",
    title: "Parter",
    shortTitle: "Parter",
    level: 0,
    note: "Sekretariat uczniowski, portiernia, sala kinowa, szatnia uczniowska oraz sale 1-8.",
    outline: [
      [-11, 0],
      [48, 0],
      [48, -2],
      [60, -2],
      [60, 18],
      [0, 18],
      [0, 26],
      [-10, 26],
      [-10, 8],
      [-11, 8],
    ],
    corridor: [[-2, 7], [60, 7], [60, 11], [0, 11], [0, 22], [-6, 22], [-6, 8], [-2, 8]],
  },
  {
    id: "pietro-1",
    buildingId: "main",
    title: "I piętro",
    shortTitle: "I piętro",
    level: 1,
    note: "Biblioteka, pokój nauczycielski, dyrekcja i administracja oraz sale 12-23.",
    outline: mainOutline,
    corridor: rect(0, 7, 60, 4),
  },
  {
    id: "pietro-2",
    buildingId: "main",
    title: "II piętro",
    shortTitle: "II piętro",
    level: 2,
    note: "Sale 24-34, gabinet wicedyrektora i kierownika szkolenia praktycznego.",
    outline: mainOutline,
    corridor: rect(0, 7, 60, 4),
  },
  {
    id: "pietro-3",
    buildingId: "main",
    title: "III piętro",
    shortTitle: "III piętro",
    level: 3,
    note: "Sala gimnastyczna, pracownie informatyczne i handlowe oraz administracja COSINUS.",
    outline: mainOutline,
    corridor: rect(0, 7, 60, 4),
  },
  {
    id: "pracownie",
    buildingId: "workshops",
    title: "Pracownie zewnętrzne",
    shortTitle: "Parter",
    level: 0,
    note: "Dwie oddzielne części bez przejścia: gastronomiczna i fryzjerska.",
    outlines: [
      [[0, 0], [34, 0], [34, 9], [26, 9], [26, 11], [14, 11], [14, 9], [0, 9]],
      rect(14, 12, 12, 14),
    ],
    corridors: [
      [[0, 5.6], [17, 5.6], [17, 7.4], [24, 7.4], [24, 11], [18, 11], [18, 9], [0, 9]],
      rect(18, 12, 4, 11),
    ],
  },
  {
    id: "gimnastyczna-0",
    buildingId: "gym",
    title: "Sala gimnastyczna, parter",
    shortTitle: "Parter",
    level: 0,
    note: "Główna hala, wejście, szatnia WF i zaplecze.",
    outline: rect(0, 0, 40, 15),
    corridor: [[0, 6], [13, 6], [13, 9], [18, 9], [18, 11], [0, 11]],
  },
  {
    id: "gimnastyczna-1",
    buildingId: "gym",
    title: "Sala gimnastyczna, I piętro",
    shortTitle: "I piętro",
    level: 1,
    note: "Pokój nauczycieli WF i widok na przestrzeń hali.",
    outline: rect(0, 0, 40, 15),
    corridor: [[0, 5.5], [14, 5.5], [14, 8.5], [18, 8.5], [18, 11], [0, 11]],
  },
];

export const spaces = [
  room("psycholog", "P, psycholog", "piwnica", rect(0, 11, 6, 7), "Dolny lewy korytarz. Zejdź lewą klatką schodową.", "office", ["gabinet psychologa", "psycholog"], "P"),
  room("pedagog", "P, pedagog", "piwnica", rect(6, 11, 6, 7), "Obok gabinetu psychologa, w lewej dolnej części piwnicy.", "office", ["gabinet pedagoga", "pedagog"], "P"),
  room("04", "Sala 04", "piwnica", rect(12, 11, 8, 7), "Dolny korytarz, po lewej stronie środkowej klatki schodowej.", "classroom", ["4", "sala 4"]),
  room("gim-piwnica", "Sala gimnastyczna, piwnica", "piwnica", rect(26, 11, 9, 7), "Dolny środkowy korytarz, obok środkowej klatki schodowej.", "gym", ["hala", "siłownia", "sala gimnastyczna piwnica"], "SG"),
  room("szatnia-nauczycieli", "SN, szatnia nauczycieli", "piwnica", rect(42, 11, 7, 7), "Dolny prawy korytarz, przed prawą klatką schodową.", "support", ["szatnia nauczycieli"], "SN"),
  room("sklepik", "Sklepik szkolny", "piwnica", rect(49, 11, 6, 7), "Obok szatni nauczycieli, w prawej części piwnicy.", "service", ["sklep", "bufet"], "SKL"),

  room("szatnia", "PF, szatnia uczniowska", "parter", rect(0, 0, 6, 7), "Lewa górna część budynku, przed salą 5.", "support", ["szatnia", "szatnia uczniowska"], "PF"),
  room("5", "Sala 5", "parter", rect(6, 0, 9, 7), "Górny korytarz, obok szatni i lewej klatki schodowej."),
  room("7", "Sala 7", "parter", rect(15, 0, 6, 7), "Naprzeciw środkowej klatki schodowej, obok WC."),
  room("wc-0", "WC męskie", "parter", rect(21, 0, 4, 7), "Naprzeciw środkowej klatki schodowej, między salami 7 i 6.", "support", ["toaleta", "męskie"]),
  room("6", "Sala 6, pracownia fryzjerska", "parter", rect(25, 0, 14, 7), "Górny korytarz, między WC a salą 8.", "workshop", ["fryzjer", "pracownia fryzjerska"]),
  room("8", "Sala 8, sala gimnastyczna", "parter", rect(39, 0, 9, 7), "Górny prawy korytarz, przed prawą klatką schodową.", "gym", ["hala", "sala gimnastyczna"]),
  room("portiernia", "PI, portiernia", "parter", rect(52, -2, 8, 6.5), "Prawa część parteru przy wejściu i prawej klatce schodowej.", "service", ["monitoring", "portier"], "PI"),
  room("sala-kinowa", "SK, sala kinowa", "parter", rect(-6, 11, 6, 11), "Lewa część parteru, przy przejściu do pracowni fryzjerskiej.", "service", ["kino", "aula", "sala kinowa"], "SK"),
  room("4", "Sala 4", "parter", rect(0, 11, 8, 7), "Dolny lewy korytarz, przy lewej klatce schodowej."),
  room("3", "Sala 3", "parter", rect(8, 11, 10, 7), "Dolny korytarz, między salą 4 a środkową klatką schodową."),
  room("2", "Sala 2", "parter", rect(27, 11, 11, 7), "Dolny środkowy korytarz, obok środkowej klatki schodowej."),
  room("1", "Sala 1, sekretariat uczniowski", "parter", rect(44, 11, 5, 7), "Prawa część parteru, przy prawej klatce schodowej.", "administration", ["sekretariat", "sekretariat uczniowski"]),

  room("19", "Sala 19", "pietro-1", rect(0, 0, 10, 7), "Górny lewy korytarz, nad salą 18."),
  room("20", "Sala 20", "pietro-1", rect(10, 0, 10, 7), "Górny lewy korytarz, między salą 19 a salą 21."),
  room("21", "Sala 21, biblioteka", "pietro-1", rect(20, 0, 8, 7), "Górny środkowy korytarz, obok sali 20.", "service", ["biblioteka", "czytelnia"]),
  room("wc-1", "WC damskie", "pietro-1", rect(28, 0, 5, 7), "Górny środkowy korytarz.", "support", ["toaleta", "damskie"]),
  room("22", "Sala 22", "pietro-1", rect(33, 0, 15, 7), "Górny prawy korytarz, przed prawą klatką schodową."),
  room("23", "Sala 23", "pietro-1", rect(52, -2, 8, 9), "Prawy górny narożnik przy prawej klatce schodowej."),
  room("18", "Sala 18", "pietro-1", rect(0, 11, 10, 7), "Dolny lewy korytarz, przy lewej klatce schodowej."),
  room("17", "Sala 17", "pietro-1", rect(10, 11, 10, 7), "Dolny lewy korytarz, obok sali 18."),
  room("16", "Sala 16, pokój nauczycielski", "pietro-1", rect(28, 11, 11, 7), "Dolny środkowy korytarz, obok środkowej klatki schodowej.", "office", ["pokój nauczycielski"]),
  room("15b", "Sala 15b, księgowość", "pietro-1", rect(39, 11, 4, 7), "Dolny prawy korytarz, obok sali 16.", "administration", ["księgowość"]),
  room("15a", "Sala 15a, kadry", "pietro-1", rect(43, 11, 4, 7), "Dolny prawy korytarz, między księgowością a salą 14.", "administration", ["kadry"]),
  room("14", "Sala 14, wicedyrektor Marzena Filusz", "pietro-1", rect(47, 11, 4, 7), "Dolny prawy korytarz, obok kadr.", "administration", ["wicedyrektor", "Marzena Filusz"]),
  room("13", "Sala 13, sekretariat dyrektora", "pietro-1", rect(51, 11, 4, 7), "Dolny prawy korytarz, obok gabinetu dyrektora.", "administration", ["sekretariat dyrektora"]),
  room("12", "Sala 12, dyrektor Wiesław Filipiak", "pietro-1", rect(55, 11, 5, 7), "Skrajny prawy dolny korytarz.", "administration", ["dyrektor", "Wiesław Filipiak"]),

  room("30", "Sala 30", "pietro-2", rect(0, 0, 10, 7), "Górny lewy korytarz, nad salą 29."),
  room("31", "Sala 31", "pietro-2", rect(10, 0, 10, 7), "Górny lewy korytarz, między salą 30 a salą 32."),
  room("32", "Sala 32", "pietro-2", rect(20, 0, 8, 7), "Górny środkowy korytarz, obok WC."),
  room("wc-2", "WC męskie", "pietro-2", rect(28, 0, 5, 7), "Górny środkowy korytarz.", "support", ["toaleta", "męskie"]),
  room("33", "Sala 33", "pietro-2", rect(33, 0, 15, 7), "Górny prawy korytarz, przed prawą klatką schodową."),
  room("34", "Sala 34", "pietro-2", rect(52, -2, 8, 9), "Prawy górny narożnik przy prawej klatce schodowej."),
  room("29", "Sala 29", "pietro-2", rect(0, 11, 10, 7), "Dolny lewy korytarz, przy lewej klatce schodowej."),
  room("28", "Sala 28", "pietro-2", rect(10, 11, 10, 7), "Dolny lewy korytarz, obok sali 29."),
  room("27", "Sala 27", "pietro-2", rect(28, 11, 11, 7), "Dolny środkowy korytarz, obok środkowej klatki schodowej."),
  room("26", "Sala 26", "pietro-2", rect(39, 11, 10, 7), "Dolny prawy korytarz, obok sali 27."),
  room("25", "Sala 25, kierownik szkolenia praktycznego Arkadiusz Mocarski", "pietro-2", rect(49, 11, 6, 7), "Dolny prawy korytarz. Gabinet kierownika szkolenia praktycznego.", "administration", ["kierownik szkolenia praktycznego", "Arkadiusz Mocarski"]),
  room("24", "Sala 24, wicedyrektor Małgorzata Kończyńska", "pietro-2", rect(55, 11, 5, 7), "Skrajny prawy dolny korytarz.", "administration", ["wicedyrektor", "Małgorzata Kończyńska"]),

  room("40", "Sala 40", "pietro-3", rect(0, 0, 10, 7), "Górny lewy korytarz, nad salą 39."),
  room("41", "Sala 41, pracownia handlowa", "pietro-3", rect(10, 0, 10, 7), "Górny lewy korytarz, między salą 40 a salą 42.", "workshop", ["pracownia handlowa", "handel"]),
  room("42", "Sala 42, pracownia handlowa", "pietro-3", rect(20, 0, 11, 7), "Górny środkowy korytarz, obok WC.", "workshop", ["pracownia handlowa", "handel"]),
  room("wc-3", "WC damskie", "pietro-3", rect(31, 0, 5, 7), "Górny środkowy korytarz.", "support", ["toaleta", "damskie"]),
  room("43", "Sala 43", "pietro-3", rect(36, 0, 12, 7), "Górny prawy korytarz, przed prawą klatką schodową."),
  room("44", "Sala 44", "pietro-3", rect(52, -2, 8, 9), "Prawy górny narożnik przy prawej klatce schodowej."),
  room("39", "Sala 39, sala gimnastyczna", "pietro-3", rect(0, 11, 18, 7), "Dolny lewy korytarz, przy lewej klatce schodowej.", "gym", ["hala", "sala gimnastyczna"]),
  room("38", "Sala 38, pracownia informatyczna", "pietro-3", rect(25, 11, 8, 7), "Dolny środkowy korytarz, obok środkowej klatki schodowej.", "technical", ["informatyczna", "komputerowa"]),
  room("37", "Sala 37, pracownia informatyczna", "pietro-3", rect(33, 11, 12, 7), "Dolny prawy korytarz. Najbliżej ze środkowej lub prawej klatki schodowej.", "technical", ["informatyczna", "komputerowa"]),
  room("36", "Sala 36, wicedyrektor Maciej Najwer", "pietro-3", rect(45, 11, 7, 7), "Dolny prawy korytarz, między salą 37 a sekretariatem dyrektora COSINUS.", "administration", ["wicedyrektor", "Maciej Najwer"]),
  room("35", "Sala 35, sekretariat dyrektora COSINUS", "pietro-3", rect(52, 11, 8, 7), "Skrajny prawy dolny narożnik.", "administration", ["sekretariat dyrektora", "cosinus"]),

  room("p1", "Sala 1, pracownie zewnętrzne", "pracownie", rect(0, 5.6, 9, 3.4), "Lewa część budynku pracowni, przy wyjściu ewakuacyjnym.", "classroom", ["sala dydaktyczna"]),
  room("p2", "Sala 2, pracownia cukierniczo-piekarska", "pracownie", rect(14, 0, 12, 7), "Górna część budynku pracowni.", "workshop", ["cukiernicza", "piekarska"]),
  room("p3", "Pomieszczenie magazynowe 3", "pracownie", rect(14, 7, 5, 4), "Środkowa część budynku pracowni.", "support", ["magazyn 3"]),
  room("p4", "Pomieszczenie magazynowe 4", "pracownie", rect(19, 7, 5, 4), "Środkowa część budynku pracowni.", "support", ["magazyn 4"]),
  room("prf2", "prF2, pracownia fryzjerska", "pracownie", rect(14, 12, 12, 7), "Oddzielna część fryzjerska. Wejście od uliczki między budynkami.", "workshop", ["prF2", "fryzjer", "pracownia fryzjerska"], "prF2"),
  room("prf3", "prF3, sala teorii fryzjerskiej", "pracownie", rect(18, 19, 8, 4), "Część fryzjerska, obok pracowni prF2.", "classroom", ["prF3", "teoria fryzjerska"], "prF3"),
  room("p7", "Pokój nauczycielski", "pracownie", rect(18, 23, 8, 3), "Dolny prawy narożnik części fryzjerskiej.", "office", ["nauczyciele"]),
  room("p8", "Pomieszczenie magazynowe 8", "pracownie", rect(14, 19, 4, 7), "Dolny lewy narożnik części fryzjerskiej.", "support", ["magazyn 8"]),
  room("garaz", "Garaż", "pracownie", rect(30, 0, 4, 8), "Skrajna prawa część budynku pracowni.", "support", ["garaż"]),

  room("cosinus-gim", "Cosinus", "gimnastyczna-0", rect(0, 8.5, 7, 6.5), "Lewa dolna część zaplecza sali gimnastycznej.", "office"),
  room("szatnia-wf", "Szatnia WF", "gimnastyczna-0", rect(7, 10, 7, 5), "Zaplecze przy wejściu do głównej hali.", "support", ["szatnia"]),
  room("gim-0", "Sala gimnastyczna", "gimnastyczna-0", rect(14, 0, 26, 15), "Główna przestrzeń hali po prawej stronie planu.", "gym", ["hala", "wf"]),
  room("wf", "Pokój nauczycieli WF", "gimnastyczna-1", rect(7, 9, 7, 6), "Dolna część zaplecza na I piętrze.", "office", ["pokój wf", "nauczyciele wf"]),
  room("gim-1", "Przestrzeń sali gimnastycznej", "gimnastyczna-1", rect(14, 0, 26, 15), "Widok na główną przestrzeń hali z I piętra.", "gym", ["hala", "wf"]),
];

export const structuralSpaces = [
  { id: "piwnica-socjalne", floorId: "piwnica", polygon: rect(0, 0, 19, 7) },
  { id: "piwnica-fortum", floorId: "piwnica", polygon: rect(20, 0, 10, 7) },
  { id: "piwnica-fryz", floorId: "piwnica", polygon: rect(31, 0, 13, 7) },
  { id: "piwnica-naroznik", floorId: "piwnica", polygon: rect(51, -2, 9, 8.5) },
  { id: "piwnica-magazyn", floorId: "piwnica", polygon: rect(10, 7, 10, 4) },
  { id: "piwnica-magazynek", floorId: "piwnica", polygon: rect(34, 7, 6, 4) },
  { id: "parter-lewe-skrzydlo", floorId: "parter", polygon: rect(-11, 0, 11, 8) },
  { id: "parter-dawna-1a", floorId: "parter", polygon: rect(49, 11, 5, 7) },
  { id: "parter-prawy-naroznik", floorId: "parter", polygon: rect(54, 11, 6, 7) },
];

const mainStairs = (floorId) => [
  {
    id: `${floorId}-stairs-left`,
    floorId,
    type: "stairs",
    label: "Schody",
    polygon: rect(2.4, 7.15, 5.4, 2.35),
    labelPoint: [5.1, 8.3],
  },
  {
    id: `${floorId}-stairs-center`,
    floorId,
    type: "stairs",
    label: "Schody",
    polygon: rect(20.3, 11.15, 4.4, 5.7),
    labelPoint: [22.5, 14],
  },
  {
    id: `${floorId}-stairs-right`,
    floorId,
    type: "stairs",
    label: "Schody",
    polygon: floorId === "piwnica" ? rect(45, 0.35, 5.7, 6.3) : rect(48.2, 0.35, 3.55, 6.3),
    labelPoint: floorId === "piwnica" ? [47.85, 3.5] : [50, 3.5],
  },
];

export const connectors = [
  ...mainStairs("piwnica"),
  ...mainStairs("parter"),
  ...mainStairs("pietro-1"),
  ...mainStairs("pietro-2"),
  ...mainStairs("pietro-3"),
  { id: "gym-stairs-main-0", floorId: "gimnastyczna-0", type: "stairs", label: "Schody", polygon: rect(4.5, 1.2, 4.5, 4.4), labelPoint: [6.75, 3.4] },
  { id: "gym-stairs-main-1", floorId: "gimnastyczna-1", type: "stairs", label: "Schody", polygon: rect(4.5, 1.2, 4.5, 4.4), labelPoint: [6.75, 3.4] },
];

export const landmarks = [
  { id: "parter-courtyard", floorId: "parter", type: "entrance", label: "Wejście na boisko / dziedziniec", point: [31, 18] },
  { id: "parter-main", floorId: "parter", type: "entrance", label: "Wejście główne", point: [60, 9] },
  { id: "piwnica-east", floorId: "piwnica", type: "entrance", label: "Wejście", point: [60, 9] },
  { id: "workshops-exit", floorId: "pracownie", type: "entrance", label: "Wyjście", point: [0, 2] },
  { id: "gastronomy-entrance", floorId: "pracownie", type: "entrance", label: "Wejście G", point: [24, 0] },
  { id: "hairdressing-entrance", floorId: "pracownie", type: "entrance", label: "Wejście F", point: [14, 21] },
  { id: "gym-entrance", floorId: "gimnastyczna-0", type: "entrance", label: "Wejście", point: [0, 7.5] },
];

export const floorById = (id) => floors.find((floor) => floor.id === id);
export const buildingById = (id) => buildings.find((building) => building.id === id);
export const spacesOnFloor = (floorId) => spaces.filter((space) => space.floorId === floorId);
export const connectorsOnFloor = (floorId) => connectors.filter((connector) => connector.floorId === floorId);
export const landmarksOnFloor = (floorId) => landmarks.filter((landmark) => landmark.floorId === floorId);
export const structuralSpacesOnFloor = (floorId) => structuralSpaces.filter((space) => space.floorId === floorId);

export const shortRoomLabel = (space) => {
  if (space.shortLabel) return space.shortLabel;
  const match = space.name.match(/\b\d+[a-z]?\b/i);
  if (match) return match[0];
  if (space.id.startsWith("wc")) return "WC";
  if (space.id === "wf") return "WF";
  if (space.category === "gym") return "Hala";
  return space.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
};
