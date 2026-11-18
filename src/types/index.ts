export type EquipmentType = 'fire_extinguisher' | 'fire_hose_cabinet';

export type InspectionStatus = 'READY' | 'DEFECTIVE' | 'PENDING' | 'IN_PROGRESS';

export type ChecklistResult = 'PASS' | 'FAIL' | 'NA';

export type UserRole = 'ADMIN' | 'SAFETY_OFFICER' | 'INSPECTOR' | 'VISITOR';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  roleNameTh: string;
  avatarUrl?: string;
  employeeId: string;
  department?: string;
}

export interface ZoneInfo {
  id: string;
  pageNumber: number;
  nameTh: string;
  nameEn: string;
  shortName?: string;
  floor: string;
  description: string;
  imagePath: string;
}

export interface Equipment {
  id: string;
  type: EquipmentType;
  subType: string;
  zoneId: string;
  zoneName: string;
  pageNumber: number;
  xPercent: number; // 0 - 100 on layout
  yPercent: number; // 0 - 100 on layout
  status: InspectionStatus;
  lastInspectedAt: string | null;
  lastInspectorName: string | null;
  lastResult: 'PASS' | 'FAIL' | null;
  activeDefectId?: string | null;
  capacity?: string;
  expiryDate?: string;
  nextMaintenanceDate?: string;
}

export interface ChecklistItemDef {
  id: string;
  titleTh: string;
  titleEn: string;
  descriptionTh?: string;
}

export interface InspectionChecklistEntry {
  itemId: string;
  itemTitle: string;
  result: ChecklistResult;
  notes?: string;
}

export interface InspectionRecord {
  id: string;
  equipmentId: string;
  equipmentType: EquipmentType;
  zoneId: string;
  zoneName: string;
  inspectorName: string;
  inspectorRole: UserRole;
  inspectorEmployeeId: string;
  inspectedAt: string;
  cycle: string; // e.g. "2026-11"
  checklist: InspectionChecklistEntry[];
  overallResult: 'PASS' | 'FAIL';
  defectDetails?: string;
  photoUrl?: string;
  notes?: string;
}

export interface CorrectiveAction {
  id: string;
  equipmentId: string;
  inspectionId: string;
  zoneId: string;
  zoneName: string;
  defectDetails: string;
  photoEvidence?: string;
  reportedBy: string;
  reportedAt: string;
  assignedTo: string;
  dueDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  resolutionNotes?: string;
  resolvedPhotoUrl?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface DashboardMetrics {
  totalEquipment: number;
  inspectedCount: number;
  readyCount: number;
  defectiveCount: number;
  pendingCount: number;
  inProgressCount: number;
  inspectionRate: number; // 0 - 100%
  readinessRate: number; // 0 - 100%
  byType: {
    extinguisher: { total: number; ready: number; defective: number; pending: number };
    hoseCabinet: { total: number; ready: number; defective: number; pending: number };
  };
  byZone: Array<{
    zoneId: string;
    zoneName: string;
    pageNumber?: number;
    extinguishers?: number;
    hoseCabinets?: number;
    total: number;
    inspected: number;
    defective: number;
    pending: number;
  }>;
}
