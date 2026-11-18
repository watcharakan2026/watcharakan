import { generateInitialEquipment, ZONES, INITIAL_USERS } from '../src/data/warehouseData.ts';
import { Equipment, InspectionRecord, CorrectiveAction, User } from '../src/types/index.ts';
import {
  setRuntimeTursoEnv,
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
  type WorkspaceDatabaseState,
} from './tursoDb.ts';

export interface CloudflareEnv {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  ASSETS?: { fetch: (input: Request | URL | string) => Promise<Response> };
}

function createSeedDatabase(): WorkspaceDatabaseState {
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

let db: WorkspaceDatabaseState = createSeedDatabase();
let tursoConnected = false;
let tursoError: string | null = null;
let lastTursoRefreshAt = 0;
let bootstrapPromise: Promise<void> | null = null;
let lastBootstrapAttemptAt = 0;
let refreshPromise: Promise<void> | null = null;

const mediaCache = new Map<string, { contentType: string; bytes: Uint8Array<ArrayBuffer> }>();
function cacheMediaFile(fileId: string, contentType: string, bytes: Uint8Array<ArrayBuffer>) {
  if (mediaCache.size >= 80) {
    const oldest = mediaCache.keys().next().value;
    if (oldest) mediaCache.delete(oldest);
  }
  mediaCache.set(fileId, { contentType, bytes });
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64);
  const buffer = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function bootstrapTurso(): Promise<void> {
  if (getBackendDbMode() === 'local_json') {
    tursoConnected = false;
    tursoError = null;
    return;
  }
  try {
    const remote = await loadFromTursoBackend(db);
    if (remote) {
      db = remote;
      tursoConnected = true;
      tursoError = null;
      lastTursoRefreshAt = Date.now();
    }
  } catch (err: any) {
    tursoConnected = false;
    tursoError = err?.message || String(err);
  }
}

async function ensureTursoReady(): Promise<void> {
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
    bootstrapPromise = bootstrapTurso();
  }
  await bootstrapPromise;

  if (mode === 'turso' && tursoConnected && Date.now() - lastTursoRefreshAt > 1500) {
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readJsonBody(request: Request): Promise<Record<string, any>> {
  try {
    return (await request.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

export async function handleCloudflareApiRequest(
  request: Request,
  env?: CloudflareEnv
): Promise<Response> {
  setRuntimeTursoEnv(env);
  await ensureTursoReady();

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  // 1. Health
  if (method === 'GET' && pathname === '/api/health') {
    const cfg = getTursoConfig();
    return jsonResponse({
      status: 'ok',
      runtime: 'cloudflare-workers',
      backendMode: getBackendDbMode(),
      envConfigured: Boolean(cfg?.url),
      hasAuthToken: Boolean(cfg?.authToken),
      tursoConnected,
      tursoError,
      equipmentCount: db.equipment.length,
      time: new Date().toISOString(),
    });
  }

  // 1b. Media streaming (/api/media/:fileId & /api/drive-file/:fileId)
  if (method === 'GET' && (pathname.startsWith('/api/media/') || pathname.startsWith('/api/drive-file/'))) {
    const prefix = pathname.startsWith('/api/media/') ? '/api/media/' : '/api/drive-file/';
    const fileId = decodeURIComponent(pathname.slice(prefix.length));
    const cached = mediaCache.get(fileId);
    if (cached) {
      return new Response(cached.bytes, {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
    try {
      const { contentType, bytes } = await fetchMediaFromTursoBackend(fileId);
      cacheMediaFile(fileId, contentType, bytes);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch (err: any) {
      return jsonResponse({ error: err?.message || 'Photo not found' }, 404);
    }
  }

  // 2. Zones
  if (method === 'GET' && pathname === '/api/zones') {
    return jsonResponse(ZONES);
  }

  // 3. Auth
  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJsonBody(request);
    const u = String(body.username || '').trim();
    const p = String(body.password || '').trim();

    if (u === 'admin_cj' && p === '2026') {
      const user = db.users.find(usr => usr.username === 'admin_cj') || {
        id: 'u-admin',
        username: 'admin_cj',
        name: 'ผู้ดูแลระบบ (Admin CJ)',
        role: 'ADMIN',
        roleNameTh: 'ผู้ดูแลระบบ (ADMIN)',
        employeeId: 'ADM-001',
      };
      return jsonResponse({ success: true, user, role: 'ADMIN' });
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
      return jsonResponse({ success: true, user, role: 'INSPECTOR' });
    }

    return jsonResponse({ error: 'User ID หรือ Password ไม่ถูกต้อง' }, 401);
  }

  // 3b. Users
  if (method === 'GET' && pathname === '/api/users') {
    return jsonResponse(db.users);
  }

  if (method === 'POST' && pathname === '/api/users') {
    try {
      const { username, name, role, roleNameTh, employeeId } = await readJsonBody(request);
      if (!username || !name || !role) {
        return jsonResponse({ error: 'Missing required user fields' }, 400);
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
      return jsonResponse({ success: true, user: newUser }, 201);
    } catch (err: any) {
      tursoError = err?.message || String(err);
      return jsonResponse({ error: err?.message || 'Failed to save user' }, 500);
    }
  }

  if (pathname.startsWith('/api/users/')) {
    const userId = decodeURIComponent(pathname.slice('/api/users/'.length));
    if (method === 'PATCH') {
      try {
        const idx = db.users.findIndex(u => u.id === userId);
        if (idx === -1) return jsonResponse({ error: 'User not found' }, 404);
        const current = { ...db.users[idx] };
        const { name, role, roleNameTh, employeeId } = await readJsonBody(request);
        if (name) current.name = name;
        if (role) current.role = role;
        if (roleNameTh) current.roleNameTh = roleNameTh;
        if (employeeId) current.employeeId = employeeId;

        await upsertUserInTurso(current);
        markTursoWriteOk();
        db.users[idx] = current;
        return jsonResponse({ success: true, user: current });
      } catch (err: any) {
        tursoError = err?.message || String(err);
        return jsonResponse({ error: err?.message || 'Failed to update user' }, 500);
      }
    }
    if (method === 'DELETE') {
      try {
        const idx = db.users.findIndex(u => u.id === userId);
        if (idx === -1) return jsonResponse({ error: 'User not found' }, 404);
        await deleteUserInTurso(userId);
        markTursoWriteOk();
        db.users.splice(idx, 1);
        return jsonResponse({ success: true });
      } catch (err: any) {
        tursoError = err?.message || String(err);
        return jsonResponse({ error: err?.message || 'Failed to delete user' }, 500);
      }
    }
  }

  // 4. Equipment collection & batch-positions
  if (method === 'POST' && pathname === '/api/equipment/batch-positions') {
    try {
      const { updates } = await readJsonBody(request);
      if (!Array.isArray(updates)) {
        return jsonResponse({ error: 'Expected updates array' }, 400);
      }
      const updatedItems: Equipment[] = [];
      const updatedIndices: Array<{ index: number; item: Equipment }> = [];
      for (const update of updates) {
        if (!update?.id) continue;
        const index = db.equipment.findIndex(e => e.id.toUpperCase() === String(update.id).toUpperCase());
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
      return jsonResponse({ success: true, count: updatedItems.length, equipment: updatedItems });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      return jsonResponse({ error: err?.message || 'Failed to update positions' }, 500);
    }
  }

  if (method === 'GET' && pathname === '/api/equipment') {
    let result = db.equipment;
    const zoneId = url.searchParams.get('zoneId');
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search');

    if (zoneId && zoneId !== 'all') result = result.filter(e => e.zoneId === zoneId);
    if (status && status !== 'all') result = result.filter(e => e.status === status);
    if (type && type !== 'all') result = result.filter(e => e.type === type);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        e => e.id.toLowerCase().includes(q) || e.subType.toLowerCase().includes(q) || e.zoneName.toLowerCase().includes(q)
      );
    }
    return jsonResponse(result);
  }

  if (method === 'POST' && pathname === '/api/equipment') {
    try {
      const { id, type, subType, zoneId, zoneName, pageNumber, xPercent, yPercent, capacity, expiryDate, nextMaintenanceDate } =
        await readJsonBody(request);
      if (!id || !type || !zoneId) {
        return jsonResponse({ error: 'Missing required equipment fields (id, type, zoneId)' }, 400);
      }
      const existingIndex = db.equipment.findIndex(e => e.id.toUpperCase() === String(id).trim().toUpperCase());
      if (existingIndex !== -1) {
        return jsonResponse({ error: `Equipment ID "${id}" มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น` }, 409);
      }
      const targetZone = ZONES.find(z => z.id === zoneId);
      const newEquip: Equipment = {
        id: String(id).trim().toUpperCase(),
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
        nextMaintenanceDate:
          nextMaintenanceDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      await upsertEquipmentInTurso([newEquip]);
      markTursoWriteOk();
      db.equipment.push(newEquip);
      return jsonResponse({ success: true, equipment: newEquip }, 201);
    } catch (err: any) {
      tursoError = err?.message || String(err);
      return jsonResponse({ error: err?.message || 'Failed to create equipment' }, 500);
    }
  }

  // 5. Single equipment by ID
  if (pathname.startsWith('/api/equipment/')) {
    const equipId = decodeURIComponent(pathname.slice('/api/equipment/'.length));
    if (method === 'GET') {
      const equip = db.equipment.find(e => e.id.toUpperCase() === equipId.toUpperCase());
      if (!equip) return jsonResponse({ error: `Equipment ${equipId} not found` }, 404);
      const history = db.inspections
        .filter(i => i.equipmentId.toUpperCase() === equipId.toUpperCase())
        .sort((a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime());
      const activeDefect = db.correctiveActions.find(
        c => c.equipmentId.toUpperCase() === equipId.toUpperCase() && c.status !== 'COMPLETED'
      );
      return jsonResponse({ equipment: equip, history, activeDefect });
    }
    if (method === 'PATCH') {
      try {
        const equipIndex = db.equipment.findIndex(e => e.id.toUpperCase() === equipId.toUpperCase());
        if (equipIndex === -1) return jsonResponse({ error: `Equipment ${equipId} not found` }, 404);
        const current = { ...db.equipment[equipIndex] };
        const { xPercent, yPercent, subType, type, zoneId, zoneName, pageNumber, status, capacity, expiryDate, nextMaintenanceDate } =
          await readJsonBody(request);

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

        await upsertEquipmentInTurso([current]);
        markTursoWriteOk();
        db.equipment[equipIndex] = current;
        return jsonResponse({ success: true, equipment: current });
      } catch (err: any) {
        tursoError = err?.message || String(err);
        return jsonResponse({ error: err?.message || 'Failed to update equipment' }, 500);
      }
    }
    if (method === 'DELETE') {
      try {
        const index = db.equipment.findIndex(e => e.id.toUpperCase() === equipId.toUpperCase());
        if (index === -1) return jsonResponse({ error: `Equipment ${equipId} not found` }, 404);
        const targetId = db.equipment[index].id;
        await deleteEquipmentInTurso(targetId);
        markTursoWriteOk();
        const deleted = db.equipment.splice(index, 1)[0];
        return jsonResponse({ success: true, deletedId: deleted.id });
      } catch (err: any) {
        tursoError = err?.message || String(err);
        return jsonResponse({ error: err?.message || 'Failed to delete equipment' }, 500);
      }
    }
  }

  // 6 & 7. Inspections
  if (method === 'POST' && pathname === '/api/inspections') {
    try {
      const { equipmentId, inspectorName, inspectorRole, inspectorEmployeeId, checklist, overallResult, defectDetails, photoUrl, notes } =
        await readJsonBody(request);
      if (!equipmentId || !inspectorName || !checklist || !overallResult) {
        return jsonResponse({ error: 'Missing required inspection fields' }, 400);
      }
      const equipIndex = db.equipment.findIndex(e => e.id.toUpperCase() === String(equipmentId).toUpperCase());
      if (equipIndex === -1) {
        return jsonResponse({ error: `Equipment ${equipmentId} not found` }, 404);
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
            cacheMediaFile(storedPhotoRef.slice('turso://'.length), match[1], base64ToUint8Array(match[2]));
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

      return jsonResponse({ success: true, inspection: inspectionRecord, updatedEquipment: equip });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      return jsonResponse({ error: err?.message || 'Failed to save inspection' }, 500);
    }
  }

  if (method === 'GET' && pathname === '/api/inspections') {
    let list = db.inspections;
    const equipmentId = url.searchParams.get('equipmentId');
    const zoneId = url.searchParams.get('zoneId');
    const result = url.searchParams.get('result');
    const limit = url.searchParams.get('limit');

    if (equipmentId) list = list.filter(i => i.equipmentId.toUpperCase() === equipmentId.toUpperCase());
    if (zoneId && zoneId !== 'all') list = list.filter(i => i.zoneId === zoneId);
    if (result && result !== 'all') list = list.filter(i => i.overallResult === result);
    if (limit) list = list.slice(0, parseInt(limit, 10));

    return jsonResponse(list);
  }

  if (pathname.startsWith('/api/inspections/')) {
    const inspId = decodeURIComponent(pathname.slice('/api/inspections/'.length));
    if (method === 'PATCH') {
      try {
        const idx = db.inspections.findIndex(i => i.id === inspId);
        if (idx === -1) return jsonResponse({ error: 'Inspection record not found' }, 404);
        const current = { ...db.inspections[idx] };
        const { overallResult, defectDetails, notes, checklist, inspectorName } = await readJsonBody(request);
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
            status: current.overallResult === 'PASS' ? 'READY' : 'DEFECTIVE',
          };
        }

        await updateInspectionInTurso(current, updatedEquipment);
        markTursoWriteOk();

        db.inspections[idx] = current;
        if (updatedEquipment && equipIndex !== -1) {
          db.equipment[equipIndex] = updatedEquipment;
        }
        return jsonResponse({ success: true, inspection: current });
      } catch (err: any) {
        tursoError = err?.message || String(err);
        return jsonResponse({ error: err?.message || 'Failed to update inspection' }, 500);
      }
    }
    if (method === 'DELETE') {
      try {
        const idx = db.inspections.findIndex(i => i.id === inspId);
        if (idx === -1) return jsonResponse({ error: 'Inspection record not found' }, 404);
        await deleteInspectionInTurso(inspId);
        markTursoWriteOk();
        db.inspections.splice(idx, 1);
        return jsonResponse({ success: true, deletedId: inspId });
      } catch (err: any) {
        tursoError = err?.message || String(err);
        return jsonResponse({ error: err?.message || 'Failed to delete inspection' }, 500);
      }
    }
  }

  // 8, 9, 10. Corrective actions
  if (method === 'GET' && pathname === '/api/corrective-actions') {
    let list = db.correctiveActions;
    const status = url.searchParams.get('status');
    const zoneId = url.searchParams.get('zoneId');
    if (status && status !== 'all') list = list.filter(c => c.status === status);
    if (zoneId && zoneId !== 'all') list = list.filter(c => c.zoneId === zoneId);
    return jsonResponse(list);
  }

  if (method === 'POST' && pathname.startsWith('/api/corrective-actions/') && pathname.endsWith('/verify')) {
    try {
      const actionId = decodeURIComponent(
        pathname.slice('/api/corrective-actions/'.length, pathname.length - '/verify'.length)
      );
      const actionIndex = db.correctiveActions.findIndex(c => c.id === actionId);
      if (actionIndex === -1) return jsonResponse({ error: 'Corrective action not found' }, 404);

      const { verifiedBy } = await readJsonBody(request);
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
      return jsonResponse({ success: true, correctiveAction: item, updatedEquipment });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      return jsonResponse({ error: err?.message || 'Failed to verify corrective action' }, 500);
    }
  }

  if (method === 'PATCH' && pathname.startsWith('/api/corrective-actions/')) {
    try {
      const actionId = decodeURIComponent(pathname.slice('/api/corrective-actions/'.length));
      const actionIndex = db.correctiveActions.findIndex(c => c.id === actionId);
      if (actionIndex === -1) return jsonResponse({ error: 'Corrective action not found' }, 404);

      const { status, assignedTo, dueDate, resolutionNotes, resolvedPhotoUrl, resolvedBy } =
        await readJsonBody(request);
      const item = { ...db.correctiveActions[actionIndex] };

      let storedResolvedRef = resolvedPhotoUrl;
      if (resolvedPhotoUrl && typeof resolvedPhotoUrl === 'string' && resolvedPhotoUrl.startsWith('data:image/')) {
        storedResolvedRef = await uploadPhotoToTursoBackend(`${item.equipmentId}_resolved`, resolvedPhotoUrl);
        if (storedResolvedRef.startsWith('turso://')) {
          const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(resolvedPhotoUrl);
          if (match) {
            cacheMediaFile(storedResolvedRef.slice('turso://'.length), match[1], base64ToUint8Array(match[2]));
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
      return jsonResponse(item);
    } catch (err: any) {
      tursoError = err?.message || String(err);
      return jsonResponse({ error: err?.message || 'Failed to update corrective action' }, 500);
    }
  }

  // 11. Dashboard Metrics
  if (method === 'GET' && pathname === '/api/dashboard/metrics') {
    const total = db.equipment.length;
    const ready = db.equipment.filter(e => e.status === 'READY').length;
    const defective = db.equipment.filter(e => e.status === 'DEFECTIVE').length;
    const pending = db.equipment.filter(e => e.status === 'PENDING').length;
    const inProgress = db.equipment.filter(e => e.status === 'IN_PROGRESS').length;
    const inspected = total - pending;

    const extTotal = db.equipment.filter(e => e.type === 'fire_extinguisher').length;
    const extReady = db.equipment.filter(e => e.type === 'fire_extinguisher' && e.status === 'READY').length;
    const extDefective = db.equipment.filter(
      e => e.type === 'fire_extinguisher' && (e.status === 'DEFECTIVE' || e.status === 'IN_PROGRESS')
    ).length;
    const extPending = db.equipment.filter(e => e.type === 'fire_extinguisher' && e.status === 'PENDING').length;

    const fhcTotal = db.equipment.filter(e => e.type === 'fire_hose_cabinet').length;
    const fhcReady = db.equipment.filter(e => e.type === 'fire_hose_cabinet' && e.status === 'READY').length;
    const fhcDefective = db.equipment.filter(
      e => e.type === 'fire_hose_cabinet' && (e.status === 'DEFECTIVE' || e.status === 'IN_PROGRESS')
    ).length;
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

    return jsonResponse({
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
  }

  // 12. Reset demo data
  if (method === 'POST' && pathname === '/api/reset-data') {
    try {
      const fresh = createSeedDatabase();
      await seedTursoDatabase(fresh);
      markTursoWriteOk();
      db = fresh;
      return jsonResponse({ success: true, message: 'Database reset to initial CDC warehouse state' });
    } catch (err: any) {
      tursoError = err?.message || String(err);
      return jsonResponse({ error: err?.message || 'Failed to reset database' }, 500);
    }
  }

  return jsonResponse({ error: `API route not found: ${method} ${pathname}` }, 404);
}
