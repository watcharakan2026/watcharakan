import { Equipment, InspectionRecord, CorrectiveAction, DashboardMetrics, ZoneInfo, User } from '../types';

export const api = {
  async getZones(): Promise<ZoneInfo[]> {
    const res = await fetch('/api/zones', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch zones');
    return res.json();
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async getEquipment(params?: { zoneId?: string; status?: string; type?: string; search?: string }): Promise<Equipment[]> {
    const query = new URLSearchParams();
    if (params?.zoneId && params.zoneId !== 'all') query.set('zoneId', params.zoneId);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.type && params.type !== 'all') query.set('type', params.type);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`/api/equipment?${query.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch equipment');
    return res.json();
  },

  async getEquipmentById(id: string): Promise<{ equipment: Equipment; history: InspectionRecord[]; activeDefect?: CorrectiveAction }> {
    const res = await fetch(`/api/equipment/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Equipment ${id} not found`);
    return res.json();
  },

  async updateEquipment(id: string, updates: Partial<Equipment>): Promise<{ success: boolean; equipment: Equipment }> {
    const res = await fetch(`/api/equipment/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update equipment' }));
      throw new Error(err.error || 'Failed to update equipment');
    }
    return res.json();
  },

  async batchUpdateEquipmentPositions(
    updates: Array<{ id: string; xPercent: number; yPercent: number; zoneId?: string; zoneName?: string }>
  ): Promise<{ success: boolean; count: number; equipment: Equipment[] }> {
    const res = await fetch('/api/equipment/batch-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to batch update equipment positions' }));
      throw new Error(err.error || 'Failed to batch update equipment positions');
    }
    return res.json();
  },

  async createEquipment(
    data: Partial<Equipment> & { id: string; type: Equipment['type']; zoneId: string }
  ): Promise<{ success: boolean; equipment: Equipment }> {
    const res = await fetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create equipment' }));
      throw new Error(err.error || 'Failed to create equipment');
    }
    return res.json();
  },

  async deleteEquipment(id: string): Promise<{ success: boolean; deletedId: string }> {
    const res = await fetch(`/api/equipment/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete equipment' }));
      throw new Error(err.error || 'Failed to delete equipment');
    }
    return res.json();
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit inspection' }));
      throw new Error(err.error || 'Failed to submit inspection');
    }
    return res.json();
  },

  async getInspections(params?: { equipmentId?: string; zoneId?: string; result?: string; limit?: number }): Promise<InspectionRecord[]> {
    const query = new URLSearchParams();
    if (params?.equipmentId) query.set('equipmentId', params.equipmentId);
    if (params?.zoneId && params.zoneId !== 'all') query.set('zoneId', params.zoneId);
    if (params?.result && params.result !== 'all') query.set('result', params.result);
    if (params?.limit) query.set('limit', params.limit.toString());

    const res = await fetch(`/api/inspections?${query.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch inspections');
    return res.json();
  },

  async getCorrectiveActions(params?: { status?: string; zoneId?: string }): Promise<CorrectiveAction[]> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.zoneId && params.zoneId !== 'all') query.set('zoneId', params.zoneId);

    const res = await fetch(`/api/corrective-actions?${query.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch corrective actions');
    return res.json();
  },

  async updateCorrectiveAction(id: string, updates: Partial<CorrectiveAction>): Promise<CorrectiveAction> {
    const res = await fetch(`/api/corrective-actions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update corrective action');
    return res.json();
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
    if (!res.ok) throw new Error('Failed to verify corrective action');
    return res.json();
  },

  async getMetrics(): Promise<DashboardMetrics> {
    const res = await fetch('/api/dashboard/metrics', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
    return res.json();
  },

  async login(username: string, password: string): Promise<{ success: boolean; user: User; role: User['role'] }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'เข้าสู่ระบบไม่สำเร็จ' }));
      throw new Error(err.error || 'User ID หรือ Password ไม่ถูกต้อง');
    }
    return res.json();
  },

  async updateInspection(id: string, updates: Partial<InspectionRecord>): Promise<{ success: boolean; inspection: InspectionRecord }> {
    const res = await fetch(`/api/inspections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update inspection record');
    return res.json();
  },

  async deleteInspection(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/inspections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete inspection record');
    return res.json();
  },

  async createUser(data: Omit<User, 'id'>): Promise<{ success: boolean; user: User }> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },

  async updateUser(id: string, updates: Partial<User>): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
  },

  async deleteUser(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
  },

  async resetData(): Promise<void> {
    await fetch('/api/reset-data', { method: 'POST' });
  },
};
