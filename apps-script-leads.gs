/**
 * Smile Genius — lead capture for the "Take the room home" form.
 *
 * SETUP
 * 1. Create a Google Sheet. Add a tab named "Leads".
 *    Put these headers in row 1:  Timestamp | Name | Email | Consent | Source
 * 2. In that Sheet: Extensions → Apps Script. Paste this whole file in.
 * 3. Replace SHEET_ID below with the id from your Sheet's URL
 *    (https://docs.google.com/spreadsheets/d/THIS_PART/edit).
 *    (You can leave it blank to use the Sheet this script is bound to.)
 * 4. Deploy → New deployment → type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Copy the Web app URL → paste it into SHEET_ENDPOINT in the HTML form.
 * 5. Re-deploy (New deployment) any time you change this code.
 */

var SHEET_ID = "1Lk0-wyeXD6GElYej4SDuHb09_X5Cthd--DIIHrXuy9o";

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];                 // writes to the first/visible tab

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Lab", "Email", "Consent", "Source"]);
    }

    var p = (e && e.parameter) ? e.parameter : {};
    sheet.appendRow([
      new Date(),
      p.name || "",
      p.lab || "",
      p.email || "",
      p.consent === "true" ? "Yes" : "No",
      p.source || ""
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the deployment URL in a browser to confirm it's live.
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ result: "ok", message: "Lead endpoint is live." }))
    .setMimeType(ContentService.MimeType.JSON);
}
