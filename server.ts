import 'dotenv/config';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateInitialEquipment, ZONES, INITIAL_USERS } from './src/data/warehouseData.ts';
import { Equipment, InspectionRecord, CorrectiveAction, User } from './src/types/index.ts';
import {
  getTursoConfig,
  getBackendDbMode,
  loadFromTursoBackend,
  seedTursoDatabase,
  upsertEquipmentInTurso,
  deleteEquipmentInTurso,
  saveInspectionMutationInTurso,
  updateInspectionInTurso,
  deleteInspectionInTurso,
  saveActionMutationInTurso,
  upsertUserInTurso,
  deleteUserInTurso,
  uploadPhotoToTursoBackend,
  fetchMediaFromTursoBackend,
  getEquipmentHistoryFromTurso,
} from './server/tursoDb.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const isVercel = Boolean(process.env.VERCEL);
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = isVercel ? '/tmp/cdc-data' : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_DB_FILE = path.join(__dirname, 'data', 'db.json');

interface DatabaseSchema {
  equipment: Equipment[];
  inspections: InspectionRecord[];
  correctiveActions: CorrectiveAction[];
  users: User[];
  lastUpdated: string;
}

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Could not create DATA_DIR:', err);
}

function createSeedDatabase(): DatabaseSchema {
  const initialEquipment = generateInitialEquipment();
  const initialActions: CorrectiveAction[] = [
    {
      id: 'def-ff4-01',
      equipmentId: 'FF4',
      inspectionId: 'insp-seed-01',
      zoneId: 'zone-fresh',
      zoneName: 'แผนกอาหารสด (Fresh)',
      defectDetails: 'Pressure Gauge ตกต่ำกว่าขีดเขียว (สูญเสียแรงดันภายใน) สลักและซีลหลุดหาย',
      reportedBy: 'Anan Saelim (อนันต์)',
      reportedAt: '2026-11-06T09:15:00Z',
      assignedTo: 'ทีมวิศวกรรมบำรุงรักษา (Facility & Maintenance)',
      dueDate: '2026-11-12',
      status: 'OPEN',
    },
    {
      id: 'def-ff10-01',
      equipmentId: 'FF10',
      inspectionId: 'insp-seed-02',
      zoneId: 'zone-fresh',
      zoneName: 'แผนกอาหารสด (Fresh)',
      defectDetails: 'สายฉีดแตกลายงา และมีกล่องสินค้าพาเลทตั้งขวางระยะ 0.5 เมตร',
      reportedBy: 'Anan Saelim (อนันต์)',
      reportedAt: '2026-11-04T10:00:00Z',
      assignedTo: 'ผู้ควบคุมคลังโซน Fresh',
      dueDate: '2026-11-09',
      status: 'IN_PROGRESS',
      resolutionNotes: 'ได้ย้ายพาเลทสินค้าออกแล้ว อยู่ระหว่างรอเบิกสายฉีดเส้นใหม่มาเปลี่ยน',
    },
    {
      id: 'def-df84-01',
      equipmentId: 'DF84',
      inspectionId: 'insp-seed-03',
      zoneId: 'zone-dry-1',
      zoneName: 'คลังสินค้าแห้ง โซน 1 (Dry Storage)',
      defectDetails: 'หัวฉีดทองเหลืองมีคราบตะกรันและวาล์วเปิด-ปิดหมุนฝืดมากในตู้ดับเพลิง',
      reportedBy: 'Anan Saelim (อนันต์)',
      reportedAt: '2026-11-07T09:10:00Z',
      assignedTo: 'ช่างเทคนิคระบบประปาและดับเพลิง',
      dueDate: '2026-11-10',
      status: 'OPEN',
    },
  ];

  return {
    equipment: initialEquipment,
    inspections: [],
    correctiveActions: initialActions,
    users: INITIAL_USERS,
    lastUpdated: new Date().toISOString(),
  };
}

function initLocalDatabase(): DatabaseSchema {
  for (const candidate of [DB_FILE, SEED_DB_FILE]) {
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, 'utf-8');
        const parsed = JSON.parse(content) as DatabaseSchema;
        if (parsed.equipment && parsed.inspections && parsed.correctiveActions) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to read db.json, trying fallback', e);
      }
    }
  }

  const fresh = createSeedDatabase();
  saveLocalDatabase(fresh);
  return fresh;
}

function saveLocalDatabase(data: DatabaseSchema): void {
  try {
    data.lastUpdated = new Date().toISOString();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing local database cache:', err);
  }
}

let db = initLocalDatabase();
let tursoConnected = false;
let tursoError: string | null = null;
let lastTursoRefreshAt = 0;

// In-memory LRU cache for uploaded inspection/repair photos
const mediaCache = new Map<string, { contentType: string; buffer: Buffer }>();
function cacheMediaFile(fileId: string, contentType: string, buffer: Buffer) {
  if (mediaCache.size >= 100) {
    const oldestKey = mediaCache.keys().next().value;
    if (oldestKey) mediaCache.delete(oldestKey);
  }
  mediaCache.set(fileId, { contentType, buffer });
}

let bootstrapPromise: Promise<void> | null = null;
let lastBootstrapAttemptAt = 0;
let refreshPromise: Promise<void> | null = null;

async function bootstrapTursoBackend(): Promise<void> {
  const mode = getBackendDbMode();
  if (mode === 'local_json') {
    tursoConnected = false;
    tursoError = null;
    return;
  }

  try {
    const remote = await loadFromTursoBackend(db);
    if (remote) {
      db = remote;
      saveLocalDatabase(db);
      tursoConnected = true;
      tursoError = null;
      lastTursoRefreshAt = Date.now();
      console.log(`Connected backend database to Turso (${db.equipment.length} equipment items)`);
    }
  } catch (err: any) {
    tursoConnected = false;
    tursoError = err?.message || String(err);
    console.warn(`Notice: Turso backend not ready yet, serving from cached db.json:`, tursoError);
  }
}

async function ensureTursoBootstrap(skipRefresh = false): Promise<void> {
  const mode = getBackendDbMode();
  if (
    bootstrapPromise &&
    mode === 'turso' &&
    !tursoConnected &&
    Date.now() - lastBootstrapAttemptAt > 5000
  ) {
    bootstrapPromise = null;
  }
  if (!bootstrapPromise) {
    lastBootstrapAttemptAt = Date.now();
    bootstrapPromise = bootstrapTursoBackend();
  }
  await bootstrapPromise;

  // Keep reads fresh across devices/instances after a brief TTL
  if (
    !skipRefresh &&
    mode === 'turso' &&
    tursoConnected &&
    Date.now() - lastTursoRefreshAt > 1500
  ) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const remote = await loadFromTursoBackend(db);
          if (remote) {
            db = remote;
            lastTursoRefreshAt = Date.now();
            tursoError = null;
          }
        } catch (err: any) {
          tursoError = err?.message || String(err);
        } finally {
          refreshPromise = null;
        }
      })();
    }
    await refreshPromise;
  }
}

function markTursoWriteOk() {
  tursoConnected = getBackendDbMode() === 'turso';
  tursoError = null;
  lastTursoRefreshAt = Date.now();
}

export function createExpressApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Ensure Turso connection & initial schema/seed are ready before serving API routes
  app.use('/api', async (req: Request, res: Response, next) => {
    const isMediaRoute = req.path.startsWith('/media/') || req.path.startsWith('/drive-file/');
    if (req.method === 'GET' && !isMediaRoute) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
    await ensureTursoBootstrap(isMediaRoute || req.path === '/zones');
    next();
  });

  // 1. Health & Backend Database Mode
  app.get('/api/health', (_req: Request, res: Response) => {
    const cfg = getTursoConfig();
    res.json({
      status: 'ok',
      backendMode: getBackendDbMode(),
      envConfigured: Boolean(cfg?.url),
      hasAuthToken: Boolean(cfg?.authToken),
      isVercel,
      tursoConnected,
      tursoError,
      equipmentCount: db.equipment.length,
      time: new Date().toISOString(),
    });
  });

  // 1b. Stream Turso-stored photos (keep /api/drive-file/:fileId alias for existing records)
  async function handleServeMedia(req: Request, res: Response) {
    const { fileId } = req.params;
    const cached = mediaCache.get(fileId);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buffer);
    }

    try {
      const { contentType, bytes } = await fetchMediaFromTursoBackend(fileId);
      const buffer = Buffer.from(bytes);
      cacheMediaFile(fileId, contentType, buffer);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (err: any) {
      res.status(404).json({ error: err.message || 'Photo not found' });
    }
  }

  app.get('/api/media/:fileId', handleServeMedia);
  app.get('/api/drive-file/:fileId', handleServeMedia);

  // 2. Zones
  app.get('/api/zones', (_req: Request, res: Response) => {
    res.json(ZONES);
  });

  // 3. Authentication & User Management
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    const u = (username || '').trim();
    const p = (password || '').trim();

    if (u === 'admin_cj' && p === '2026') {
      const user = db.users.find(usr => usr.username === 'admin_cj') || {
        id: 'u-admin',
        username: 'admin_cj',
        name: 'ผู้ดูแลระบบ (Admin CJ)',
        role: 'ADMIN',
        roleNameTh: 'ผู้ดูแลระบบ (ADMIN)',
        employeeId: 'ADM-001',
      };
      return res.json({ success: true, user, role: 'ADMIN' });
    }

    if ((u.toLowerCase() === 'inspecter_cj' || u.toLowerCase() === 'inspector_cj') && p === '0000') {
      const user = db.users.find(usr => usr.username.toLowerCase() === 'inspecter_cj') || {
        id: 'u-inspector',
        username: 'Inspecter_cj',
        name: 'ผู้ตรวจสอบ (Inspector CJ)',
        role: 'INSPECTOR',
        roleNameTh: 'ผู้ตรวจสอบ (INSPECTOR)',
        employeeId: 'INS-002',
      };
      return res.json({ success: true, user, role: 'INSPECTOR' });
    }

    return res.status(401).json({ error: 'User ID หรือ Password ไม่ถูกต้อง' });
  });

  app.get('/api/users', (_req: Request, res: Response) => {
    res.json(db.users);
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const { username, name, role, roleNameTh, employeeId } = req.body;
      if (!username || !name || !role) {
        return res.status(400).json({ error: 'Missing required user fields' });
      }
      const newUser: User = {
        id: `u-${Date.now()}`,
        username,
        name,
        role,
        roleNameTh: roleNameTh || (role === 'ADMIN' ? 'ผู้ดูแลระบบ' : role === 'INSPECTOR' ? 'ผู้ตรวจสอบ' : 'ผู้เข้าชม'),
        employeeId: employeeId || `EMP-${Date.now().toString().slice(-4)}`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      };
      await upsertUserInTurso(newUser);
      markTursoWriteOk();
      db.users.push(newUser);
      saveLocalDatabase(db);
      res.status(201).json({ success: true, user: newUser });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to save user' });
    }
  });

  app.patch('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const idx = db.users.findIndex(u => u.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      const current = { ...db.users[idx] };
      const { name, role, roleNameTh, employeeId } = req.body;
      if (name) current.name = name;
      if (role) current.role = role;
      if (roleNameTh) current.roleNameTh = roleNameTh;
      if (employeeId) current.employeeId = employeeId;

      await upsertUserInTurso(current);
      markTursoWriteOk();
      db.users[idx] = current;
      saveLocalDatabase(db);
      res.json({ success: true, user: current });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const idx = db.users.findIndex(u => u.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      await deleteUserInTurso(req.params.id);
      markTursoWriteOk();
      db.users.splice(idx, 1);
      saveLocalDatabase(db);
      res.json({ success: true });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to delete user' });
    }
  });

  // 4. Equipment list
  app.get('/api/equipment', (req: Request, res: Response) => {
    let result = db.equipment;
    const { zoneId, status, type, search } = req.query;

    if (zoneId && typeof zoneId === 'string' && zoneId !== 'all') {
      result = result.filter(e => e.zoneId === zoneId);
    }
    if (status && typeof status === 'string' && status !== 'all') {
      result = result.filter(e => e.status === status);
    }
    if (type && typeof type === 'string' && type !== 'all') {
      result = result.filter(e => e.type === type);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      result = result.filter(
        e => e.id.toLowerCase().includes(q) || e.subType.toLowerCase().includes(q) || e.zoneName.toLowerCase().includes(q)
      );
    }

    res.json(result);
  });

  // 5. Single equipment by ID
  app.get('/api/equipment/:id', async (req: Request, res: Response) => {
    const equip = db.equipment.find(e => e.id.toUpperCase() === req.params.id.toUpperCase());
    if (!equip) {
      return res.status(404).json({ error: `Equipment ${req.params.id} not found` });
    }
    let history = db.inspections
      .filter(i => i.equipmentId.toUpperCase() === req.params.id.toUpperCase())
      .sort((a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime());
    if (getBackendDbMode() === 'turso' && tursoConnected) {
      try {
        const remoteHistory = await getEquipmentHistoryFromTurso(equip.id);
        if (remoteHistory) history = remoteHistory;
      } catch (err) {
        console.warn('Turso equipment history fallback to cache:', err);
      }
    }
    const activeDefect = db.correctiveActions.find(
      c => c.equipmentId.toUpperCase() === req.params.id.toUpperCase() && c.status !== 'COMPLETED'
    );
    res.json({ equipment: equip, history, activeDefect });
  });

  // Update single equipment
  app.patch('/api/equipment/:id', async (req: Request, res: Response) => {
    try {
      const equipIndex = db.equipment.findIndex(e => e.id.toUpperCase() === req.params.id.toUpperCase());
      if (equipIndex === -1) {
        return res.status(404).json({ error: `Equipment ${req.params.id} not found` });
      }

      const current = { ...db.equipment[equipIndex] };
      const {
        xPercent,
        yPercent,
        subType,
        type,
        zoneId,
        zoneName,
        pageNumber,
        status,
        capacity,
        expiryDate,
        nextMaintenanceDate,
        lastInspectorName,
        lastInspectedAt,
        lastResult,
      } = req.body;

      if (xPercent !== undefined) current.xPercent = Math.max(0, Math.min(100, parseFloat(xPercent)));
      if (yPercent !== undefined) current.yPercent = Math.max(0, Math.min(100, parseFloat(yPercent)));
      if (subType !== undefined) current.subType = subType;
      if (type !== undefined) current.type = type;
      if (zoneId !== undefined) current.zoneId = zoneId;
      if (zoneName !== undefined) current.zoneName = zoneName;
      if (pageNumber !== undefined) current.pageNumber = pageNumber;
      if (status !== undefined) current.status = status;
      if (capacity !== undefined) current.capacity = capacity;
      if (expiryDate !== undefined) current.expiryDate = expiryDate;
      if (nextMaintenanceDate !== undefined) current.nextMaintenanceDate = nextMaintenanceDate;
      if (lastInspectorName !== undefined) current.lastInspectorName = lastInspectorName;
      if (lastInspectedAt !== undefined) current.lastInspectedAt = lastInspectedAt;
      if (lastResult !== undefined) current.lastResult = lastResult;

      await upsertEquipmentInTurso([current]);
      markTursoWriteOk();
      db.equipment[equipIndex] = current;
      saveLocalDatabase(db);
      res.json({ success: true, equipment: current });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to update equipment' });
    }
  });

  // Batch update equipment positions
  app.post('/api/equipment/batch-positions', async (req: Request, res: Response) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: 'Expected updates array' });
      }

      const updatedItems: Equipment[] = [];
      const updatedIndices: Array<{ index: number; item: Equipment }> = [];
      for (const update of updates) {
        if (!update.id) continue;
        const index = db.equipment.findIndex(e => e.id.toUpperCase() === update.id.toUpperCase());
        if (index !== -1) {
          const cloned = { ...db.equipment[index] };
          if (update.xPercent !== undefined) cloned.xPercent = Math.max(0, Math.min(100, parseFloat(update.xPercent)));
          if (update.yPercent !== undefined) cloned.yPercent = Math.max(0, Math.min(100, parseFloat(update.yPercent)));
          if (update.zoneId !== undefined) cloned.zoneId = update.zoneId;
          if (update.zoneName !== undefined) cloned.zoneName = update.zoneName;
          updatedItems.push(cloned);
          updatedIndices.push({ index, item: cloned });
        }
      }

      await upsertEquipmentInTurso(updatedItems);
      markTursoWriteOk();
      for (const { index, item } of updatedIndices) {
        db.equipment[index] = item;
      }
      saveLocalDatabase(db);
      res.json({ success: true, count: updatedItems.length, equipment: updatedItems });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to update positions' });
    }
  });

  // Create new equipment point
  app.post('/api/equipment', async (req: Request, res: Response) => {
    try {
      const { id, type, subType, zoneId, zoneName, pageNumber, xPercent, yPercent, capacity, expiryDate, nextMaintenanceDate } = req.body;

      if (!id || !type || !zoneId) {
        return res.status(400).json({ error: 'Missing required equipment fields (id, type, zoneId)' });
      }

      const existingIndex = db.equipment.findIndex(e => e.id.toUpperCase() === id.trim().toUpperCase());
      if (existingIndex !== -1) {
        return res.status(409).json({ error: `Equipment ID "${id}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` });
      }

      const targetZone = ZONES.find(z => z.id === zoneId);

      const newEquip: Equipment = {
        id: id.trim().toUpperCase(),
        type: type === 'fire_hose_cabinet' ? 'fire_hose_cabinet' : 'fire_extinguisher',
        subType: subType || (type === 'fire_hose_cabinet' ? 'Fire Hose Reel & Rack' : 'Dry Chemical'),
        zoneId,
        zoneName: zoneName || targetZone?.nameTh || 'โซนคลังสินค้า CDC',
        pageNumber: pageNumber || targetZone?.pageNumber || 1,
        xPercent: Math.max(0, Math.min(100, parseFloat(xPercent) || 50)),
        yPercent: Math.max(0, Math.min(100, parseFloat(yPercent) || 50)),
        status: 'PENDING',
        lastInspectedAt: null,
        lastInspectorName: null,
        lastResult: null,
        capacity: capacity || (type === 'fire_hose_cabinet' ? '1.5" x 100 ft Hose' : '15 lbs (4A-5B)'),
        expiryDate: expiryDate || '2030-12-31',
        nextMaintenanceDate: nextMaintenanceDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      await upsertEquipmentInTurso([newEquip]);
      markTursoWriteOk();
      db.equipment.push(newEquip);
      saveLocalDatabase(db);
      res.status(201).json({ success: true, equipment: newEquip });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to create equipment' });
    }
  });

  // Delete equipment point
  app.delete('/api/equipment/:id', async (req: Request, res: Response) => {
    try {
      const index = db.equipment.findIndex(e => e.id.toUpperCase() === req.params.id.toUpperCase());
      if (index === -1) {
        return res.status(404).json({ error: `Equipment ${req.params.id} not found` });
      }

      const targetId = db.equipment[index].id;
      await deleteEquipmentInTurso(targetId);
      markTursoWriteOk();
      const deleted = db.equipment.splice(index, 1)[0];
      saveLocalDatabase(db);
      res.json({ success: true, deletedId: deleted.id });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to delete equipment' });
    }
  });

  // 6. Submit inspection (stores compressed photo inside Turso media_files)
  app.post('/api/inspections', async (req: Request, res: Response) => {
    try {
      const { equipmentId, inspectorName, inspectorRole, inspectorEmployeeId, checklist, overallResult, defectDetails, photoUrl, notes } = req.body;

      if (!equipmentId || !inspectorName || !checklist || !overallResult) {
        return res.status(400).json({ error: 'Missing required inspection fields' });
      }

      const equipIndex = db.equipment.findIndex(e => e.id.toUpperCase() === equipmentId.toUpperCase());
      if (equipIndex === -1) {
        return res.status(404).json({ error: `Equipment ${equipmentId} not found` });
      }

      const equip = { ...db.equipment[equipIndex] };
      const inspectedAt = new Date().toISOString();
      const cycle = inspectedAt.slice(0, 7);

      let storedPhotoRef = photoUrl;
      if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('data:image/')) {
        storedPhotoRef = await uploadPhotoToTursoBackend(`${equip.id}_${cycle}`, photoUrl);
        if (storedPhotoRef.startsWith('turso://')) {
          const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(photoUrl);
          if (match) {
            cacheMediaFile(storedPhotoRef.slice('turso://'.length), match[1], Buffer.from(match[2], 'base64'));
          }
        }
      }

      const inspectionRecord: InspectionRecord = {
        id: `insp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        equipmentId: equip.id,
        equipmentType: equip.type,
        zoneId: equip.zoneId,
        zoneName: equip.zoneName,
        inspectorName,
        inspectorRole: inspectorRole || 'INSPECTOR',
        inspectorEmployeeId: inspectorEmployeeId || 'INS-001',
        inspectedAt,
        cycle,
        checklist,
        overallResult,
        defectDetails: overallResult === 'FAIL' ? defectDetails : undefined,
        photoUrl: storedPhotoRef,
        notes,
      };

      let createdAction: CorrectiveAction | undefined;
      if (overallResult === 'PASS') {
        equip.status = 'READY';
        equip.lastInspectedAt = inspectedAt;
        equip.lastInspectorName = inspectorName;
        equip.lastResult = 'PASS';
        equip.activeDefectId = null;
      } else {
        equip.status = 'DEFECTIVE';
        equip.lastInspectedAt = inspectedAt;
        equip.lastInspectorName = inspectorName;
        equip.lastResult = 'FAIL';

        const actionId = `def-${equip.id.toLowerCase()}-${Date.now().toString().slice(-4)}`;
        createdAction = {
          id: actionId,
          equipmentId: equip.id,
          inspectionId: inspectionRecord.id,
          zoneId: equip.zoneId,
          zoneName: equip.zoneName,
          defectDetails: defectDetails || 'พบข้อบกพร่องตามรายการตรวจสอบ (FAIL)',
          photoEvidence: storedPhotoRef,
          reportedBy: inspectorName,
          reportedAt: inspectedAt,
          assignedTo: 'เจ้าหน้าที่ความปลอดภัย (Safety Officer / จป.)',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'OPEN',
        };
        equip.activeDefectId = actionId;
      }

      await saveInspectionMutationInTurso(inspectionRecord, equip, createdAction);
      markTursoWriteOk();

      db.inspections.unshift(inspectionRecord);
      if (createdAction) db.correctiveActions.unshift(createdAction);
      db.equipment[equipIndex] = equip;
      saveLocalDatabase(db);

      res.json({
        success: true,
        inspection: inspectionRecord,
        updatedEquipment: equip,
      });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to save inspection' });
    }
  });

  // 7. Inspections audit log
  app.get('/api/inspections', (req: Request, res: Response) => {
    let list = db.inspections;
    const { equipmentId, zoneId, result, limit } = req.query;

    if (equipmentId && typeof equipmentId === 'string') {
      list = list.filter(i => i.equipmentId.toUpperCase() === equipmentId.toUpperCase());
    }
    if (zoneId && typeof zoneId === 'string' && zoneId !== 'all') {
      list = list.filter(i => i.zoneId === zoneId);
    }
    if (result && typeof result === 'string' && result !== 'all') {
      list = list.filter(i => i.overallResult === result);
    }
    if (limit && typeof limit === 'string') {
      list = list.slice(0, parseInt(limit, 10));
    }

    res.json(list);
  });

  app.patch('/api/inspections/:id', async (req: Request, res: Response) => {
    try {
      const idx = db.inspections.findIndex(i => i.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Inspection record not found' });
      }
      const current = { ...db.inspections[idx] };
      const { overallResult, defectDetails, notes, checklist, inspectorName } = req.body;
      if (overallResult) current.overallResult = overallResult;
      if (defectDetails !== undefined) current.defectDetails = defectDetails;
      if (notes !== undefined) current.notes = notes;
      if (checklist) current.checklist = checklist;
      if (inspectorName) current.inspectorName = inspectorName;

      const equipIndex = db.equipment.findIndex(e => e.id.toUpperCase() === current.equipmentId.toUpperCase());
      let updatedEquipment: Equipment | undefined;
      if (equipIndex !== -1 && db.equipment[equipIndex].lastInspectedAt === current.inspectedAt) {
        updatedEquipment = {
          ...db.equipment[equipIndex],
          lastResult: current.overallResult,
          lastInspectorName: current.inspectorName,
          status: current.overallResult === 'PASS' ? 'READY' : 'DEFECTIVE',
        };
      }

      await updateInspectionInTurso(current, updatedEquipment);
      markTursoWriteOk();

      db.inspections[idx] = current;
      if (updatedEquipment && equipIndex !== -1) {
        db.equipment[equipIndex] = updatedEquipment;
      }
      saveLocalDatabase(db);
      res.json({ success: true, inspection: current });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to update inspection' });
    }
  });

  app.delete('/api/inspections/:id', async (req: Request, res: Response) => {
    try {
      const idx = db.inspections.findIndex(i => i.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Inspection record not found' });
      }
      await deleteInspectionInTurso(req.params.id);
      markTursoWriteOk();
      db.inspections.splice(idx, 1);
      saveLocalDatabase(db);
      res.json({ success: true, deletedId: req.params.id });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to delete inspection' });
    }
  });

  // 8. Corrective actions
  app.get('/api/corrective-actions', (req: Request, res: Response) => {
    let list = db.correctiveActions;
    const { status, zoneId } = req.query;

    if (status && typeof status === 'string' && status !== 'all') {
      list = list.filter(c => c.status === status);
    }
    if (zoneId && typeof zoneId === 'string' && zoneId !== 'all') {
      list = list.filter(c => c.zoneId === zoneId);
    }

    res.json(list);
  });

  // 9. Update corrective action (stores resolution photo in Turso media_files)
  app.patch('/api/corrective-actions/:id', async (req: Request, res: Response) => {
    try {
      const actionIndex = db.correctiveActions.findIndex(c => c.id === req.params.id);
      if (actionIndex === -1) {
        return res.status(404).json({ error: 'Corrective action not found' });
      }

      const { status, assignedTo, dueDate, resolutionNotes, resolvedPhotoUrl, resolvedBy } = req.body;
      const item = { ...db.correctiveActions[actionIndex] };

      let storedResolvedRef = resolvedPhotoUrl;
      if (resolvedPhotoUrl && typeof resolvedPhotoUrl === 'string' && resolvedPhotoUrl.startsWith('data:image/')) {
        storedResolvedRef = await uploadPhotoToTursoBackend(`${item.equipmentId}_resolved`, resolvedPhotoUrl);
        if (storedResolvedRef.startsWith('turso://')) {
          const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(resolvedPhotoUrl);
          if (match) {
            cacheMediaFile(storedResolvedRef.slice('turso://'.length), match[1], Buffer.from(match[2], 'base64'));
          }
        }
      }

      if (status) item.status = status;
      if (assignedTo) item.assignedTo = assignedTo;
      if (dueDate) item.dueDate = dueDate;
      if (resolutionNotes) item.resolutionNotes = resolutionNotes;
      if (storedResolvedRef) item.resolvedPhotoUrl = storedResolvedRef;
      if (resolvedBy) item.resolvedBy = resolvedBy;

      const equipIndex = db.equipment.findIndex(e => e.id === item.equipmentId);
      let updatedEquipment: Equipment | undefined;
      if (status === 'IN_PROGRESS' && equipIndex !== -1 && db.equipment[equipIndex].status === 'DEFECTIVE') {
        updatedEquipment = { ...db.equipment[equipIndex], status: 'IN_PROGRESS' };
      }

      await saveActionMutationInTurso(item, updatedEquipment);
      markTursoWriteOk();

      db.correctiveActions[actionIndex] = item;
      if (updatedEquipment && equipIndex !== -1) {
        db.equipment[equipIndex] = updatedEquipment;
      }
      saveLocalDatabase(db);
      res.json(item);
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to update corrective action' });
    }
  });

  // 10. Safety Officer Verification
  app.post('/api/corrective-actions/:id/verify', async (req: Request, res: Response) => {
    try {
      const actionIndex = db.correctiveActions.findIndex(c => c.id === req.params.id);
      if (actionIndex === -1) {
        return res.status(404).json({ error: 'Corrective action not found' });
      }

      const { verifiedBy } = req.body;
      const item = { ...db.correctiveActions[actionIndex] };
      item.status = 'COMPLETED';
      item.verifiedBy = verifiedBy || 'Safety Officer';
      item.verifiedAt = new Date().toISOString();

      const equipIndex = db.equipment.findIndex(e => e.id === item.equipmentId);
      let updatedEquipment: Equipment | undefined;
      if (equipIndex !== -1) {
        updatedEquipment = {
          ...db.equipment[equipIndex],
          status: 'READY',
          activeDefectId: null,
          lastResult: 'PASS',
          lastInspectedAt: new Date().toISOString(),
          lastInspectorName: `${item.verifiedBy} (Verified)`,
        };
      }

      await saveActionMutationInTurso(item, updatedEquipment);
      markTursoWriteOk();

      db.correctiveActions[actionIndex] = item;
      if (updatedEquipment && equipIndex !== -1) {
        db.equipment[equipIndex] = updatedEquipment;
      }
      saveLocalDatabase(db);
      res.json({ success: true, correctiveAction: item, updatedEquipment });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to verify corrective action' });
    }
  });

  // 11. Dashboard Metrics Aggregator
  app.get('/api/dashboard/metrics', (_req: Request, res: Response) => {
    const total = db.equipment.length;
    const ready = db.equipment.filter(e => e.status === 'READY').length;
    const defective = db.equipment.filter(e => e.status === 'DEFECTIVE').length;
    const pending = db.equipment.filter(e => e.status === 'PENDING').length;
    const inProgress = db.equipment.filter(e => e.status === 'IN_PROGRESS').length;
    const inspected = total - pending;

    const extTotal = db.equipment.filter(e => e.type === 'fire_extinguisher').length;
    const extReady = db.equipment.filter(e => e.type === 'fire_extinguisher' && e.status === 'READY').length;
    const extDefective = db.equipment.filter(e => e.type === 'fire_extinguisher' && (e.status === 'DEFECTIVE' || e.status === 'IN_PROGRESS')).length;
    const extPending = db.equipment.filter(e => e.type === 'fire_extinguisher' && e.status === 'PENDING').length;

    const fhcTotal = db.equipment.filter(e => e.type === 'fire_hose_cabinet').length;
    const fhcReady = db.equipment.filter(e => e.type === 'fire_hose_cabinet' && e.status === 'READY').length;
    const fhcDefective = db.equipment.filter(e => e.type === 'fire_hose_cabinet' && (e.status === 'DEFECTIVE' || e.status === 'IN_PROGRESS')).length;
    const fhcPending = db.equipment.filter(e => e.type === 'fire_hose_cabinet' && e.status === 'PENDING').length;

    const byZone = ZONES.map(z => {
      const zoneEquip = db.equipment.filter(e => e.zoneId === z.id);
      return {
        zoneId: z.id,
        zoneName: z.nameTh,
        pageNumber: z.pageNumber,
        extinguishers: zoneEquip.filter(e => e.type === 'fire_extinguisher').length,
        hoseCabinets: zoneEquip.filter(e => e.type === 'fire_hose_cabinet').length,
        total: zoneEquip.length,
        inspected: zoneEquip.filter(e => e.status !== 'PENDING').length,
        defective: zoneEquip.filter(e => e.status === 'DEFECTIVE' || e.status === 'IN_PROGRESS').length,
        pending: zoneEquip.filter(e => e.status === 'PENDING').length,
      };
    });

    res.json({
      totalEquipment: total,
      inspectedCount: inspected,
      readyCount: ready,
      defectiveCount: defective,
      pendingCount: pending,
      inProgressCount: inProgress,
      inspectionRate: total > 0 ? Math.round((inspected / total) * 100) : 0,
      readinessRate: total > 0 ? Math.round((ready / total) * 100) : 0,
      byType: {
        extinguisher: { total: extTotal, ready: extReady, defective: extDefective, pending: extPending },
        hoseCabinet: { total: fhcTotal, ready: fhcReady, defective: fhcDefective, pending: fhcPending },
      },
      byZone,
    });
  });

  // 12. Reset demo data (Admin utility)
  app.post('/api/reset-data', async (_req: Request, res: Response) => {
    try {
      const fresh = createSeedDatabase();
      await seedTursoDatabase(fresh);
      markTursoWriteOk();
      db = fresh;
      saveLocalDatabase(db);
      res.json({ success: true, message: 'Database reset to initial CDC warehouse state' });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      res.status(500).json({ error: err.message || 'Failed to reset database' });
    }
  });

  // Serve static public assets
  app.use('/layouts', express.static(path.join(__dirname, 'public', 'layouts')));
  app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

  return app;
}

let cachedVercelApp: express.Express | null = null;
export async function handleVercelRequest(req: Request, res: Response) {
  // Restore original /api/... path if Vercel rewrite mapped to /api/index?__path=...
  if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      if (parsed.searchParams.has('__path')) {
        const subPath = parsed.searchParams.get('__path') || '';
        parsed.searchParams.delete('__path');
        const remainingQuery = parsed.searchParams.toString();
        const isRewrittenIndex =
          parsed.pathname === '/api/index' ||
          parsed.pathname === '/api/index/' ||
          parsed.pathname === '/api';
        if (isRewrittenIndex) {
          const cleanSub = subPath.replace(/^\/+/, '');
          req.url = `/api${cleanSub ? `/${cleanSub}` : ''}${remainingQuery ? `?${remainingQuery}` : ''}`;
        } else {
          req.url = `${parsed.pathname}${remainingQuery ? `?${remainingQuery}` : ''}`;
        }
      }
    } catch {
      // Keep original req.url if URL parsing fails
    }
  }

  if (!cachedVercelApp) {
    cachedVercelApp = createExpressApp();
  }
  await ensureTursoBootstrap();
  return cachedVercelApp(req, res);
}

async function startServer() {
  await ensureTursoBootstrap();
  const app = createExpressApp();

  // Vite integration (only loaded in development; dynamic specifier keeps Vite out of serverless bundles)
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Warehouse Fire Safety Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!isVercel) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
