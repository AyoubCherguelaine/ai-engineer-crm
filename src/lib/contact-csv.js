export const MAX_CONTACT_CSV_SIZE = 2 * 1024 * 1024;
export const MAX_CONTACT_CSV_ROWS = 2000;

// Quoted fields may contain separators, escaped quotes, and newlines.
export function readCsv(source) {
  const rows = [];
  let fields = [];
  let value = "";
  let state = "open";
  let line = 1;
  let rowLine = 1;
  function endField() {
    fields.push(value);
    value = "";
    state = "open";
  }
  function endRow() {
    endField();
    if (fields.some((field) => field.trim()))
      rows.push({ line: rowLine, fields });
    if (rows.length > MAX_CONTACT_CSV_ROWS + 1)
      throw new Error(
        `Choose a CSV with at most ${MAX_CONTACT_CSV_ROWS} data rows.`,
      );
    fields = [];
  }
  const csv = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (state === "quoted") {
      if (char === '"' && csv[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') state = "closed";
      else value += char;
      if (char === "\n") line++;
      continue;
    }
    if (char === ",") endField();
    else if (char === "\n") {
      endRow();
      rowLine = ++line;
    } else if (char === '"' && state === "open" && !value) state = "quoted";
    else if (state === "closed" || char === '"')
      throw new Error(
        `Unexpected character after or inside a quoted field on line ${line}.`,
      );
    else value += char;
  }
  if (state === "quoted") throw new Error(`Unclosed quote on line ${rowLine}.`);
  endRow();
  return rows;
}
