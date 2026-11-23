import { createClient, type Client, type InStatement } from '@libsql/client/web';
import { Equipment, InspectionRecord, CorrectiveAction, User } from '../src/types/index.ts';

export interface WorkspaceDatabaseState {
  equipment: Equipment[];
  inspections: InspectionRecord[];
  correctiveActions: CorrectiveAction[];
  users: User[];
  lastUpdated: string;
}

export type BackendDbMode = 'turso' | 'local_json';

function cleanEnvValue(val?: string): string | null {
  if (!val) return null;
  const cleaned = val.trim().replace(/^["']+|["']+$/g, '').trim();
  return cleaned || null;
}

let runtimeEnvOverride: { TURSO_DATABASE_URL?: string; TURSO_AUTH_TOKEN?: string } | null = null;

export function setRuntimeTursoEnv(env?: {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}): void {
  if (env) {
    runtimeEnvOverride = {
      TURSO_DATABASE_URL: env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN,
    };
  }
}

export function getTursoConfig(): { url: string; authToken?: string } | null {
  const procEnv = typeof process !== 'undefined' ? process.env : undefined;
  const url = cleanEnvValue(runtimeEnvOverride?.TURSO_DATABASE_URL ?? procEnv?.TURSO_DATABASE_URL);
  if (!url) return null;
  const authToken =
    cleanEnvValue(runtimeEnvOverride?.TURSO_AUTH_TOKEN ?? procEnv?.TURSO_AUTH_TOKEN) || undefined;
  return { url, authToken };
}

export function getBackendDbMode(): BackendDbMode {
  return getTursoConfig() ? 'turso' : 'local_json';
}

let cachedClient: Client | null = null;
let cachedConfigKey = '';

function getTursoClient(): Client {
  const cfg = getTursoConfig();
  if (!cfg) {
    throw new Error('TURSO_DATABASE_URL is not configured');
  }
  const key = `${cfg.url}|${cfg.authToken || ''}`;
  if (!cachedClient || cachedConfigKey !== key) {
    cachedClient = createClient({
      url: cfg.url,
      authToken: cfg.authToken,
    });
    cachedConfigKey = key;
  }
  return cachedClient;
}

const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    subType TEXT NOT NULL,
    zoneId TEXT NOT NULL,
    zoneName TEXT NOT NULL,
    pageNumber INTEGER NOT NULL,
    xPercent REAL NOT NULL,
    yPercent REAL NOT NULL,
    status TEXT NOT NULL,
    lastInspectedAt TEXT,
    lastInspectorName TEXT,
    lastResult TEXT,
    activeDefectId TEXT,
    capacity TEXT,
    expiryDate TEXT,
    nextMaintenanceDate TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    equipmentId TEXT NOT NULL,
    equipmentType TEXT NOT NULL,
    zoneId TEXT NOT NULL,
    zoneName TEXT NOT NULL,
    inspectorName TEXT NOT NULL,
    inspectorRole TEXT NOT NULL,
    inspectorEmployeeId TEXT NOT NULL,
    inspectedAt TEXT NOT NULL,
    cycle TEXT NOT NULL,
    overallResult TEXT NOT NULL,
    defectDetails TEXT,
    photoUrl TEXT,
    notes TEXT,
    checklistJson TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS corrective_actions (
    id TEXT PRIMARY KEY,
    equipmentId TEXT NOT NULL,
    inspectionId TEXT NOT NULL,
    zoneId TEXT NOT NULL,
    zoneName TEXT NOT NULL,
    defectDetails TEXT NOT NULL,
    photoEvidence TEXT,
    reportedBy TEXT NOT NULL,
    reportedAt TEXT NOT NULL,
    assignedTo TEXT,
    dueDate TEXT,
    status TEXT NOT NULL,
    resolutionNotes TEXT,
    resolvedPhotoUrl TEXT,
    resolvedAt TEXT,
    resolvedBy TEXT,
    verifiedBy TEXT,
    verifiedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    roleNameTh TEXT NOT NULL,
    employeeId TEXT NOT NULL,
    avatarUrl TEXT,
    department TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    contentType TEXT NOT NULL,
    base64Data TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (inspectedAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_inspections_equip_date ON inspections (equipmentId, inspectedAt DESC)`,
];

let schemaReadyPromise: Promise<void> | null = null;
let schemaReadyConfigKey = '';

async function ensureSchema(): Promise<Client> {
  const cfg = getTursoConfig();
  if (!cfg) throw new Error('TURSO_DATABASE_URL is not configured');
  const key = `${cfg.url}|${cfg.authToken || ''}`;
  const client = getTursoClient();

  if (!schemaReadyPromise || schemaReadyConfigKey !== key) {
    schemaReadyConfigKey = key;
    schemaReadyPromise = (async () => {
      await client.batch(
        SCHEMA_STATEMENTS.map(sql => ({ sql, args: [] })),
        'write'
      );
    })().catch(err => {
      schemaReadyPromise = null;
      throw err;
    });
  }

  await schemaReadyPromise;
  return client;
}

// ============================================================================
// Row Mapping Helpers
// ============================================================================
function rowToEquipment(r: Record<string, any>): Equipment {
  return {
    id: String(r.id),
    type: r.type === 'fire_hose_cabinet' ? 'fire_hose_cabinet' : 'fire_extinguisher',
    subType: String(r.subType || 'Dry Chemical'),
    zoneId: String(r.zoneId || ''),
    zoneName: String(r.zoneName || ''),
    pageNumber: Number(r.pageNumber) || 1,
    xPercent: Number(r.xPercent ?? 50),
    yPercent: Number(r.yPercent ?? 50),
    status: (r.status as Equipment['status']) || 'PENDING',
    lastInspectedAt: r.lastInspectedAt ? String(r.lastInspectedAt) : null,
    lastInspectorName: r.lastInspectorName ? String(r.lastInspectorName) : null,
    lastResult: r.lastResult === 'PASS' || r.lastResult === 'FAIL' ? r.lastResult : null,
    activeDefectId: r.activeDefectId ? String(r.activeDefectId) : null,
    capacity: r.capacity ? String(r.capacity) : undefined,
    expiryDate: r.expiryDate ? String(r.expiryDate) : undefined,
    nextMaintenanceDate: r.nextMaintenanceDate ? String(r.nextMaintenanceDate) : undefined,
  };
}

function rowToInspection(r: Record<string, any>): InspectionRecord {
  let checklist: InspectionRecord['checklist'] = [];
  if (r.checklistJson) {
    try {
      checklist = JSON.parse(String(r.checklistJson));
    } catch {
      checklist = [];
    }
  }
  return {
    id: String(r.id),
    equipmentId: String(r.equipmentId || ''),
    equipmentType: r.equipmentType === 'fire_hose_cabinet' ? 'fire_hose_cabinet' : 'fire_extinguisher',
    zoneId: String(r.zoneId || ''),
    zoneName: String(r.zoneName || ''),
    inspectorName: String(r.inspectorName || ''),
    inspectorRole: (r.inspectorRole as InspectionRecord['inspectorRole']) || 'INSPECTOR',
    inspectorEmployeeId: String(r.inspectorEmployeeId || ''),
    inspectedAt: String(r.inspectedAt || ''),
    cycle: r.cycle ? String(r.cycle) : String(r.inspectedAt || '').slice(0, 7),
    overallResult: r.overallResult === 'FAIL' ? 'FAIL' : 'PASS',
    defectDetails: r.defectDetails ? String(r.defectDetails) : undefined,
    photoUrl: r.photoUrl ? String(r.photoUrl) : undefined,
    notes: r.notes ? String(r.notes) : undefined,
    checklist,
  };
}

function rowToAction(r: Record<string, any>): CorrectiveAction {
  return {
    id: String(r.id),
    equipmentId: String(r.equipmentId || ''),
    inspectionId: String(r.inspectionId || ''),
    zoneId: String(r.zoneId || ''),
    zoneName: String(r.zoneName || ''),
    defectDetails: String(r.defectDetails || ''),
    photoEvidence: r.photoEvidence ? String(r.photoEvidence) : undefined,
    reportedBy: String(r.reportedBy || ''),
    reportedAt: String(r.reportedAt || ''),
    assignedTo: String(r.assignedTo || ''),
    dueDate: String(r.dueDate || ''),
    status: (r.status as CorrectiveAction['status']) || 'OPEN',
    resolutionNotes: r.resolutionNotes ? String(r.resolutionNotes) : undefined,
    resolvedPhotoUrl: r.resolvedPhotoUrl ? String(r.resolvedPhotoUrl) : undefined,
    resolvedAt: r.resolvedAt ? String(r.resolvedAt) : undefined,
    resolvedBy: r.resolvedBy ? String(r.resolvedBy) : undefined,
    verifiedBy: r.verifiedBy ? String(r.verifiedBy) : undefined,
    verifiedAt: r.verifiedAt ? String(r.verifiedAt) : undefined,
  };
}

function rowToUser(r: Record<string, any>): User {
  return {
    id: String(r.id),
    username: String(r.username || ''),
    name: String(r.name || ''),
    role: (r.role as User['role']) || 'VISITOR',
    roleNameTh: String(r.roleNameTh || ''),
    employeeId: String(r.employeeId || ''),
    avatarUrl: r.avatarUrl ? String(r.avatarUrl) : undefined,
    department: r.department ? String(r.department) : undefined,
  };
}

function equipmentInsertStmt(e: Equipment): InStatement {
  return {
    sql: `INSERT OR REPLACE INTO equipment (
      id, type, subType, zoneId, zoneName, pageNumber, xPercent, yPercent,
      status, lastInspectedAt, lastInspectorName, lastResult, activeDefectId,
      capacity, expiryDate, nextMaintenanceDate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      e.id,
      e.type,
      e.subType || '',
      e.zoneId,
      e.zoneName || '',
      e.pageNumber ?? 1,
      e.xPercent ?? 50,
      e.yPercent ?? 50,
      e.status || 'PENDING',
      e.lastInspectedAt ?? null,
      e.lastInspectorName ?? null,
      e.lastResult ?? null,
      e.activeDefectId ?? null,
      e.capacity ?? null,
      e.expiryDate ?? null,
      e.nextMaintenanceDate ?? null,
    ],
  };
}

function inspectionInsertStmt(i: InspectionRecord): InStatement {
  return {
    sql: `INSERT OR REPLACE INTO inspections (
      id, equipmentId, equipmentType, zoneId, zoneName, inspectorName,
      inspectorRole, inspectorEmployeeId, inspectedAt, cycle, overallResult,
      defectDetails, photoUrl, notes, checklistJson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
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
      i.defectDetails ?? null,
      i.photoUrl ?? null,
      i.notes ?? null,
      JSON.stringify(i.checklist || []),
    ],
  };
}

function actionInsertStmt(a: CorrectiveAction): InStatement {
  return {
    sql: `INSERT OR REPLACE INTO corrective_actions (
      id, equipmentId, inspectionId, zoneId, zoneName, defectDetails,
      photoEvidence, reportedBy, reportedAt, assignedTo, dueDate, status,
      resolutionNotes, resolvedPhotoUrl, resolvedAt, resolvedBy, verifiedBy, verifiedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      a.id,
      a.equipmentId,
      a.inspectionId,
      a.zoneId,
      a.zoneName,
      a.defectDetails,
      a.photoEvidence ?? null,
      a.reportedBy,
      a.reportedAt,
      a.assignedTo ?? null,
      a.dueDate ?? null,
      a.status || 'OPEN',
      a.resolutionNotes ?? null,
      a.resolvedPhotoUrl ?? null,
      a.resolvedAt ?? null,
      a.resolvedBy ?? null,
      a.verifiedBy ?? null,
      a.verifiedAt ?? null,
    ],
  };
}

function userInsertStmt(u: User): InStatement {
  return {
    sql: `INSERT OR REPLACE INTO users (
      id, username, name, role, roleNameTh, employeeId, avatarUrl, department
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      u.id,
      u.username,
      u.name,
      u.role,
      u.roleNameTh,
      u.employeeId,
      u.avatarUrl ?? null,
      u.department ?? null,
    ],
  };
}

async function runBatchChunked(client: Client, stmts: InStatement[], chunkSize = 80): Promise<void> {
  for (let i = 0; i < stmts.length; i += chunkSize) {
    const chunk = stmts.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await client.batch(chunk, 'write');
    }
  }
}

// ============================================================================
// Public Turso Database Operations
// ============================================================================
export async function loadFromTursoBackend(
  seedFallback: WorkspaceDatabaseState
): Promise<WorkspaceDatabaseState | null> {
  if (getBackendDbMode() === 'local_json') return null;

  const client = await ensureSchema();
  const countRes = await client.execute('SELECT COUNT(*) AS cnt FROM equipment');
  const eqCount = Number(countRes.rows[0]?.cnt ?? 0);

  if (eqCount === 0) {
    await seedTursoDatabase(seedFallback);
    return seedFallback;
  }

  const [eqRes, inspRes, actRes, usrRes] = await client.batch(
    [
      'SELECT * FROM equipment',
      'SELECT * FROM inspections ORDER BY inspectedAt DESC LIMIT 250',
      'SELECT * FROM corrective_actions ORDER BY reportedAt DESC',
      'SELECT * FROM users',
    ],
    'read'
  );

  return {
    equipment: eqRes.rows.map(r => rowToEquipment(r as Record<string, any>)),
    inspections: inspRes.rows.map(r => rowToInspection(r as Record<string, any>)),
    correctiveActions: actRes.rows.map(r => rowToAction(r as Record<string, any>)),
    users: usrRes.rows.map(r => rowToUser(r as Record<string, any>)),
    lastUpdated: new Date().toISOString(),
  };
}

export async function getEquipmentHistoryFromTurso(
  equipmentId: string
): Promise<InspectionRecord[] | null> {
  if (getBackendDbMode() === 'local_json') return null;
  const client = await ensureSchema();
  const res = await client.execute({
    sql: 'SELECT * FROM inspections WHERE UPPER(equipmentId) = UPPER(?) ORDER BY inspectedAt DESC',
    args: [equipmentId],
  });
  return res.rows.map(r => rowToInspection(r as Record<string, any>));
}

export async function getAllInspectionsFromTurso(): Promise<InspectionRecord[] | null> {
  if (getBackendDbMode() === 'local_json') return null;
  const client = await ensureSchema();
  const res = await client.execute(
    'SELECT id, equipmentId, equipmentType, zoneId, zoneName, inspectorName, inspectorRole, inspectorEmployeeId, inspectedAt, cycle, overallResult, defectDetails, photoUrl, notes FROM inspections ORDER BY inspectedAt DESC'
  );
  return res.rows.map(r => rowToInspection(r as Record<string, any>));
}

export async function seedTursoDatabase(data: WorkspaceDatabaseState): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();

  await client.batch(
    [
      'DELETE FROM equipment',
      'DELETE FROM inspections',
      'DELETE FROM corrective_actions',
      'DELETE FROM users',
    ],
    'write'
  );

  const stmts: InStatement[] = [
    ...data.equipment.map(equipmentInsertStmt),
    ...data.inspections.map(inspectionInsertStmt),
    ...data.correctiveActions.map(actionInsertStmt),
    ...data.users.map(userInsertStmt),
  ];

  await runBatchChunked(client, stmts);
}

export async function upsertEquipmentInTurso(items: Equipment[]): Promise<void> {
  if (getBackendDbMode() === 'local_json' || items.length === 0) return;
  const client = await ensureSchema();
  await runBatchChunked(client, items.map(equipmentInsertStmt));
}

export async function deleteEquipmentInTurso(id: string): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();
  await client.execute({ sql: 'DELETE FROM equipment WHERE id = ?', args: [id] });
}

export async function saveInspectionMutationInTurso(
  inspection: InspectionRecord,
  equipment: Equipment,
  action?: CorrectiveAction
): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();
  const stmts: InStatement[] = [
    inspectionInsertStmt(inspection),
    equipmentInsertStmt(equipment),
  ];
  if (action) {
    stmts.push(actionInsertStmt(action));
  }
  await client.batch(stmts, 'write');
}

export async function updateInspectionInTurso(
  inspection: InspectionRecord,
  updatedEquipment?: Equipment
): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();
  const stmts: InStatement[] = [inspectionInsertStmt(inspection)];
  if (updatedEquipment) {
    stmts.push(equipmentInsertStmt(updatedEquipment));
  }
  await client.batch(stmts, 'write');
}

export async function deleteInspectionInTurso(id: string): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();
  await client.execute({ sql: 'DELETE FROM inspections WHERE id = ?', args: [id] });
}

export async function saveActionMutationInTurso(
  action: CorrectiveAction,
  updatedEquipment?: Equipment
): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();
  const stmts: InStatement[] = [actionInsertStmt(action)];
  if (updatedEquipment) {
    stmts.push(equipmentInsertStmt(updatedEquipment));
  }
  await client.batch(stmts, 'write');
}

export async function upsertUserInTurso(user: User): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();
  await client.execute(userInsertStmt(user));
}

export async function deleteUserInTurso(id: string): Promise<void> {
  if (getBackendDbMode() === 'local_json') return;
  const client = await ensureSchema();
  await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
}

export async function uploadPhotoToTursoBackend(filename: string, dataUrl: string): Promise<string> {
  if (getBackendDbMode() === 'local_json') return dataUrl;

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return dataUrl;

  const contentType = match[1];
  const base64Data = match[2];
  const safeSlug = filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  const fileId = `${safeSlug}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const client = await ensureSchema();
  await client.execute({
    sql: `INSERT OR REPLACE INTO media_files (id, contentType, base64Data, createdAt) VALUES (?, ?, ?, ?)`,
    args: [fileId, contentType, base64Data, new Date().toISOString()],
  });

  return `turso://${fileId}`;
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64);
  const buffer = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export async function fetchMediaFromTursoBackend(
  fileId: string
): Promise<{ contentType: string; bytes: Uint8Array<ArrayBuffer> }> {
  if (getBackendDbMode() !== 'turso') {
    throw new Error('Turso database not configured');
  }

  const client = await ensureSchema();
  const res = await client.execute({
    sql: 'SELECT contentType, base64Data FROM media_files WHERE id = ?',
    args: [fileId],
  });

  if (!res.rows.length || !res.rows[0].base64Data) {
    throw new Error('Photo not found in Turso database');
  }

  return {
    contentType: String(res.rows[0].contentType || 'image/jpeg'),
    bytes: base64ToBytes(String(res.rows[0].base64Data)),
  };
}
