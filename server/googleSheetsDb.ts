import { Equipment, InspectionRecord, CorrectiveAction, User } from '../src/types/index.ts';

export interface WorkspaceDatabaseState {
  equipment: Equipment[];
  inspections: InspectionRecord[];
  correctiveActions: CorrectiveAction[];
  users: User[];
  lastUpdated: string;
}

const TAB_EQUIPMENT = 'Equipment';
const TAB_INSPECTIONS = 'Inspections';
const TAB_ACTIONS = 'CorrectiveActions';
const TAB_USERS = 'Users';

const EQUIPMENT_HEADERS = [
  'id',
  'type',
  'subType',
  'zoneId',
  'zoneName',
  'pageNumber',
  'xPercent',
  'yPercent',
  'status',
  'lastInspectedAt',
  'lastInspectorName',
  'lastResult',
  'activeDefectId',
  'capacity',
  'expiryDate',
  'nextMaintenanceDate',
];

const INSPECTION_HEADERS = [
  'id',
  'equipmentId',
  'equipmentType',
  'zoneId',
  'zoneName',
  'inspectorName',
  'inspectorRole',
  'inspectorEmployeeId',
  'inspectedAt',
  'cycle',
  'overallResult',
  'defectDetails',
  'photoUrl',
  'notes',
  'checklistJson',
];

const ACTION_HEADERS = [
  'id',
  'equipmentId',
  'inspectionId',
  'zoneId',
  'zoneName',
  'defectDetails',
  'photoEvidence',
  'reportedBy',
  'reportedAt',
  'assignedTo',
  'dueDate',
  'status',
  'resolutionNotes',
  'resolvedPhotoUrl',
  'resolvedBy',
  'verifiedBy',
  'verifiedAt',
];

const USER_HEADERS = [
  'id',
  'username',
  'name',
  'role',
  'roleNameTh',
  'employeeId',
  'avatarUrl',
];

export type BackendDbMode = 'apps_script' | 'local_json';

export function getAppsScriptUrl(): string | null {
  const raw = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  if (!raw) return null;
  const cleaned = raw.replace(/^["']+|["']+$/g, '').trim();
  return cleaned || null;
}

export function getBackendDbMode(): BackendDbMode {
  if (getAppsScriptUrl()) {
    return 'apps_script';
  }
  return 'local_json';
}

// ============================================================================
// Row Serialization / Deserialization
// ============================================================================
function serializeEquipmentRow(e: Equipment): (string | number)[] {
  return [
    e.id,
    e.type,
    e.subType || '',
    e.zoneId,
    e.zoneName || '',
    e.pageNumber ?? 1,
    e.xPercent ?? 50,
    e.yPercent ?? 50,
    e.status || 'PENDING',
    e.lastInspectedAt || '',
    e.lastInspectorName || '',
    e.lastResult || '',
    e.activeDefectId || '',
    e.capacity || '',
    e.expiryDate || '',
    e.nextMaintenanceDate || '',
  ];
}

function parseEquipmentRow(row: any[]): Equipment | null {
  if (!row || !row[0]) return null;
  return {
    id: String(row[0]),
    type: row[1] === 'fire_hose_cabinet' ? 'fire_hose_cabinet' : 'fire_extinguisher',
    subType: String(row[2] || 'Dry Chemical'),
    zoneId: String(row[3] || ''),
    zoneName: String(row[4] || ''),
    pageNumber: Number(row[5]) || 1,
    xPercent: Number(row[6]) || 50,
    yPercent: Number(row[7]) || 50,
    status: (row[8] as Equipment['status']) || 'PENDING',
    lastInspectedAt: row[9] ? String(row[9]) : null,
    lastInspectorName: row[10] ? String(row[10]) : null,
    lastResult: row[11] === 'PASS' || row[11] === 'FAIL' ? row[11] : null,
    activeDefectId: row[12] ? String(row[12]) : null,
    capacity: row[13] ? String(row[13]) : undefined,
    expiryDate: row[14] ? String(row[14]) : undefined,
    nextMaintenanceDate: row[15] ? String(row[15]) : undefined,
  };
}

function serializeInspectionRow(i: InspectionRecord): string[] {
  return [
    i.id,
    i.equipmentId,
    i.equipmentType,
    i.zoneId,
    i.zoneName,
    i.inspectorName,
    i.inspectorRole,
    i.inspectorEmployeeId,
    i.inspectedAt,
    i.cycle || '',
    i.overallResult,
    i.defectDetails || '',
    i.photoUrl || '',
    i.notes || '',
    JSON.stringify(i.checklist || []),
  ];
}

function parseInspectionRow(row: any[]): InspectionRecord | null {
  if (!row || !row[0]) return null;
  let checklist: any[] = [];
  if (row[14]) {
    try {
      checklist = JSON.parse(String(row[14]));
    } catch {
      checklist = [];
    }
  }
  return {
    id: String(row[0]),
    equipmentId: String(row[1] || ''),
    equipmentType: row[2] === 'fire_hose_cabinet' ? 'fire_hose_cabinet' : 'fire_extinguisher',
    zoneId: String(row[3] || ''),
    zoneName: String(row[4] || ''),
    inspectorName: String(row[5] || ''),
    inspectorRole: (row[6] as InspectionRecord['inspectorRole']) || 'INSPECTOR',
    inspectorEmployeeId: String(row[7] || ''),
    inspectedAt: String(row[8] || ''),
    cycle: row[9] ? String(row[9]) : String(row[8] || '').slice(0, 7),
    overallResult: row[10] === 'FAIL' ? 'FAIL' : 'PASS',
    defectDetails: row[11] ? String(row[11]) : undefined,
    photoUrl: row[12] ? String(row[12]) : undefined,
    notes: row[13] ? String(row[13]) : undefined,
    checklist,
  };
}

function serializeActionRow(a: CorrectiveAction): string[] {
  return [
    a.id,
    a.equipmentId,
    a.inspectionId,
    a.zoneId,
    a.zoneName,
    a.defectDetails,
    a.photoEvidence || '',
    a.reportedBy,
    a.reportedAt,
    a.assignedTo || '',
    a.dueDate || '',
    a.status || 'OPEN',
    a.resolutionNotes || '',
    a.resolvedPhotoUrl || '',
    a.resolvedBy || '',
    a.verifiedBy || '',
    a.verifiedAt || '',
  ];
}

function parseActionRow(row: any[]): CorrectiveAction | null {
  if (!row || !row[0]) return null;
  return {
    id: String(row[0]),
    equipmentId: String(row[1] || ''),
    inspectionId: String(row[2] || ''),
    zoneId: String(row[3] || ''),
    zoneName: String(row[4] || ''),
    defectDetails: String(row[5] || ''),
    photoEvidence: row[6] ? String(row[6]) : undefined,
    reportedBy: String(row[7] || ''),
    reportedAt: String(row[8] || ''),
    assignedTo: String(row[9] || ''),
    dueDate: String(row[10] || ''),
    status: (row[11] as CorrectiveAction['status']) || 'OPEN',
    resolutionNotes: row[12] ? String(row[12]) : undefined,
    resolvedPhotoUrl: row[13] ? String(row[13]) : undefined,
    resolvedBy: row[14] ? String(row[14]) : undefined,
    verifiedBy: row[15] ? String(row[15]) : undefined,
    verifiedAt: row[16] ? String(row[16]) : undefined,
  };
}

function serializeUserRow(u: User): string[] {
  return [
    u.id,
    u.username,
    u.name,
    u.role,
    u.roleNameTh,
    u.employeeId,
    u.avatarUrl || '',
  ];
}

function parseUserRow(row: any[]): User | null {
  if (!row || !row[0]) return null;
  return {
    id: String(row[0]),
    username: String(row[1] || ''),
    name: String(row[2] || ''),
    role: (row[3] as User['role']) || 'VISITOR',
    roleNameTh: String(row[4] || ''),
    employeeId: String(row[5] || ''),
    avatarUrl: row[6] ? String(row[6]) : undefined,
  };
}

// ============================================================================
// Google Apps Script Web App Backend Bridge (No Service Account / No Login)
// ============================================================================
export async function loadFromGoogleBackend(seedFallback: WorkspaceDatabaseState): Promise<WorkspaceDatabaseState | null> {
  const mode = getBackendDbMode();
  if (mode === 'local_json') return null;

  const gasUrl = getAppsScriptUrl();
  if (!gasUrl) return null;
  const ssId = process.env.GOOGLE_SPREADSHEET_ID?.trim().replace(/^["']+|["']+$/g, '');
  const readUrl = ssId
    ? `${gasUrl}?action=readAll&spreadsheetId=${encodeURIComponent(ssId)}`
    : `${gasUrl}?action=readAll`;
  const res = await fetch(readUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Apps Script read failed (${res.status})`);
  const json = await res.json();
  if (!json.success) {
    const errMsg = String(json.error || 'Apps Script error');
    if (errMsg.includes('getSheetByName')) {
      throw new Error(
        `Apps Script ไม่พบไฟล์ Google Sheet (getActiveSpreadsheet เป็น null) — กรุณาอัปเดตโค้ดล่าสุดจาก scripts/Code.gs แล้ว Deploy New version ใน Apps Script (${errMsg})`
      );
    }
    throw new Error(errMsg);
  }

  const raw = json.data || {};
  const eqRows: any[][] = raw[TAB_EQUIPMENT] || [];
  if (eqRows.length <= 1) {
    // Seed initial CDC data directly into empty Google Sheet
    await syncAllToGoogleBackend(seedFallback);
    return seedFallback;
  }

  return {
    equipment: eqRows.slice(1).map(parseEquipmentRow).filter((x): x is Equipment => x !== null),
    inspections: (raw[TAB_INSPECTIONS] || []).slice(1).map(parseInspectionRow).filter((x: any): x is InspectionRecord => x !== null),
    correctiveActions: (raw[TAB_ACTIONS] || []).slice(1).map(parseActionRow).filter((x: any): x is CorrectiveAction => x !== null),
    users: (raw[TAB_USERS] || []).slice(1).map(parseUserRow).filter((x: any): x is User => x !== null),
    lastUpdated: new Date().toISOString(),
  };
}

async function writeTabToGoogleBackend(
  tabName: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<void> {
  const mode = getBackendDbMode();
  if (mode === 'local_json') return;

  const gasUrl = getAppsScriptUrl();
  if (!gasUrl) return;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim().replace(/^["']+|["']+$/g, '') || undefined;
  const res = await fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'writeTab', spreadsheetId, tabName, headers, rows }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Apps Script writeTab failed (${res.status})`);
  const json = await res.json().catch(() => null);
  if (json && json.success === false) {
    throw new Error(json.error || `Apps Script writeTab error (${tabName})`);
  }
}

export async function syncEquipmentToBackend(equipment: Equipment[]): Promise<void> {
  await writeTabToGoogleBackend(TAB_EQUIPMENT, EQUIPMENT_HEADERS, equipment.map(serializeEquipmentRow));
}

export async function syncInspectionsToBackend(inspections: InspectionRecord[]): Promise<void> {
  await writeTabToGoogleBackend(TAB_INSPECTIONS, INSPECTION_HEADERS, inspections.map(serializeInspectionRow));
}

export async function syncActionsToBackend(actions: CorrectiveAction[]): Promise<void> {
  await writeTabToGoogleBackend(TAB_ACTIONS, ACTION_HEADERS, actions.map(serializeActionRow));
}

export async function syncUsersToBackend(users: User[]): Promise<void> {
  await writeTabToGoogleBackend(TAB_USERS, USER_HEADERS, users.map(serializeUserRow));
}

export async function syncAllToGoogleBackend(data: WorkspaceDatabaseState): Promise<void> {
  const mode = getBackendDbMode();
  if (mode === 'local_json') return;

  const gasUrl = getAppsScriptUrl();
  if (!gasUrl) return;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim().replace(/^["']+|["']+$/g, '') || undefined;
  const res = await fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'writeAll',
      spreadsheetId,
      tabs: {
        [TAB_EQUIPMENT]: { headers: EQUIPMENT_HEADERS, rows: data.equipment.map(serializeEquipmentRow) },
        [TAB_INSPECTIONS]: { headers: INSPECTION_HEADERS, rows: data.inspections.map(serializeInspectionRow) },
        [TAB_ACTIONS]: { headers: ACTION_HEADERS, rows: data.correctiveActions.map(serializeActionRow) },
        [TAB_USERS]: { headers: USER_HEADERS, rows: data.users.map(serializeUserRow) },
      },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Apps Script writeAll failed (${res.status})`);
  const json = await res.json().catch(() => null);
  if (json && json.success === false) {
    throw new Error(json.error || 'Apps Script writeAll error');
  }
}

export async function uploadPhotoToGoogleDriveBackend(filename: string, dataUrl: string): Promise<string> {
  const mode = getBackendDbMode();
  if (mode === 'local_json') return dataUrl;

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return dataUrl;

  const mimeType = match[1];
  const base64Data = match[2];

  const gasUrl = getAppsScriptUrl();
  if (!gasUrl) return dataUrl;
  const res = await fetch(gasUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'uploadPhoto', filename, mimeType, base64: base64Data }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Apps Script uploadPhoto failed (${res.status})`);
  const json = await res.json();
  if (!json.success || !json.driveRef) throw new Error(json.error || 'Upload photo failed');
  return json.driveRef;
}

export async function fetchDrivePhotoFromBackend(fileId: string): Promise<{ contentType: string; buffer: Buffer }> {
  const mode = getBackendDbMode();
  if (mode !== 'apps_script') {
    throw new Error('Google Drive backend not configured');
  }

  const gasUrl = getAppsScriptUrl();
  if (!gasUrl) throw new Error('GOOGLE_APPS_SCRIPT_URL not configured');
  const res = await fetch(`${gasUrl}?action=getPhoto&fileId=${encodeURIComponent(fileId)}`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Apps Script getPhoto failed (${res.status})`);
  const json = await res.json();
  if (!json.success || !json.base64) throw new Error(json.error || 'Photo not found');
  return {
    contentType: json.contentType || 'image/jpeg',
    buffer: Buffer.from(json.base64, 'base64'),
  };
}
