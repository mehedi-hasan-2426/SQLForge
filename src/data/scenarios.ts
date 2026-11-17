import type { ScenarioId } from "../domain";

export interface ColumnSpec {
  name: string;
  type: string;
  key?: "PK" | "FK";
  reference?: string;
  description: string;
}

export interface TableSpec {
  name: string;
  columns: ColumnSpec[];
  rows: Record<string, string | number | null>[];
}

export interface ScenarioSpec {
  id: ScenarioId;
  label: string;
  description: string;
  tables: TableSpec[];
}

const customers = [
  ["Mia", "Bauer", "Bremen"], ["Noah", "Schmidt", "Hamburg"], ["Lea", "Fischer", "Berlin"],
  ["Paul", "Weber", "München"], ["Emilia", "Meyer", "Bremen"], ["Luca", "Wagner", "Köln"],
  ["Lina", "Becker", "Berlin"], ["Finn", "Schulz", "Dresden"], ["Ella", "Hoffmann", "Hamburg"],
  ["Ben", "Koch", "Köln"], ["Amira", "Richter", "Leipzig"], ["Jonas", "Klein", "Berlin"],
  ["Sara", "Wolf", "Bremen"], ["Omar", "Neumann", "München"], ["Ida", "Schwarz", "Dresden"],
  ["Theo", "Zimmermann", "Leipzig"], ["Nina", "Braun", "Köln"], ["Alex", "Krüger", "Hamburg"]
];

const staffs = [
  ["Lena", "Kaiser", 54000, 1], ["David", "Brandt", 47500, 1], ["Mara", "Seidel", 51000, 1],
  ["Erik", "Arnold", 43200, 1], ["Sofia", "Jung", 62000, 1], ["Milan", "Lorenz", 45800, 1],
  ["Tara", "Kraft", 49000, 1], ["Emil", "Frank", 53000, 1], ["Romy", "Busch", 46700, 1],
  ["Levi", "Vogt", 59000, 1], ["Yara", "Fuchs", 44500, 1], ["Max", "Graf", 50500, null]
];

const foodDescriptions = [
  "Röstkartoffeln", "Apfelkuchen", "Bohnensuppe", "Rindfleisch-Burger", "Avocado-Salat",
  "Beeren-Muffin", "Ravioli", "Asia-Nudeln", "Bratkartoffeln", "Reis-Bowl",
  "Apfelschorle", "Bananenbrot", "Rucola-Pizza", "Ananas-Dessert", "Brezel",
  "Rahmspinat", "Bulgur-Salat", "Rosmarin-Hähnchen", "Americano", "Brownie"
];

const foodItems = foodDescriptions.map((description, index) => ({
  FOOD_ITEM_NUMBER: index + 1,
  DESCRIPTION: description,
  PRICE: [4.5, 3.2, 6.8, 8.9, 7.4, 2.8, 9.2, 7.9, 5.3, 8.2, 2.4, 3.8, 10.5, 4.1, 1.9, 6.2, 5.8, 11.4, 2.6, 3.5][index],
  REGULAR_CODE: index % 2 === 0 ? "R1" : "R2",
  PROMO_CODE: index % 4 === 0 ? "P1" : null
}));

const orderYears = [2019, 2020, 2021, 2022];
const orders = Array.from({ length: 30 }, (_, index) => {
  const orderNumber = 1001 + index;
  const year = orderYears[index % orderYears.length];
  const month = (index % 12) + 1;
  const day = (index % 25) + 1;
  const customerId = (index % 14) + 1;
  const staffId = (index % 10) + 1;
  const firstItem = index % foodItems.length;
  const secondItem = (index + 7) % foodItems.length;
  const calculated = ((index % 3) + 1) * foodItems[firstItem].PRICE
    + ((index % 2) + 1) * foodItems[secondItem].PRICE;
  return {
    ORDER_NUMBER: orderNumber,
    ORDER_DATE: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    ORDER_TOTAL: index === 7 ? calculated + 2.5 : index === 22 ? calculated - 1.8 : calculated,
    CUST_ID: customerId,
    STAFF_ID: staffId
  };
});

const orderLines = orders.flatMap((order, index) => {
  const firstItem = (index % foodItems.length) + 1;
  const secondItem = ((index + 7) % foodItems.length) + 1;
  return [
    { ORDER_NUMBER: order.ORDER_NUMBER, FOOD_ITEM_NUMBER: firstItem, QUANTITY: (index % 3) + 1 },
    { ORDER_NUMBER: order.ORDER_NUMBER, FOOD_ITEM_NUMBER: secondItem, QUANTITY: (index % 2) + 1 }
  ];
});

const medicines = [
  ["Aspirin classic", 4.2, 1], ["Aspirin plus C", 7.9, 1], ["Aspenrelief", 12.5, 2],
  ["Paracetamol 500", 3.8, 2], ["Ibuprofen 400", 5.4, 3], ["Hustenruhe", 8.2, 4],
  ["Allergofrei", 11.9, 5], ["Magenfreund", 6.7, 2], ["Vitamin D3", 9.4, 3],
  ["CalciBalance", 13.5, 4],   ["Nasenspray mild", 3.4, 0], ["Wundsalbe", 5.9, 5],
  ["Schlafwohl", 14.8, 3], ["EisenPlus", 10.1, 2], ["HerzFit", 18.6, 4],
  ["Muskelfit", 16.3, 6], ["Augentropfen", 7.1, 1], ["DarmBalance", 12.2, 5],
  ["Kopfweh akut", 4.9, 3], ["Hautpflege forte", 21.5, 4]
];

const activeIngredients = [
  "Acetylsalicylsäure", "Ascorbinsäure", "Paracetamol", "Ibuprofen", "Dextromethorphan",
  "Cetirizin", "Magnesium", "Vitamin D", "Calcium", "Eisen", "Natriumchlorid", "Zink"
];

let linkId = 1;
const medicineLinks = medicines.flatMap(([, , count], medicineIndex) =>
  Array.from({ length: count as number }, (_, ingredientIndex) => ({
    AMID: medicineIndex + 1,
    WIRKSTOFFID: ((medicineIndex + ingredientIndex) % activeIngredients.length) + 1,
    MENGE: 10 + ingredientIndex * 5 + medicineIndex
  })).map((row) => ({ ...row, _id: linkId++ }))
);

export const SCENARIOS: Record<ScenarioId, ScenarioSpec> = {
  fastfood: {
    id: "fastfood",
    label: "Global Fast Foods",
    description: "Kunden, Bestellungen, Artikel und Mitarbeitende",
    tables: [
      {
        name: "F_CUSTOMERS",
        columns: [
          { name: "ID", type: "INTEGER", key: "PK", description: "Eindeutige Kunden-ID" },
          { name: "FIRST_NAME", type: "TEXT", description: "Vorname" },
          { name: "LAST_NAME", type: "TEXT", description: "Nachname" },
          { name: "ADDRESS", type: "TEXT", description: "Straße und Hausnummer" },
          { name: "CITY", type: "TEXT", description: "Wohnort" },
          { name: "STATE", type: "TEXT", description: "Bundeslandkürzel" },
          { name: "ZIP", type: "TEXT", description: "Postleitzahl" },
          { name: "PHONE_NUMBER", type: "TEXT", description: "Telefonnummer" }
        ],
        rows: customers.map(([first, last, city], index) => ({
          ID: index + 1,
          FIRST_NAME: first,
          LAST_NAME: last,
          ADDRESS: `${index + 10} Lernweg`,
          CITY: city,
          STATE: ["HB", "HH", "BE", "BY", "NW", "SN", "HE", "TH"][index % 8],
          ZIP: `${10000 + index * 127}`,
          PHONE_NUMBER: `030-555-${String(1000 + index).slice(-4)}`
        }))
      },
      {
        name: "F_STAFFS",
        columns: [
          { name: "ID", type: "INTEGER", key: "PK", description: "Eindeutige Mitarbeiter-ID" },
          { name: "FIRST_NAME", type: "TEXT", description: "Vorname" },
          { name: "LAST_NAME", type: "TEXT", description: "Nachname" },
          { name: "BIRTHDATE", type: "DATE", description: "Geburtsdatum" },
          { name: "SALARY", type: "REAL", description: "Jahresgehalt in Euro" },
          { name: "OVERTIME_RATE", type: "REAL", description: "Zuschlag für Überstunden" },
          { name: "TRAINING", type: "TEXT", description: "Qualifikation" },
          { name: "STAFF_TYPE", type: "TEXT", description: "Beschäftigungsart" },
          { name: "MANAGER_ID", type: "INTEGER", key: "FK", reference: "F_STAFFS.ID", description: "Führungskraft, falls zugeordnet" }
        ],
        rows: staffs.map(([first, last, salary, manager], index) => ({
          ID: index + 1,
          FIRST_NAME: first,
          LAST_NAME: last,
          BIRTHDATE: `${1978 + index}-0${(index % 8) + 1}-${String((index % 27) + 1).padStart(2, "0")}`,
          SALARY: salary as number,
          OVERTIME_RATE: 1.25 + (index % 3) * 0.25,
          TRAINING: ["Service", "Küche", "Leitung"][index % 3],
          STAFF_TYPE: index % 4 === 0 ? "Teilzeit" : "Vollzeit",
          MANAGER_ID: manager as number | null
        }))
      },
      {
        name: "F_ORDERS",
        columns: [
          { name: "ORDER_NUMBER", type: "INTEGER", key: "PK", description: "Bestellnummer" },
          { name: "ORDER_DATE", type: "DATE", description: "Bestelldatum" },
          { name: "ORDER_TOTAL", type: "REAL", description: "Gespeicherte Bestellsumme" },
          { name: "CUST_ID", type: "INTEGER", key: "FK", reference: "F_CUSTOMERS.ID", description: "Kunde der Bestellung" },
          { name: "STAFF_ID", type: "INTEGER", key: "FK", reference: "F_STAFFS.ID", description: "Bearbeitende Person" }
        ],
        rows: orders
      },
      {
        name: "F_FOOD_ITEMS",
        columns: [
          { name: "FOOD_ITEM_NUMBER", type: "INTEGER", key: "PK", description: "Artikelnummer" },
          { name: "DESCRIPTION", type: "TEXT", description: "Artikelbeschreibung" },
          { name: "PRICE", type: "REAL", description: "Preis in Euro" },
          { name: "REGULAR_CODE", type: "TEXT", key: "FK", reference: "F_REGULAR_MENUS.CODE", description: "Reguläres Menü" },
          { name: "PROMO_CODE", type: "TEXT", key: "FK", reference: "F_PROMOTIONAL_MENUS.CODE", description: "Aktion, falls vorhanden" }
        ],
        rows: foodItems
      },
      {
        name: "F_ORDER_LINES",
        columns: [
          { name: "ORDER_NUMBER", type: "INTEGER", key: "FK", reference: "F_ORDERS.ORDER_NUMBER", description: "Bestellnummer" },
          { name: "FOOD_ITEM_NUMBER", type: "INTEGER", key: "FK", reference: "F_FOOD_ITEMS.FOOD_ITEM_NUMBER", description: "Artikelnummer" },
          { name: "QUANTITY", type: "INTEGER", description: "Menge" }
        ],
        rows: orderLines
      },
      {
        name: "F_PROMOTIONAL_MENUS",
        columns: [
          { name: "CODE", type: "TEXT", key: "PK", description: "Aktionscode" },
          { name: "NAME", type: "TEXT", description: "Aktionsname" },
          { name: "START_DATE", type: "DATE", description: "Startdatum" },
          { name: "END_DATE", type: "DATE", description: "Enddatum" },
          { name: "GIVE_AWAY", type: "TEXT", description: "Bonusartikel" }
        ],
        rows: [
          { CODE: "P1", NAME: "Frühlingsaktion", START_DATE: "2020-03-01", END_DATE: "2020-05-31", GIVE_AWAY: "Getränk" },
          { CODE: "P2", NAME: "Sommeraktion", START_DATE: "2022-06-01", END_DATE: "2022-08-31", GIVE_AWAY: "Dessert" }
        ]
      },
      {
        name: "F_REGULAR_MENUS",
        columns: [
          { name: "CODE", type: "TEXT", key: "PK", description: "Menücode" },
          { name: "TYPE", type: "TEXT", description: "Menütyp" },
          { name: "HOURS_SERVED", type: "TEXT", description: "Ausgabezeiten" }
        ],
        rows: [
          { CODE: "R1", TYPE: "Mittag", HOURS_SERVED: "11–15 Uhr" },
          { CODE: "R2", TYPE: "Abend", HOURS_SERVED: "17–22 Uhr" }
        ]
      },
      {
        name: "F_SHIFTS",
        columns: [
          { name: "CODE", type: "INTEGER", key: "PK", description: "Schichtcode" },
          { name: "DESCRIPTION", type: "TEXT", description: "Schichtname" }
        ],
        rows: [
          { CODE: 1, DESCRIPTION: "Frühschicht" },
          { CODE: 2, DESCRIPTION: "Spätschicht" }
        ]
      },
      {
        name: "F_SHIFT_ASSIGNMENTS",
        columns: [
          { name: "CODE", type: "INTEGER", key: "FK", reference: "F_SHIFTS.CODE", description: "Schichtcode" },
          { name: "ID", type: "INTEGER", key: "FK", reference: "F_STAFFS.ID", description: "Mitarbeiter-ID" },
          { name: "SHIFT_ASSIGN_DATE", type: "DATE", description: "Einsatzdatum" }
        ],
        rows: [
          { CODE: 1, ID: 1, SHIFT_ASSIGN_DATE: "2022-02-01" },
          { CODE: 2, ID: 2, SHIFT_ASSIGN_DATE: "2022-02-01" },
          { CODE: 1, ID: 3, SHIFT_ASSIGN_DATE: "2022-02-02" }
        ]
      }
    ]
  },
  medicine: {
    id: "medicine",
    label: "Arzneimittel",
    description: "Arzneimittel, Hersteller und Wirkstoffzuordnungen",
    tables: [
      {
        name: "ARZNEIMITTEL",
        columns: [
          { name: "AMID", type: "INTEGER", key: "PK", description: "Arzneimittel-ID" },
          { name: "BEZEICHNUNG", type: "TEXT", description: "Name des Arzneimittels" },
          { name: "PREIS", type: "REAL", description: "Preis in Euro" },
          { name: "HERSTELLER_ID", type: "INTEGER", key: "FK", reference: "HERSTELLER.HERSTELLER_ID", description: "Hersteller" }
        ],
        rows: medicines.map(([name, price, manufacturer], index) => ({ AMID: index + 1, BEZEICHNUNG: name as string, PREIS: price as number, HERSTELLER_ID: manufacturer as number }))
      },
      {
        name: "WIRKSTOFFE",
        columns: [
          { name: "WIRKSTOFFID", type: "INTEGER", key: "PK", description: "Wirkstoff-ID" },
          { name: "BEZEICHNUNG", type: "TEXT", description: "Wirkstoffname" }
        ],
        rows: activeIngredients.map((name, index) => ({ WIRKSTOFFID: index + 1, BEZEICHNUNG: name }))
      },
      {
        name: "ARZNEIMITTELWIRKSTOFFE",
        columns: [
          { name: "AMID", type: "INTEGER", key: "FK", reference: "ARZNEIMITTEL.AMID", description: "Arzneimittel-ID" },
          { name: "WIRKSTOFFID", type: "INTEGER", key: "FK", reference: "WIRKSTOFFE.WIRKSTOFFID", description: "Wirkstoff-ID" },
          { name: "MENGE", type: "REAL", description: "Menge in Milligramm" }
        ],
        rows: medicineLinks.map(({ _id: _ignored, ...row }) => row)
      },
      {
        name: "HERSTELLER",
        columns: [
          { name: "HERSTELLER_ID", type: "INTEGER", key: "PK", description: "Hersteller-ID" },
          { name: "NAME", type: "TEXT", description: "Firmenname" },
          { name: "ORT", type: "TEXT", description: "Firmensitz" }
        ],
        rows: [
          { HERSTELLER_ID: 1, NAME: "NordMed", ORT: "Hamburg" },
          { HERSTELLER_ID: 2, NAME: "RheinPharm", ORT: "Köln" },
          { HERSTELLER_ID: 3, NAME: "ElbeCare", ORT: "Dresden" },
          { HERSTELLER_ID: 4, NAME: "AlpenVital", ORT: "München" },
          { HERSTELLER_ID: 5, NAME: "CityHealth", ORT: "Berlin" },
          { HERSTELLER_ID: 6, NAME: "Wirkstofffrei GmbH", ORT: "Bremen" }
        ]
      }
    ]
  }
};

export const makeTableSql = (table: TableSpec): string => {
  const columns = table.columns.map((column) => {
    const key = column.key === "PK" && table.name !== "F_ORDER_LINES" && table.name !== "ARZNEIMITTELWIRKSTOFFE" ? " PRIMARY KEY" : "";
    return `"${column.name}" ${column.type}${key}`;
  });
  if (table.name === "F_ORDER_LINES") columns.push("PRIMARY KEY (ORDER_NUMBER, FOOD_ITEM_NUMBER)");
  if (table.name === "ARZNEIMITTELWIRKSTOFFE") columns.push("PRIMARY KEY (AMID, WIRKSTOFFID)");
  for (const column of table.columns) {
    if (column.key === "FK" && column.reference) {
      const [referenceTable, referenceColumn] = column.reference.split(".");
      columns.push(`FOREIGN KEY ("${column.name}") REFERENCES "${referenceTable}" ("${referenceColumn}")`);
    }
  }
  return `CREATE TABLE "${table.name}" (${columns.join(", ")})`;
};
