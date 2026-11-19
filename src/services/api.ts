import { Equipment, InspectionRecord, CorrectiveAction, DashboardMetrics, ZoneInfo, User } from '../types';

async function parseJsonResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  const trimmed = text.trim();
  const looksLikeJson = contentType.includes('application/json') || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (!res.ok) {
    if (looksLikeJson) {
      try {
        const parsed = JSON.parse(trimmed) as { error?: string };
        throw new Error(parsed.error || fallbackError);
      } catch (e) {
        if (e instanceof Error && e.message !== fallbackError && !e.message.startsWith('Unexpected')) {
          throw e;
        }
      }
    }
    throw new Error(`${fallbackError} (${res.status})`);
  }

  if (!looksLikeJson) {
    throw new Error(`${fallbackError}: server returned non-JSON response (${res.status})`);
  }

  return JSON.parse(trimmed) as T;
}

export const api = {
  async getZones(): Promise<ZoneInfo[]> {
    const res = await fetch('/api/zones', { cache: 'no-store' });
    return parseJsonResponse<ZoneInfo[]>(res, 'Failed to fetch zones');
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users', { cache: 'no-store' });
    return parseJsonResponse<User[]>(res, 'Failed to fetch users');
  },

  async getEquipment(params?: { zoneId?: string; status?: string; type?: string; search?: string }): Promise<Equipment[]> {
    const query = new URLSearchParams();
    if (params?.zoneId && params.zoneId !== 'all') query.set('zoneId', params.zoneId);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.type && params.type !== 'all') query.set('type', params.type);
    if (params?.search) query.set('search', params.search);

    const qs = query.toString();
    const res = await fetch(qs ? `/api/equipment?${qs}` : '/api/equipment', { cache: 'no-store' });
    return parseJsonResponse<Equipment[]>(res, 'Failed to fetch equipment');
  },

  async getEquipmentById(id: string): Promise<{ equipment: Equipment; history: InspectionRecord[]; activeDefect?: CorrectiveAction }> {
    const res = await fetch(`/api/equipment/${encodeURIComponent(id)}`, { cache: 'no-store' });
    return parseJsonResponse<{ equipment: Equipment; history: InspectionRecord[]; activeDefect?: CorrectiveAction }>(
      res,
      `Equipment ${id} not found`
    );
  },

  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<{ success: boolean; equipment: Equipment }> {
    const res = await fetch(`/api/equipment/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonResponse<{ success: boolean; equipment: Equipment }>(res, 'Failed to update equipment');
  },

  async batchUpdateEquipmentPositions(
    updates: Array<{ id: string; xPercent: number; yPercent: number; zoneId?: string; zoneName?: string }>
  ): Promise<{ success: boolean; count: number; equipment: Equipment[] }> {
    const res = await fetch('/api/equipment/batch-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    return parseJsonResponse<{ success: boolean; count: number; equipment: Equipment[] }>(
      res,
      'Failed to batch update equipment positions'
    );
  },

  async createEquipment(
    data: Partial<Equipment> & { id: string; type: Equipment['type']; zoneId: string }
  ): Promise<{ success: boolean; equipment: Equipment }> {
    const res = await fetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<{ success: boolean; equipment: Equipment }>(res, 'Failed to create equipment');
  },

  async deleteEquipment(id: string): Promise<{ success: boolean; deletedId: string }> {
    const res = await fetch(`/api/equipment/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return parseJsonResponse<{ success: boolean; deletedId: string }>(res, 'Failed to delete equipment');
  },

  async submitInspection(data: {
    equipmentId: string;
    inspectorName: string;
    inspectorRole: string;
    inspectorEmployeeId: string;
    checklist: Array<{ itemId: string; itemTitle: string; result: 'PASS' | 'FAIL' | 'NA'; notes?: string }>;
    overallResult: 'PASS' | 'FAIL';
    defectDetails?: string;
    photoUrl?: string;
    notes?: string;
  }): Promise<{ success: boolean; inspection: InspectionRecord; updatedEquipment: Equipment }> {
    const res = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<{ success: boolean; inspection: InspectionRecord; updatedEquipment: Equipment }>(
      res,
      'Failed to submit inspection'
    );
  },

  async getInspections(params?: { equipmentId?: string; zoneId?: string; result?: string; limit?: number }): Promise<InspectionRecord[]> {
    const query = new URLSearchParams();
    if (params?.equipmentId) query.set('equipmentId', params.equipmentId);
    if (params?.zoneId && params.zoneId !== 'all') query.set('zoneId', params.zoneId);
    if (params?.result && params.result !== 'all') query.set('result', params.result);
    if (params?.limit) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const res = await fetch(qs ? `/api/inspections?${qs}` : '/api/inspections', { cache: 'no-store' });
    return parseJsonResponse<InspectionRecord[]>(res, 'Failed to fetch inspections');
  },

  async getCorrectiveActions(params?: { status?: string; zoneId?: string }): Promise<CorrectiveAction[]> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.zoneId && params.zoneId !== 'all') query.set('zoneId', params.zoneId);

    const qs = query.toString();
    const res = await fetch(qs ? `/api/corrective-actions?${qs}` : '/api/corrective-actions', { cache: 'no-store' });
    return parseJsonResponse<CorrectiveAction[]>(res, 'Failed to fetch corrective actions');
  },

  async updateCorrectiveAction(id: string, updates: Partial<CorrectiveAction>): Promise<CorrectiveAction> {
    const res = await fetch(`/api/corrective-actions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonResponse<CorrectiveAction>(res, 'Failed to update corrective action');
  },

  async verifyCorrectiveAction(
    id: string,
    verifiedBy: string
  ): Promise<{ success: boolean; correctiveAction: CorrectiveAction; updatedEquipment?: Equipment }> {
    const res = await fetch(`/api/corrective-actions/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifiedBy }),
    });
    return parseJsonResponse<{ success: boolean; correctiveAction: CorrectiveAction; updatedEquipment?: Equipment }>(
      res,
      'Failed to verify corrective action'
    );
  },

  async getMetrics(): Promise<DashboardMetrics> {
    const res = await fetch('/api/dashboard/metrics', { cache: 'no-store' });
    return parseJsonResponse<DashboardMetrics>(res, 'Failed to fetch dashboard metrics');
  },

  async login(username: string, password: string): Promise<{ success: boolean; user: User; role: User['role'] }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return parseJsonResponse<{ success: boolean; user: User; role: User['role'] }>(
      res,
      'User ID หรือ Password ไม่ถูกต้อง'
    );
  },

  async updateInspection(id: string, updates: Partial<InspectionRecord>): Promise<{ success: boolean; inspection: InspectionRecord }> {
    const res = await fetch(`/api/inspections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonResponse<{ success: boolean; inspection: InspectionRecord }>(res, 'Failed to update inspection record');
  },

  async deleteInspection(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/inspections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return parseJsonResponse<{ success: boolean }>(res, 'Failed to delete inspection record');
  },

  async createUser(data: Omit<User, 'id'>): Promise<{ success: boolean; user: User }> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonResponse<{ success: boolean; user: User }>(res, 'Failed to create user');
  },

  async updateUser(id: string, updates: Partial<User>): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonResponse<{ success: boolean; user: User }>(res, 'Failed to update user');
  },

  async deleteUser(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return parseJsonResponse<{ success: boolean }>(res, 'Failed to delete user');
  },

  async resetData(): Promise<void> {
    const res = await fetch('/api/reset-data', { method: 'POST' });
    await parseJsonResponse<{ success: boolean }>(res, 'Failed to reset database');
  },
};
