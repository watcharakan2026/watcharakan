/**
 * CDC 2026 Fire Safety - Google Sheets & Google Drive Backend Bridge
 * วิธีติดตั้ง (ฟรี 100% ใช้ได้ทั้งสร้างจาก Google Sheet โดยตรง และสร้างจาก script.google.com):
 * 1. เปิด Google Sheet -> ส่วนขยาย (Extensions) -> Apps Script (หรือสร้างใหม่ที่ script.google.com)
 * 2. วางโค้ดนี้ลงไปทั้งหมด แล้วกด Save
 * 3. กด Deploy -> New deployment (หรือ Manage deployments -> New version) -> Type: Web app
 *    - Execute as: Me (บัญชีเจ้าของ Sheet)
 *    - Who has access: Anyone (ระบบหลังบ้าน Node.js จะเป็นผู้เรียกใช้งาน)
 * 4. คัดลอก Web App URL ไปใส่ใน Environment Variable: GOOGLE_APPS_SCRIPT_URL
 *    * หมายเหตุ: หากสร้างแบบ Standalone (นอก Google Sheet) โค้ดนี้จะสร้างไฟล์ "CDC_Fire_Safety_2026_DB"
 *      ในโฟลเดอร์ "CDC Fire Safety 2026 Database" บน Google Drive ให้อัตโนมัติ ไม่เกิด error null อีก
 */

const DRIVE_FOLDER_NAME = 'CDC Fire Safety 2026 Database';
const PHOTOS_FOLDER_NAME = 'Inspection_Photos';
const DEFAULT_SHEET_NAME = 'CDC_Fire_Safety_2026_DB';

function getOrCreateFolder_(name, parentFolder) {
  const parent = parentFolder || DriveApp.getRootFolder();
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function getTargetSpreadsheet_(requestedSpreadsheetId) {
  // 1. ถ้าระบุ Spreadsheet ID มาโดยตรง ให้เปิดใช้งานทันที
  if (requestedSpreadsheetId) {
    return SpreadsheetApp.openById(requestedSpreadsheetId);
  }

  // 2. ถ้าเปิด Apps Script จากเมนู ส่วนขยาย (Extensions) ใน Google Sheet อยู่แล้ว
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  // 3. กรณี Standalone Script (สร้างที่ script.google.com โดยไม่ได้ผูกกับ Sheet):
  //    ตรวจสอบจาก ScriptProperties หรือค้นหา/สร้างไฟล์ใน Google Drive อัตโนมัติ
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {
      // ถูกลบหรือเปิดไม่ได้ ให้ค้นหา/สร้างใหม่ด้านล่าง
    }
  }

  const mainFolder = getOrCreateFolder_(DRIVE_FOLDER_NAME);
  const existingFiles = mainFolder.getFilesByName(DEFAULT_SHEET_NAME);
  while (existingFiles.hasNext()) {
    const file = existingFiles.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS && !file.isTrashed()) {
      props.setProperty('SPREADSHEET_ID', file.getId());
      return SpreadsheetApp.openById(file.getId());
    }
  }

  // สร้าง Google Sheet ใหม่ให้อัตโนมัติและย้ายเข้าโฟลเดอร์ฐานข้อมูล
  const created = SpreadsheetApp.create(DEFAULT_SHEET_NAME);
  const createdFile = DriveApp.getFileById(created.getId());
  createdFile.moveTo(mainFolder);
  props.setProperty('SPREADSHEET_ID', created.getId());
  return created;
}

function getOrCreateSheet_(ss, tabName, headers) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    if (headers && headers.length > 0) {
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setNumberFormat('@');
      headerRange.setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || 'readAll';

    if (action === 'getPhoto') {
      const fileId = params.fileId;
      if (!fileId) return jsonOut_({ success: false, error: 'Missing fileId' });
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      return jsonOut_({
        success: true,
        contentType: blob.getContentType(),
        base64: Utilities.base64Encode(blob.getBytes()),
      });
    }

    const ss = getTargetSpreadsheet_(params.spreadsheetId);
    const result = {};
    ['Equipment', 'Inspections', 'CorrectiveActions', 'Users'].forEach(function (tabName) {
      const sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        result[tabName] = [];
      } else {
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        result[tabName] = lastRow > 0 && lastCol > 0 ? sheet.getRange(1, 1, lastRow, lastCol).getValues() : [];
      }
    });

    return jsonOut_({
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      data: result,
    });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = payload.action;

    if (action === 'uploadPhoto') {
      const mainFolder = getOrCreateFolder_(DRIVE_FOLDER_NAME);
      const photosFolder = getOrCreateFolder_(PHOTOS_FOLDER_NAME, mainFolder);
      const bytes = Utilities.base64Decode(payload.base64);
      const blob = Utilities.newBlob(bytes, payload.mimeType || 'image/jpeg', payload.filename || 'photo.jpg');
      const file = photosFolder.createFile(blob);
      return jsonOut_({
        success: true,
        fileId: file.getId(),
        webViewLink: file.getUrl(),
        driveRef: 'drive://' + file.getId(),
      });
    }

    const ss = getTargetSpreadsheet_(payload.spreadsheetId);

    if (action === 'writeTab') {
      const tabName = payload.tabName;
      const headers = payload.headers || [];
      const rows = payload.rows || [];
      const sheet = getOrCreateSheet_(ss, tabName, headers);
      sheet.clearContents();
      const allValues = [headers].concat(rows);
      if (allValues.length > 0 && headers.length > 0) {
        const range = sheet.getRange(1, 1, allValues.length, headers.length);
        range.setNumberFormat('@');
        range.setValues(allValues);
      }
      sheet.setFrozenRows(1);
      return jsonOut_({ success: true, tabName: tabName, count: rows.length, spreadsheetId: ss.getId() });
    }

    if (action === 'writeAll') {
      const tabs = payload.tabs || {};
      Object.keys(tabs).forEach(function (tabName) {
        const info = tabs[tabName];
        const headers = info.headers || [];
        const rows = info.rows || [];
        const sheet = getOrCreateSheet_(ss, tabName, headers);
        sheet.clearContents();
        const allValues = [headers].concat(rows);
        if (allValues.length > 0 && headers.length > 0) {
          const range = sheet.getRange(1, 1, allValues.length, headers.length);
          range.setNumberFormat('@');
          range.setValues(allValues);
        }
        sheet.setFrozenRows(1);
      });
      return jsonOut_({ success: true, spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() });
    }

    return jsonOut_({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}
