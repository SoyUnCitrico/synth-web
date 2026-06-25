/**
 * Apps Script Web App que respalda el banco de presets de synth-web en una Google Sheet.
 *
 *   GET  /exec          -> devuelve { format, version, presets: [{ name, state }] }
 *   POST /exec  body:    { key, presets: [{ name, state }] }
 *                        -> valida `key` contra la Script Property PRESETS_KEY y, si coincide,
 *                           REESCRIBE la hoja con el banco recibido. Responde { ok, count }.
 *
 * La hoja guarda una fila por preset: columna A = name, columna B = JSON.stringify(state).
 * Ver presets-sheet/README.md para el despliegue.
 */

var SHEET_NAME = 'Presets';
var FORMAT = 'synth-web-presets';
var VERSION = 1;

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readPresets_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  var values = sheet.getRange(1, 1, lastRow, 2).getValues();
  var presets = [];
  for (var i = 0; i < values.length; i++) {
    var name = values[i][0];
    var stateJson = values[i][1];
    if (!name) continue;
    try {
      presets.push({ name: String(name), state: JSON.parse(stateJson) });
    } catch (e) {
      // Fila corrupta: se ignora.
    }
  }
  return presets;
}

function writePresets_(presets) {
  var sheet = getSheet_();
  sheet.clearContents();
  if (!presets.length) return;
  var rows = presets.map(function (p) {
    return [String(p.name), JSON.stringify(p.state)];
  });
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
}

function doGet() {
  return json_({ format: FORMAT, version: VERSION, presets: readPresets_() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('PRESETS_KEY');
  if (!secret || body.key !== secret) {
    return json_({ ok: false, error: 'unauthorized' });
  }
  var presets = Array.isArray(body.presets) ? body.presets : [];
  writePresets_(presets);
  return json_({ ok: true, count: presets.length });
}
