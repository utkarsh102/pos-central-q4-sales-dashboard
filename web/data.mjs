export const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1_zbz4DhExyHoXwX-1BzoJm-gKR-3P7wll64p-DxHhyw/export?format=csv&gid=0";

const SECTIONS = {
  combined: { firstRow: 12, headerRow: 1, label: "ANZ total", currency: "AUD" },
  australia: { firstRow: 32, headerRow: 20, label: "Australia", currency: "AUD" },
  newZealand: { firstRow: 50, headerRow: 38, label: "New Zealand", currency: "NZD" },
};

const PEOPLE = {
  ankit: { name: "Ankit Arora", firstColumn: 5 },
  tripti: { name: "Tripti Mandal", firstColumn: 9 },
};

const MONTHS = ["October", "November", "December"];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("The Google Sheet returned incomplete CSV data.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function money(value, cell, allowBlank = false) {
  const raw = String(value ?? "").trim();
  if (raw === "" || raw === "$-" || raw === "-") {
    if (raw === "" && !allowBlank) throw new Error(`${cell} is blank.`);
    return 0;
  }
  const normalized = raw.replace(/[$,\s]/g, "");
  const negative = /^\((\d+(?:\.\d+)?)\)$/.exec(normalized);
  const numeric = negative ? -Number(negative[1]) : Number(normalized);
  if (!Number.isFinite(numeric) || (!negative && !/^-?\d+(?:\.\d+)?$/.test(normalized))) {
    throw new Error(`${cell} is not a valid amount.`);
  }
  return numeric;
}

function roundCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function total(months, field) {
  return roundCents(months.reduce((sum, month) => sum + month[field], 0));
}

export function dashboardFromCsv(csvText) {
  const rows = parseCsv(csvText);
  const sections = {};

  for (const [sectionKey, section] of Object.entries(SECTIONS)) {
    const header = rows[section.headerRow - 1] || [];
    if (header[5]?.trim() !== PEOPLE.ankit.name || header[9]?.trim() !== PEOPLE.tripti.name) {
      throw new Error(`The ${section.label} table columns have changed.`);
    }

    const people = {};
    for (const [personKey, person] of Object.entries(PEOPLE)) {
      const months = MONTHS.map((month, offset) => {
        const rowNumber = section.firstRow + offset;
        const row = rows[rowNumber - 1] || [];
        if (row[0]?.trim() !== `${month.slice(0, 3)}-26`) {
          throw new Error(`Expected ${month} 2026 in row ${rowNumber}.`);
        }
        const column = person.firstColumn;
        const target = money(row[column], `${person.name} target, row ${rowNumber}`);
        const actual = money(row[column + 1], `${person.name} actual, row ${rowNumber}`, true);
        const payment = money(row[column + 2], `${person.name} payment, row ${rowNumber}`, true);
        const refund = money(row[column + 3], `${person.name} refund, row ${rowNumber}`, true);
        if (Math.abs(actual - (payment - refund)) > 0.02) {
          throw new Error(`${person.name} actual does not equal payment minus refund in row ${rowNumber}.`);
        }
        return {
          month,
          monthKey: `2026-${String(10 + offset).padStart(2, "0")}`,
          target,
          actual,
          payment,
          refund,
        };
      });
      people[personKey] = {
        name: person.name,
        months,
        q4Target: total(months, "target"),
        q4Actual: total(months, "actual"),
        q4Payment: total(months, "payment"),
        q4Refund: total(months, "refund"),
      };
    }
    sections[sectionKey] = { label: section.label, currency: section.currency, people };
  }

  return { quarter: "Q4 2026", source: "Google Sheet", sections };
}
