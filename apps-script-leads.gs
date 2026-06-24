/**
 * Smile Genius — lead capture for the "Take the room home" form.
 *
 * This version is self-correcting:
 *  - It rewrites the header row on every submit, so the columns can never drift
 *    (no need to clear the sheet when you add a field).
 *  - doGet returns a VERSION tag so the deployment can be verified from outside.
 *
 * DEPLOY (do this once after pasting):
 *   Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone
 *   -> Deploy -> copy the /exec URL into the form's SHEET_ENDPOINT.
 *   (Editing this code later requires Deploy -> Manage deployments -> New version.)
 */

var SHEET_ID = "1Lk0-wyeXD6GElYej4SDuHb09_X5Cthd--DIIHrXuy9o";
var COLUMNS  = ["Timestamp", "Name", "Lab", "Email", "Phone", "Consent", "Source"];
var VERSION  = "phone-v3";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];

    // Always keep row 1 as the correct header so data never lands in the wrong column.
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);

    var p = (e && e.parameter) ? e.parameter : {};
    sheet.appendRow([
      new Date(),
      p.name || "",
      p.lab || "",
      p.email || "",
      p.phone || "",
      p.consent === "true" ? "Yes" : "No",
      p.source || ""
    ]);

    return out({ result: "success", version: VERSION });
  } catch (err) {
    return out({ result: "error", error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return out({ result: "ok", version: VERSION, columns: COLUMNS });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
