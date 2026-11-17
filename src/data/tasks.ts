import type { Difficulty, ScenarioId, Task } from "../domain";

interface Draft {
  title: string;
  prompt: string;
  scenario: ScenarioId;
  topic: string;
  solution: string;
  examSolution?: string;
  alternatives?: string[];
  requires?: string[];
  ordered?: boolean;
}

interface Template {
  id: string;
  difficulty: Difficulty;
  build: (variant: number) => Draft;
}

const cities = ["Bremen", "Hamburg", "Berlin", "München", "Köln"];
const initials = ["R", "A", "B", "R", "A"];
const years = [2019, 2020, 2021, 2022, 2020];
const limits = [1, 2, 3, 4, 5];

const templates: Template[] = [
  {
    id: "select-food-starts",
    difficulty: "leicht",
    build: (v) => ({
      title: "Artikel nach Anfangsbuchstaben",
      prompt: `Zeigen Sie alle Artikeldaten für Artikel an, deren Beschreibung mit „${initials[v]}“ beginnt.`,
      scenario: "fastfood", topic: "SELECT und WHERE",
      solution: `SELECT * FROM F_FOOD_ITEMS WHERE DESCRIPTION LIKE '${initials[v]}%';`,
      requires: ["LIKE"]
    })
  },
  {
    id: "select-city",
    difficulty: "leicht",
    build: (v) => ({
      title: "Kunden aus einer Stadt",
      prompt: `Zeigen Sie ID und Nachnamen aller Kunden aus ${cities[v]} an. Sortieren Sie nach Nachnamen aufsteigend.`,
      scenario: "fastfood", topic: "SELECT und WHERE",
      solution: `SELECT ID, LAST_NAME FROM F_CUSTOMERS WHERE CITY = '${cities[v]}' ORDER BY LAST_NAME ASC;`,
      requires: ["WHERE", "ORDER BY"], ordered: true
    })
  },
  {
    id: "select-price-range",
    difficulty: "mittel",
    build: (v) => {
      const low = [3, 4, 5, 6, 7][v];
      const high = low + 5;
      return {
        title: "Artikel im Preisbereich",
        prompt: `Zeigen Sie Bezeichnung und Preis aller Artikel zwischen ${low} € und ${high} € an, einschließlich der Grenzen.`,
        scenario: "fastfood", topic: "SELECT und WHERE",
        solution: `SELECT DESCRIPTION, PRICE FROM F_FOOD_ITEMS WHERE PRICE BETWEEN ${low} AND ${high} ORDER BY PRICE;`,
        requires: ["BETWEEN", "ORDER BY"], ordered: true
      };
    }
  },
  {
    id: "like-start",
    difficulty: "leicht",
    build: (v) => ({
      title: "Text beginnt mit",
      prompt: `Zeigen Sie alle Artikel, deren Beschreibung mit „${initials[v]}“ beginnt.`,
      scenario: "fastfood", topic: "LIKE und Textsuche",
      solution: `SELECT DESCRIPTION FROM F_FOOD_ITEMS WHERE DESCRIPTION LIKE '${initials[v]}%';`,
      requires: ["LIKE"]
    })
  },
  {
    id: "like-contains",
    difficulty: "leicht",
    build: (v) => {
      const letters = ["a", "o", "i", "e", "u"];
      return {
        title: "Text enthält Zeichen",
        prompt: `Finden Sie alle Artikel, deren Beschreibung den Buchstaben „${letters[v]}“ enthält.`,
        scenario: "fastfood", topic: "LIKE und Textsuche",
        solution: `SELECT DESCRIPTION FROM F_FOOD_ITEMS WHERE DESCRIPTION LIKE '%${letters[v]}%';`,
        requires: ["LIKE"]
      };
    }
  },
  {
    id: "like-not-start",
    difficulty: "mittel",
    build: (v) => ({
      title: "Text ausschließen",
      prompt: `Zeigen Sie alle Arzneimittel an, deren Bezeichnung nicht mit „${initials[v]}“ beginnt.`,
      scenario: "medicine", topic: "LIKE und Textsuche",
      solution: `SELECT AMID, BEZEICHNUNG FROM ARZNEIMITTEL WHERE BEZEICHNUNG NOT LIKE '${initials[v]}%';`,
      requires: ["NOT LIKE"]
    })
  },
  {
    id: "aggregate-count",
    difficulty: "leicht",
    build: (v) => {
      const choices = [
        ["Kunden", "F_CUSTOMERS", "fastfood"],
        ["Bestellungen", "F_ORDERS", "fastfood"],
        ["Artikel", "F_FOOD_ITEMS", "fastfood"],
        ["Mitarbeitenden", "F_STAFFS", "fastfood"],
        ["Arzneimittel", "ARZNEIMITTEL", "medicine"]
      ] as const;
      const [label, table, scenario] = choices[v];
      return {
        title: `${label} zählen`,
        prompt: `Wie viele ${label.toLowerCase()} sind gespeichert? Geben Sie die Anzahl mit dem Alias ANZAHL aus.`,
        scenario, topic: "Aggregatfunktionen",
        solution: `SELECT COUNT(*) AS ANZAHL FROM ${table};`,
        requires: ["COUNT"]
      };
    }
  },
  {
    id: "aggregate-average",
    difficulty: "leicht",
    build: (v) => {
      const choices = [
        ["Preis", "PREIS", "ARZNEIMITTEL", "medicine", "AVG", "Durchschnittspreis"],
        ["Preis", "PRICE", "F_FOOD_ITEMS", "fastfood", "MIN", "Niedrigster Artikelpreis"],
        ["Jahresgehalt", "SALARY", "F_STAFFS", "fastfood", "MAX", "Höchstes Jahresgehalt"],
        ["Bestellwert", "ORDER_TOTAL", "F_ORDERS", "fastfood", "AVG", "Durchschnittlicher Bestellwert"],
        ["Wirkstoffmenge", "MENGE", "ARZNEIMITTELWIRKSTOFFE", "medicine", "SUM", "Gesamtmenge der Wirkstoffe"]
      ] as const;
      const [label, column, table, scenario, aggregate, title] = choices[v];
      const functionLabel = aggregate === "MIN" ? "niedrigsten" : aggregate === "MAX" ? "höchsten" : aggregate === "SUM" ? "gesamte" : "durchschnittliche";
      return {
        title,
        prompt: `Zeigen Sie die ${functionLabel} ${label.toLowerCase()} aller Datensätze an.`,
        scenario, topic: "Aggregatfunktionen",
        solution: `SELECT ${aggregate}(${column}) AS ERGEBNIS FROM ${table};`,
        requires: [aggregate]
      };
    }
  },
  {
    id: "aggregate-customer-sum",
    difficulty: "mittel",
    build: (v) => ({
      title: "Bestellsumme pro Kunde",
      prompt: `Zeigen Sie pro Kunde die Kunden-ID und die Summe der Bestellwerte für ${years[v]} an.`,
      scenario: "fastfood", topic: "GROUP BY und SUM",
      solution: `SELECT CUST_ID, SUM(ORDER_TOTAL) AS BESTELLSUMME FROM F_ORDERS WHERE CAST(strftime('%Y', ORDER_DATE) AS INTEGER) = ${years[v]} GROUP BY CUST_ID ORDER BY BESTELLSUMME DESC;`,
      examSolution: `SELECT CUST_ID, SUM(ORDER_TOTAL) AS BESTELLSUMME FROM F_ORDERS WHERE EXTRACT(YEAR FROM ORDER_DATE) = ${years[v]} GROUP BY CUST_ID ORDER BY BESTELLSUMME DESC;`,
      requires: ["SUM", "GROUP BY", "ORDER BY"], ordered: true
    })
  },
  {
    id: "aggregate-ingredient-count",
    difficulty: "mittel",
    build: (v) => ({
      title: "Wirkstoffe pro Arzneimittel",
      prompt: `Zeigen Sie Arzneimittel-ID, Bezeichnung und Anzahl der Wirkstoffe an. Sortieren Sie ${v % 2 ? "aufsteigend" : "absteigend"} nach der Anzahl.`,
      scenario: "medicine", topic: "JOIN und GROUP BY",
      solution: `SELECT a.AMID, a.BEZEICHNUNG, COUNT(aw.WIRKSTOFFID) AS ANZAHLWIRKSTOFFE FROM ARZNEIMITTEL a JOIN ARZNEIMITTELWIRKSTOFFE aw ON a.AMID = aw.AMID GROUP BY a.AMID, a.BEZEICHNUNG ORDER BY COUNT(aw.WIRKSTOFFID) ${v % 2 ? "ASC" : "DESC"};`,
      alternatives: [
        "SELECT a.AMID, a.BEZEICHNUNG, COUNT(aw.WIRKSTOFFID) AS ANZAHLWIRKSTOFFE FROM ARZNEIMITTEL a INNER JOIN ARZNEIMITTELWIRKSTOFFE aw ON a.AMID = aw.AMID GROUP BY a.AMID, a.BEZEICHNUNG ORDER BY ANZAHLWIRKSTOFFE DESC;"
      ],
      requires: ["JOIN", "COUNT", "GROUP BY", "ORDER BY"], ordered: true
    })
  },
  {
    id: "having-ingredient-count",
    difficulty: "mittel",
    build: (v) => ({
      title: "Gruppen mit vielen Wirkstoffen",
      prompt: `Zeigen Sie nur Arzneimittel mit mehr als ${limits[v]} Wirkstoffen. Verwenden Sie HAVING.`,
      scenario: "medicine", topic: "HAVING",
      solution: `SELECT a.AMID, a.BEZEICHNUNG, COUNT(aw.WIRKSTOFFID) AS ANZAHLWIRKSTOFFE FROM ARZNEIMITTEL a JOIN ARZNEIMITTELWIRKSTOFFE aw ON a.AMID = aw.AMID GROUP BY a.AMID, a.BEZEICHNUNG HAVING COUNT(aw.WIRKSTOFFID) > ${limits[v]} ORDER BY ANZAHLWIRKSTOFFE DESC;`,
      requires: ["JOIN", "GROUP BY", "HAVING", "COUNT"], ordered: true
    })
  },
  {
    id: "having-order-count",
    difficulty: "mittel",
    build: (v) => ({
      title: "Kunden mit mehreren Bestellungen",
      prompt: `Zeigen Sie Kunden-ID und Bestellanzahl für Kunden mit mehr als ${limits[v]} Bestellungen.`,
      scenario: "fastfood", topic: "HAVING",
      solution: `SELECT CUST_ID, COUNT(*) AS ANZAHL FROM F_ORDERS GROUP BY CUST_ID HAVING COUNT(*) > ${limits[v]} ORDER BY ANZAHL DESC;`,
      requires: ["GROUP BY", "HAVING", "COUNT"], ordered: true
    })
  },
  {
    id: "having-maker-average",
    difficulty: "schwer",
    build: (v) => {
      const threshold = [7, 9, 11, 13, 15][v];
      return {
        title: "Hersteller mit hohem Durchschnittspreis",
        prompt: `Zeigen Sie Hersteller-ID und durchschnittlichen Arzneimittelpreis an. Berücksichtigen Sie nur Gruppen mit einem Durchschnitt über ${threshold} €.`,
        scenario: "medicine", topic: "HAVING",
        solution: `SELECT HERSTELLER_ID, AVG(PREIS) AS DURCHSCHNITT FROM ARZNEIMITTEL GROUP BY HERSTELLER_ID HAVING AVG(PREIS) > ${threshold} ORDER BY DURCHSCHNITT DESC;`,
        requires: ["GROUP BY", "HAVING", "AVG"], ordered: true
      };
    }
  },
  {
    id: "join-left-customers",
    difficulty: "mittel",
    build: (v) => ({
      title: "Alle Kunden und Bestellungen",
      prompt: `Zeigen Sie alle Kundendaten und zusätzlich Bestelldaten an, falls Bestellungen existieren. Sortieren Sie nach Kunden-ID ${v % 2 ? "absteigend" : "aufsteigend"}.`,
      scenario: "fastfood", topic: "JOINs",
      solution: `SELECT c.ID, c.FIRST_NAME, c.LAST_NAME, o.ORDER_NUMBER, o.ORDER_DATE, o.ORDER_TOTAL FROM F_CUSTOMERS c LEFT JOIN F_ORDERS o ON c.ID = o.CUST_ID ORDER BY c.ID ${v % 2 ? "DESC" : "ASC"};`,
      alternatives: [`SELECT c.ID, c.FIRST_NAME, c.LAST_NAME, o.ORDER_NUMBER, o.ORDER_DATE, o.ORDER_TOTAL FROM F_CUSTOMERS c LEFT OUTER JOIN F_ORDERS o ON c.ID = o.CUST_ID ORDER BY c.ID ${v % 2 ? "DESC" : "ASC"};`],
      requires: ["LEFT JOIN", "ORDER BY"], ordered: true,
    })
  },
  {
    id: "join-order-customer",
    difficulty: "leicht",
    build: (v) => {
      const drafts: Draft[] = [
        {
          title: "Bestellungen mit Kundennamen",
          prompt: `Zeigen Sie Bestellnummer, Bestelldatum und Nachnamen der Kunden für das Jahr ${years[v]} an.`,
          scenario: "fastfood", topic: "JOINs: INNER JOIN",
          solution: `SELECT o.ORDER_NUMBER, o.ORDER_DATE, c.LAST_NAME FROM F_ORDERS o JOIN F_CUSTOMERS c ON o.CUST_ID = c.ID WHERE CAST(strftime('%Y', o.ORDER_DATE) AS INTEGER) = ${years[v]} ORDER BY o.ORDER_DATE;`,
          examSolution: `SELECT o.ORDER_NUMBER, o.ORDER_DATE, c.LAST_NAME FROM F_ORDERS o JOIN F_CUSTOMERS c ON o.CUST_ID = c.ID WHERE EXTRACT(YEAR FROM o.ORDER_DATE) = ${years[v]} ORDER BY o.ORDER_DATE;`,
          requires: ["JOIN", "WHERE", "ORDER BY"], ordered: true
        },
        {
          title: "Alle Kunden mit Bestellungen",
          prompt: "Zeigen Sie alle Kunden mit passenden Bestellnummern. Kunden ohne Bestellung sollen ebenfalls erscheinen.",
          scenario: "fastfood", topic: "JOINs: LEFT JOIN",
          solution: "SELECT c.ID, o.ORDER_NUMBER FROM F_CUSTOMERS c LEFT JOIN F_ORDERS o ON c.ID = o.CUST_ID ORDER BY c.ID, o.ORDER_NUMBER;",
          requires: ["LEFT JOIN", "ORDER BY"], ordered: true
        },
        {
          title: "Alle Bestellungen und Kunden",
          prompt: "Zeigen Sie alle Bestellungen und passende Kundendaten. Verwenden Sie RIGHT JOIN.",
          scenario: "fastfood", topic: "JOINs: RIGHT JOIN",
          solution: "SELECT c.ID, o.ORDER_NUMBER FROM F_CUSTOMERS c RIGHT JOIN F_ORDERS o ON c.ID = o.CUST_ID ORDER BY o.ORDER_NUMBER;",
          requires: ["RIGHT JOIN", "ORDER BY"], ordered: true
        },
        {
          title: "Kunden und Bestellungen ohne Partner",
          prompt: "Zeigen Sie alle Kunden und alle Bestellungen, auch wenn keine passende Zuordnung vorhanden ist. Verwenden Sie FULL OUTER JOIN.",
          scenario: "fastfood", topic: "JOINs: FULL OUTER JOIN",
          solution: "SELECT c.ID, o.ORDER_NUMBER FROM F_CUSTOMERS c FULL OUTER JOIN F_ORDERS o ON c.ID = o.CUST_ID ORDER BY c.ID, o.ORDER_NUMBER;",
          requires: ["FULL OUTER JOIN", "ORDER BY"], ordered: true
        },
        {
          title: "Kunden und Schichten kombinieren",
          prompt: "Zeigen Sie jede mögliche Kombination aus Kunden-ID und Schichtbeschreibung an. Verwenden Sie CROSS JOIN.",
          scenario: "fastfood", topic: "JOINs: CROSS JOIN",
          solution: "SELECT c.ID, s.DESCRIPTION FROM F_CUSTOMERS c CROSS JOIN F_SHIFTS s ORDER BY c.ID, s.CODE;",
          requires: ["CROSS JOIN", "ORDER BY"], ordered: true
        }
      ];
      return drafts[v];
    }
  },
  {
    id: "join-staff-orders",
    difficulty: "mittel",
    build: (v) => ({
      title: "Mitarbeitende mit Bestellungen",
      prompt: `Zeigen Sie Mitarbeiter-ID, Nachname und Bestellnummer für Bestellungen mit einem Wert über ${[10, 15, 20, 25, 30][v]} € an.`,
      scenario: "fastfood", topic: "JOINs",
      solution: `SELECT s.ID, s.LAST_NAME, o.ORDER_NUMBER FROM F_STAFFS s JOIN F_ORDERS o ON s.ID = o.STAFF_ID WHERE o.ORDER_TOTAL > ${[10, 15, 20, 25, 30][v]} ORDER BY o.ORDER_NUMBER;`,
      requires: ["JOIN", "WHERE", "ORDER BY"], ordered: true
    })
  },
  {
    id: "join-medicine-ingredients",
    difficulty: "mittel",
    build: (v) => ({
      title: "Arzneimittel und Wirkstoffnamen",
      prompt: `Zeigen Sie Arzneimittelbezeichnung und zugehörige Wirkstoffbezeichnung an. Sortieren Sie nach Arzneimittel-ID ${v % 2 ? "absteigend" : "aufsteigend"}.`,
      scenario: "medicine", topic: "JOINs",
      solution: `SELECT a.BEZEICHNUNG AS ARZNEIMITTEL, w.BEZEICHNUNG AS WIRKSTOFF FROM ARZNEIMITTEL a JOIN ARZNEIMITTELWIRKSTOFFE aw ON a.AMID = aw.AMID JOIN WIRKSTOFFE w ON aw.WIRKSTOFFID = w.WIRKSTOFFID ORDER BY a.AMID ${v % 2 ? "DESC" : "ASC"}, w.WIRKSTOFFID;`,
      requires: ["JOIN", "ORDER BY"], ordered: true
    })
  },
  {
    id: "join-self-manager",
    difficulty: "schwer",
    build: (_v) => ({
      title: "Mitarbeitende und Führungskraft",
      prompt: "Zeigen Sie Nachname der Mitarbeitenden und den Nachnamen der zugeordneten Führungskraft an.",
      scenario: "fastfood", topic: "JOINs: Self Join",
      solution: "SELECT m.LAST_NAME AS MITARBEITER, f.LAST_NAME AS FUEHRUNGSKRAFT FROM F_STAFFS m JOIN F_STAFFS f ON m.MANAGER_ID = f.ID ORDER BY m.LAST_NAME;",
      requires: ["JOIN", "ORDER BY"], ordered: true
    })
  },
  {
    id: "set-union-people",
    difficulty: "mittel",
    build: (v) => {
      const operator = ["UNION", "UNION ALL", "UNION", "UNION ALL", "UNION"][v];
      return {
        title: "Kunden und Mitarbeitende zusammenführen",
        prompt: `Zeigen Sie ID und Nachnamen aller Kunden und Mitarbeitenden mit ${operator} untereinander an.`,
        scenario: "fastfood", topic: "Mengenoperatoren",
        solution: `SELECT ID, LAST_NAME FROM F_CUSTOMERS ${operator} SELECT ID, LAST_NAME FROM F_STAFFS ORDER BY LAST_NAME;`,
        requires: [operator, "ORDER BY"], ordered: true
      };
    }
  },
  {
    id: "set-intersect-except",
    difficulty: "schwer",
    build: (v) => {
      const operator = ["INTERSECT", "EXCEPT", "INTERSECT", "EXCEPT", "INTERSECT"][v];
      return {
        title: "IDs als Ergebnismengen vergleichen",
        prompt: `Führen Sie die IDs der Kunden und Mitarbeitenden mit ${operator} zusammen.`,
        scenario: "fastfood", topic: "Mengenoperatoren",
        solution: `SELECT ID FROM F_CUSTOMERS ${operator} SELECT ID FROM F_STAFFS ORDER BY ID;`,
        requires: [operator, "ORDER BY"], ordered: true
      };
    }
  },
  {
    id: "subquery-above-average",
    difficulty: "schwer",
    build: (v) => ({
      title: "Arzneimittel über dem Durchschnitt",
      prompt: `Zeigen Sie Arzneimittel an, deren Preis ${v % 2 ? "unter" : "über"} dem Durchschnittspreis liegt. Sortieren Sie ${v % 2 ? "aufsteigend" : "absteigend"}.`,
      scenario: "medicine", topic: "Unterabfragen",
      solution: `SELECT AMID, BEZEICHNUNG, PREIS FROM ARZNEIMITTEL WHERE PREIS ${v % 2 ? "<" : ">"} (SELECT AVG(PREIS) FROM ARZNEIMITTEL) ORDER BY PREIS ${v % 2 ? "ASC" : "DESC"};`,
      alternatives: [`SELECT a.AMID, a.BEZEICHNUNG, a.PREIS FROM ARZNEIMITTEL a WHERE a.PREIS ${v % 2 ? "<" : ">"} (SELECT AVG(b.PREIS) FROM ARZNEIMITTEL b) ORDER BY a.PREIS ${v % 2 ? "ASC" : "DESC"};`],
      requires: ["SUBQUERY", "AVG", "ORDER BY"], ordered: true
    })
  },
  {
    id: "subquery-no-orders",
    difficulty: "schwer",
    build: (_v) => ({
      title: "Kunden ohne Bestellung",
      prompt: "Finden Sie alle Kunden, für die keine Bestellung existiert.",
      scenario: "fastfood", topic: "Unterabfragen",
      solution: "SELECT c.ID, c.LAST_NAME FROM F_CUSTOMERS c WHERE NOT EXISTS (SELECT 1 FROM F_ORDERS o WHERE o.CUST_ID = c.ID) ORDER BY c.ID;",
      alternatives: ["SELECT c.ID, c.LAST_NAME FROM F_CUSTOMERS c LEFT JOIN F_ORDERS o ON o.CUST_ID = c.ID WHERE o.ORDER_NUMBER IS NULL ORDER BY c.ID;"],
      requires: ["SUBQUERY", "NOT EXISTS", "ORDER BY"], ordered: true
    })
  },
  {
    id: "subquery-maker-above-average",
    difficulty: "schwer",
    build: (_v) => ({
      title: "Hersteller über dem Preis-Durchschnitt",
      prompt: "Zeigen Sie alle Hersteller, die mindestens ein Arzneimittel über dem Durchschnittspreis anbieten.",
      scenario: "medicine", topic: "Unterabfragen und JOIN",
      solution: "SELECT DISTINCT h.HERSTELLER_ID, h.NAME FROM HERSTELLER h JOIN ARZNEIMITTEL a ON h.HERSTELLER_ID = a.HERSTELLER_ID WHERE a.PREIS > (SELECT AVG(PREIS) FROM ARZNEIMITTEL) ORDER BY h.HERSTELLER_ID;",
      requires: ["SUBQUERY", "JOIN", "AVG", "ORDER BY"], ordered: true
    })
  },
  {
    id: "mixed-order-check",
    difficulty: "schwer",
    build: (v) => {
      const drafts: Draft[] = [
        {
          title: "Gespeicherte und berechnete Summe",
          prompt: "Berechnen Sie je Bestellung die Summe aus Menge mal Artikelpreis. Zeigen Sie nur Bestellungen, deren gespeicherte Summe um mehr als 0,01 € abweicht.",
          scenario: "fastfood", topic: "Prüfungsaufgaben: JOIN und HAVING",
          solution: "SELECT o.ORDER_NUMBER, SUM(ol.QUANTITY * f.PRICE) AS VERGLEICHSBESTELLSUMME, o.ORDER_TOTAL FROM F_ORDERS o JOIN F_ORDER_LINES ol ON o.ORDER_NUMBER = ol.ORDER_NUMBER JOIN F_FOOD_ITEMS f ON ol.FOOD_ITEM_NUMBER = f.FOOD_ITEM_NUMBER GROUP BY o.ORDER_NUMBER, o.ORDER_TOTAL HAVING ABS(SUM(ol.QUANTITY * f.PRICE) - o.ORDER_TOTAL) > 0.01 ORDER BY o.ORDER_NUMBER;",
          requires: ["JOIN", "GROUP BY", "HAVING", "SUM", "ORDER BY"], ordered: true
        },
        {
          title: "Jahressumme pro Kunde",
          prompt: `Zeigen Sie pro Kunde ID, Nachname und Bestellsumme für das Jahr ${years[v]} an. Sortieren Sie nach Summe absteigend.`,
          scenario: "fastfood", topic: "Prüfungsaufgaben: JOIN und SUM",
          solution: `SELECT c.ID, c.LAST_NAME, SUM(o.ORDER_TOTAL) AS BESTELLSUMME FROM F_CUSTOMERS c JOIN F_ORDERS o ON c.ID = o.CUST_ID WHERE CAST(strftime('%Y', o.ORDER_DATE) AS INTEGER) = ${years[v]} GROUP BY c.ID, c.LAST_NAME ORDER BY BESTELLSUMME DESC;`,
          examSolution: `SELECT c.ID, c.LAST_NAME, SUM(o.ORDER_TOTAL) AS BESTELLSUMME FROM F_CUSTOMERS c JOIN F_ORDERS o ON c.ID = o.CUST_ID WHERE EXTRACT(YEAR FROM o.ORDER_DATE) = ${years[v]} GROUP BY c.ID, c.LAST_NAME ORDER BY BESTELLSUMME DESC;`,
          requires: ["JOIN", "SUM", "GROUP BY", "ORDER BY"], ordered: true
        },
        {
          title: "Arzneimittel mit vielen Wirkstoffen",
          prompt: `Zeigen Sie Arzneimittelbezeichnung und Wirkstoffanzahl für Arzneimittel mit mindestens ${[2, 3, 4, 2, 3][v]} Wirkstoffen.`,
          scenario: "medicine", topic: "Prüfungsaufgaben: JOIN und HAVING",
          solution: `SELECT a.BEZEICHNUNG, COUNT(aw.WIRKSTOFFID) AS ANZAHL FROM ARZNEIMITTEL a JOIN ARZNEIMITTELWIRKSTOFFE aw ON a.AMID = aw.AMID GROUP BY a.AMID, a.BEZEICHNUNG HAVING COUNT(aw.WIRKSTOFFID) >= ${[2, 3, 4, 2, 3][v]} ORDER BY ANZAHL DESC;`,
          requires: ["JOIN", "COUNT", "GROUP BY", "HAVING", "ORDER BY"], ordered: true
        },
        {
          title: "Namen zweier Tabellen sortieren",
          prompt: "Führen Sie die Nachnamen von Kunden und Mitarbeitenden untereinander zusammen und sortieren Sie aufsteigend.",
          scenario: "fastfood", topic: "Prüfungsaufgaben: UNION",
          solution: "SELECT LAST_NAME FROM F_CUSTOMERS UNION SELECT LAST_NAME FROM F_STAFFS ORDER BY LAST_NAME ASC;",
          requires: ["UNION", "ORDER BY"], ordered: true
        },
        {
          title: "Anzahl Wirkstoffe je Hersteller",
          prompt: `Zeigen Sie Herstellername und Anzahl zugeordneter Arzneimittel an. Berücksichtigen Sie Gruppen mit mindestens ${[2, 3, 4, 2, 3][v]} Arzneimitteln.`,
          scenario: "medicine", topic: "Prüfungsaufgaben: JOIN und GROUP BY",
          solution: `SELECT h.NAME, COUNT(a.AMID) AS ANZAHL FROM HERSTELLER h JOIN ARZNEIMITTEL a ON h.HERSTELLER_ID = a.HERSTELLER_ID GROUP BY h.HERSTELLER_ID, h.NAME HAVING COUNT(a.AMID) >= ${[2, 3, 4, 2, 3][v]} ORDER BY ANZAHL DESC;`,
          requires: ["JOIN", "COUNT", "GROUP BY", "HAVING", "ORDER BY"], ordered: true
        }
      ];
      return drafts[v];
    }
  }
];

export function makeTask(templateId: string, variant: number): Task {
  const template = templates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unbekannte Aufgabenvorlage: ${templateId}`);
  const index = ((variant % 5) + 5) % 5;
  const draft = template.build(index);
  return {
    id: `${template.id}-${index + 1}`,
    templateId,
    variant: index,
    title: draft.title,
    prompt: draft.prompt,
    difficulty: template.difficulty,
    topic: draft.topic,
    scenario: draft.scenario,
    solution: draft.solution,
    examSolution: draft.examSolution ?? draft.solution,
    alternatives: draft.alternatives ?? [],
    explanation: [
      "Lies Signalwörter wie „pro“, „mehr als“ oder „falls vorhanden“ und markiere sie.",
      "Ordne jede Information einer SQL-Klausel zu: SELECT, FROM, WHERE, GROUP BY, HAVING oder ORDER BY.",
      "Prüfe Spaltennamen und Verknüpfungen im Schema, bevor du die Abfrage ausführst."
    ],
    examTip: template.id.startsWith("having")
      ? "„Mehr als“ bedeutet >. HAVING filtert Gruppen, WHERE filtert einzelne Zeilen."
      : template.id.startsWith("set-")
        ? "UNION setzt Zeilen untereinander. JOIN verbindet Spalten nebeneinander."
        : "Schreibe die SQL-Klauseln in der Reihenfolge SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY.",
    keywords: draft.requires ?? [],
    hints: [
      `Thema: ${draft.topic}. Welche Tabelle enthält die benötigten Daten?`,
      "Lege zuerst fest, welche Spalten im Ergebnis stehen sollen.",
      `Signalwörter: ${(draft.requires ?? []).join(", ") || "SELECT und FROM"}. Prüfe danach Sortierung und Gruppierung.`
    ],
    commonMistakes: [
      "Spaltenname oder Fremdschlüssel falsch geschrieben.",
      "WHERE für eine Gruppenbedingung statt HAVING verwendet.",
      "JOIN-Bedingung fehlt oder verbindet falsche Spalten."
    ],
    points: template.difficulty === "leicht" ? 2 : template.difficulty === "mittel" ? 3 : 5,
    requires: draft.requires ?? [],
    ordered: draft.ordered ?? false
  };
}

export const TASKS: Task[] = templates.flatMap((template) =>
  Array.from({ length: 5 }, (_, variant) => makeTask(template.id, variant))
);

export function createVariant(task: Task): Task {
  return makeTask(task.templateId, task.variant + 1);
}

export const TASK_COUNTS = {
  selectWhere: TASKS.filter((task) => task.templateId.startsWith("select-")).length,
  like: TASKS.filter((task) => task.templateId.startsWith("like-")).length,
  aggregates: TASKS.filter((task) => task.templateId.startsWith("aggregate-")).length,
  having: TASKS.filter((task) => task.templateId.startsWith("having-")).length,
  joins: TASKS.filter((task) => task.templateId.startsWith("join-")).length,
  setOperators: TASKS.filter((task) => task.templateId.startsWith("set-")).length,
  subqueries: TASKS.filter((task) => task.templateId.startsWith("subquery-")).length,
  mixed: TASKS.filter((task) => task.templateId.startsWith("mixed-")).length,
  total: TASKS.length
} as const;
