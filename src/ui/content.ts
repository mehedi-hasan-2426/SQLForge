export const MEMORY_RULES = [
  { term: "SELECT", rule: "SELECT sagt, was angezeigt wird.", example: "SELECT LAST_NAME", signal: "„Zeigen Sie … an“", mistake: "SELECT und angezeigte Spalten vergessen." },
  { term: "FROM", rule: "FROM sagt, aus welcher Tabelle die Daten kommen.", example: "FROM F_CUSTOMERS", signal: "„Kunden“, „Bestellungen“, „Arzneimittel“", mistake: "Tabelle falsch geschrieben." },
  { term: "WHERE", rule: "WHERE filtert einzelne Zeilen vor der Gruppierung.", example: "WHERE CITY = 'Berlin'", signal: "„für das Jahr 2020“, „Preis über 10 €“", mistake: "Aggregatbedingungen in WHERE schreiben." },
  { term: "GROUP BY", rule: "Pro Kunde, pro Artikel oder pro Gruppe bedeutet meistens GROUP BY.", example: "GROUP BY CUST_ID", signal: "„pro Kunde“, „je Hersteller“", mistake: "Angezeigte Spalten ohne Aggregat nicht gruppieren." },
  { term: "HAVING", rule: "HAVING filtert Gruppen nach COUNT, SUM oder AVG.", example: "HAVING COUNT(*) > 3", signal: "„mehr als drei Bestellungen“", mistake: "Mehr als drei heißt > 3, nicht >= 3." },
  { term: "COUNT", rule: "„Wie viele“ bedeutet COUNT.", example: "COUNT(*)", signal: "„Wie viele Kunden?“", mistake: "COUNT nur für Gruppen verwenden, obwohl Gesamtzahl gefragt ist." },
  { term: "SUM", rule: "„Gesamtsumme“ oder „Summe“ bedeutet SUM.", example: "SUM(ORDER_TOTAL)", signal: "„Summe pro Kunde“", mistake: "SUM ohne GROUP BY bei „pro Kunde“." },
  { term: "AVG", rule: "„Durchschnitt“ oder „durchschnittlich“ bedeutet AVG.", example: "AVG(PREIS)", signal: "„durchschnittlicher Preis“", mistake: "AVG mit SUM verwechseln." },
  { term: "LIKE", rule: "Beginnt mit R bedeutet LIKE 'R%'. Endet mit R bedeutet LIKE '%R'. Enthält R bedeutet LIKE '%R%'.", example: "WHERE DESCRIPTION LIKE 'R%'", signal: "„beginnt mit“, „endet mit“, „enthält“", mistake: "Prozentzeichen an falscher Stelle." },
  { term: "INNER JOIN", rule: "Nur passende Datensätze aus beiden Tabellen.", example: "FROM F_ORDERS o JOIN F_CUSTOMERS c ON o.CUST_ID = c.ID", signal: "„passende Bestellungen“", mistake: "Verknüpfungsspalten vertauschen." },
  { term: "LEFT JOIN", rule: "Alle aus der linken Tabelle, passende Daten rechts falls vorhanden.", example: "FROM F_CUSTOMERS c LEFT JOIN F_ORDERS o ON c.ID = o.CUST_ID", signal: "„alle Kunden, falls Bestellungen existieren“", mistake: "INNER JOIN blendet Kunden ohne Bestellung aus." },
  { term: "RIGHT JOIN", rule: "Alle Datensätze aus der rechten Tabelle, passende Daten links falls vorhanden.", example: "FROM F_CUSTOMERS c RIGHT JOIN F_ORDERS o ON c.ID = o.CUST_ID", signal: "„alle Datensätze der rechten Tabelle“", mistake: "SQLite unterstützt RIGHT JOIN erst in neueren Versionen." },
  { term: "FULL OUTER JOIN", rule: "Alle Datensätze aus beiden Tabellen, auch ohne passenden Partner.", example: "FROM A FULL OUTER JOIN B ON A.ID = B.ID", signal: "„alle aus beiden Tabellen“", mistake: "Nur passende Datensätze mit INNER JOIN behalten." },
  { term: "CROSS JOIN", rule: "Jeder Datensatz aus A wird mit jedem Datensatz aus B kombiniert.", example: "FROM F_CUSTOMERS CROSS JOIN F_SHIFTS", signal: "„jede Kombination“", mistake: "Ein CROSS JOIN kann sehr viele Zeilen erzeugen." },
  { term: "UNION", rule: "UNION setzt Ergebnisse untereinander.", example: "SELECT LAST_NAME FROM F_CUSTOMERS UNION SELECT LAST_NAME FROM F_STAFFS", signal: "„Mitarbeitende und Kunden in einer Abfrage“", mistake: "JOIN verbindet Spalten nebeneinander; UNION Zeilen untereinander." },
  { term: "Unterabfrage", rule: "Wenn das Filterkriterium zuerst berechnet werden muss, brauche ich oft eine Unterabfrage.", example: "WHERE PREIS > (SELECT AVG(PREIS) FROM ARZNEIMITTEL)", signal: "„teurer als der Durchschnitt“", mistake: "Klammern oder zweite SELECT-Abfrage vergessen." },
  { term: "ORDER BY", rule: "ASC bedeutet aufsteigend, DESC bedeutet absteigend.", example: "ORDER BY PREIS DESC", signal: "„sortieren Sie absteigend“", mistake: "DESC bei aufsteigender Sortierung verwenden." },
  { term: "NULL", rule: "NULL wird mit IS NULL und nicht mit = NULL geprüft.", example: "WHERE PROMO_CODE IS NULL", signal: "„ohne Zuordnung“, „keine Bestellung“", mistake: "NULL mit Gleichheitszeichen vergleichen." },
  { term: "SQL-Reihenfolge", rule: "Auswählen, Tabelle, Verbinden, Zeilen filtern, Gruppieren, Gruppen filtern, Sortieren.", example: "SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY", signal: "Klauseln in fester Reihenfolge", mistake: "HAVING vor GROUP BY schreiben." }
];

export const ERROR_TASKS = [
  {
    title: "FROM falsch geschrieben",
    scenario: "fastfood" as const,
    prompt: "Finde den Schreibfehler und zeige danach alle Kunden an.",
    broken: "SELECT *\nFORM F_CUSTOMERS;",
    solution: "SELECT * FROM F_CUSTOMERS;",
    expected: "SELECT * FROM F_CUSTOMERS;",
    expectedWords: ["FROM"],
    explanation: "FORM ist kein SQL-Schlüsselwort. Die Tabelle wird mit FROM angegeben."
  },
  {
    title: "LIKE-Muster vertauscht",
    scenario: "fastfood" as const,
    prompt: "Die Abfrage findet Beschreibungen, die mit R enden. Gesucht sind Artikel, die mit R beginnen.",
    broken: "SELECT * FROM F_FOOD_ITEMS WHERE DESCRIPTION LIKE '%R';",
    solution: "SELECT * FROM F_FOOD_ITEMS WHERE DESCRIPTION LIKE 'R%';",
    expected: "SELECT * FROM F_FOOD_ITEMS WHERE DESCRIPTION LIKE 'R%';",
    expectedWords: ["LIKE", "R%"],
    explanation: "Das Prozentzeichen vor R bedeutet beliebiger Text davor. Für „beginnt mit R“ steht % hinter dem R."
  },
  {
    title: "Fremdschlüssel finden",
    scenario: "fastfood" as const,
    prompt: "Verbinde Kunden mit Bestellungen. Der Fremdschlüssel heißt CUST_ID.",
    broken: "SELECT c.ID, o.ORDER_NUMBER FROM F_CUSTOMERS c JOIN F_ORDERS o ON c.ID = o.CustomerID;",
    solution: "SELECT c.ID, o.ORDER_NUMBER FROM F_CUSTOMERS c JOIN F_ORDERS o ON c.ID = o.CUST_ID;",
    expected: "SELECT c.ID, o.ORDER_NUMBER FROM F_CUSTOMERS c JOIN F_ORDERS o ON c.ID = o.CUST_ID;",
    expectedWords: ["CUST_ID"],
    explanation: "CustomerID existiert nicht im Schema. F_ORDERS.CUST_ID verweist auf F_CUSTOMERS.ID."
  },
  {
    title: "WHERE oder HAVING?",
    scenario: "fastfood" as const,
    prompt: "Zeige Kunden mit mehr als drei Bestellungen. COUNT ist ein Gruppenwert.",
    broken: "SELECT CUST_ID, COUNT(*) FROM F_ORDERS WHERE COUNT(*) > 3 GROUP BY CUST_ID;",
    solution: "SELECT CUST_ID, COUNT(*) FROM F_ORDERS GROUP BY CUST_ID HAVING COUNT(*) > 3;",
    expected: "SELECT CUST_ID, COUNT(*) FROM F_ORDERS GROUP BY CUST_ID HAVING COUNT(*) > 3;",
    expectedWords: ["HAVING"],
    explanation: "WHERE läuft vor der Gruppierung. HAVING filtert Gruppen nach ihrer Bestellanzahl."
  },
  {
    title: "Jahr filtern",
    scenario: "fastfood" as const,
    prompt: "Finde Bestellungen aus dem Jahr 2020. ORDER_DATE enthält ein vollständiges Datum.",
    broken: "SELECT ORDER_NUMBER FROM F_ORDERS WHERE ORDER_DATE = '2020';",
    solution: "SELECT ORDER_NUMBER FROM F_ORDERS WHERE CAST(strftime('%Y', ORDER_DATE) AS INTEGER) = 2020;",
    expected: "SELECT ORDER_NUMBER FROM F_ORDERS WHERE CAST(strftime('%Y', ORDER_DATE) AS INTEGER) = 2020;",
    expectedWords: ["STRFTIME", "EXTRACT"],
    explanation: "ORDER_DATE ist zum Beispiel 2020-06-03. Vergleiche das Jahr mit strftime oder verwende in Prüfungen EXTRACT."
  }
];

export const SIGNAL_PHRASES = [
  ["„pro Kunde“", "GROUP BY CUST_ID"],
  ["„mehr als drei“", "HAVING ... > 3"],
  ["„falls Bestellungen existieren“", "LEFT JOIN"],
  ["„beginnt mit R“", "LIKE 'R%'"],
  ["„teurer als der Durchschnitt“", "Unterabfrage mit AVG"],
  ["„nebeneinander“", "JOIN"],
  ["„untereinander“", "UNION"],
  ["„keine Bestellung“", "NOT EXISTS oder LEFT JOIN ... IS NULL"],
  ["„mindestens drei“", ">= 3"],
  ["„höchstens fünf“", "<= 5"]
];
