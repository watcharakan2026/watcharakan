import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Flame, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  QrCode, 
  Edit3,
  Save,
  Trash2,
  Check,
  RotateCcw,
  ShieldCheck,
  Lock,
  Calendar,
  UserCheck,
  ChevronRight,
  Eye,
  Info
} from 'lucide-react';
import { Equipment, InspectionRecord, CorrectiveAction, ZoneInfo, UserRole } from '../types';
import { api } from '../services/api';
import { DriveImage } from './DriveImage';
import {
  AGENT_OPTIONS,
  normalizeAgentSubType,
  getDefaultCapacityForAgent,
  resolveEquipmentCapacity,
} from '../utils/equipmentAgents';

interface EquipmentDetailModalProps {
  equipment: Equipment;
  zones?: ZoneInfo[];
  onClose: () => void;
  onInspect: (equipment: Equipment) => void;
  onEquipmentUpdated?: (updated: Equipment) => void;
  onEquipmentDeleted?: (id: string) => void;
  isOwner?: boolean;
  userRole?: UserRole;
  isQrVerified?: boolean;
  onOpenScanner?: () => void;
  onRequestOwnerLogin?: () => void;
}

export const EquipmentDetailModal: React.FC<EquipmentDetailModalProps> = ({
  equipment,
  zones = [],
  onClose,
  onInspect,
  onEquipmentUpdated,
  onEquipmentDeleted,
  isOwner = false,
  userRole = 'VISITOR',
  isQrVerified = false,
  onOpenScanner,
  onRequestOwnerLogin,
}) => {
  const isAdmin = userRole === 'ADMIN' || (isOwner && userRole !== 'INSPECTOR');
  const isInspector = userRole === 'INSPECTOR';
  const isVisitor = userRole === 'VISITOR' || (!isAdmin && !isInspector);

  const [currentEquip, setCurrentEquip] = useState<Equipment>(equipment);
  const [history, setHistory] = useState<InspectionRecord[]>([]);
  const [activeDefect, setActiveDefect] = useState<CorrectiveAction | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMonthCycle, setSelectedMonthCycle] = useState<string>('latest');

  // Edit Mode State (Only accessible to Owner)
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editSubType, setEditSubType] = useState<string>(() =>
    equipment.type === 'fire_extinguisher' ? normalizeAgentSubType(equipment.subType) : equipment.subType
  );
  const [editCapacity, setEditCapacity] = useState<string>(() =>
    equipment.type === 'fire_extinguisher'
      ? resolveEquipmentCapacity(equipment.subType, equipment.capacity)
      : equipment.capacity || '15 lbs (4A-5B)'
  );
  const [editZoneId, setEditZoneId] = useState<string>(equipment.zoneId);
  const [editStatus, setEditStatus] = useState<Equipment['status']>(equipment.status);
  const [editExpiryDate, setEditExpiryDate] = useState<string>(equipment.expiryDate || '2029-03-12');
  const [editNextMaintenance, setEditNextMaintenance] = useState<string>(equipment.nextMaintenanceDate || '');
  const [editLastInspectorName, setEditLastInspectorName] = useState<string>(equipment.lastInspectorName || '');
  const [editX, setEditX] = useState<number>(equipment.xPercent);
  const [editY, setEditY] = useState<number>(equipment.yPercent);
  
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isEditingRef = useRef<boolean>(isEditing);
  isEditingRef.current = isEditing;
  const equipmentRef = useRef<Equipment>(equipment);
  equipmentRef.current = equipment;
  const onEquipmentUpdatedRef = useRef(onEquipmentUpdated);
  onEquipmentUpdatedRef.current = onEquipmentUpdated;

  const syncEditFormFields = (eq: Equipment) => {
    setEditSubType(eq.type === 'fire_extinguisher' ? normalizeAgentSubType(eq.subType) : eq.subType);
    setEditCapacity(
      eq.type === 'fire_extinguisher'
        ? resolveEquipmentCapacity(eq.subType, eq.capacity)
        : eq.capacity || '15 lbs (4A-5B)'
    );
    setEditZoneId(eq.zoneId);
    setEditStatus(eq.status);
    setEditExpiryDate(eq.expiryDate || '2029-03-12');
    setEditNextMaintenance(eq.nextMaintenanceDate || '');
    setEditLastInspectorName(eq.lastInspectorName || '');
    setEditX(eq.xPercent);
    setEditY(eq.yPercent);
  };

  // Sync state if prop changes
  useEffect(() => {
    setCurrentEquip(equipment);
    if (!isEditingRef.current) {
      syncEditFormFields(equipment);
    }
  }, [equipment]);

  // Generate QR code once per equipment ID
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(
      `${window.location.origin}/?scan=${encodeURIComponent(equipment.id)}`,
      { width: 220, margin: 1 }
    )
      .then((qrUrl) => {
        if (isMounted) setQrDataUrl(qrUrl);
      })
      .catch((err) => console.error(err));
    return () => {
      isMounted = false;
    };
  }, [equipment.id]);

  // Always fetch latest equipment state, inspection history, and defects from Turso/server
  useEffect(() => {
    let isMounted = true;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await api.getEquipmentById(equipment.id);
        if (!isMounted) return;

        if (res.equipment) {
          setCurrentEquip(res.equipment);
          if (!isEditingRef.current) {
            syncEditFormFields(res.equipment);
          }
          if (
            onEquipmentUpdatedRef.current &&
            JSON.stringify(res.equipment) !== JSON.stringify(equipmentRef.current)
          ) {
            onEquipmentUpdatedRef.current(res.equipment);
          }
        }

        setHistory(res.history);
        setActiveDefect(res.activeDefect || null);
        if (res.history && res.history.length > 0) {
          setSelectedMonthCycle(res.history[0].cycle || 'latest');
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [equipment.id, equipment.lastInspectedAt, equipment.status, equipment.lastInspectorName, equipment.subType, equipment.capacity]);

  const canEdit = isAdmin;
  const canInspect = isAdmin || (isInspector && isQrVerified);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      if (onRequestOwnerLogin) onRequestOwnerLogin();
      return;
    }

    setIsSaving(true);
    setFeedbackMessage(null);

    const selectedZone = zones.find(z => z.id === editZoneId);

    try {
      const res = await api.updateEquipment(currentEquip.id, {
        subType: editSubType,
        capacity: editCapacity,
        zoneId: editZoneId,
        zoneName: selectedZone?.nameTh || currentEquip.zoneName,
        pageNumber: selectedZone?.pageNumber || currentEquip.pageNumber,
        status: editStatus,
        expiryDate: editExpiryDate,
        nextMaintenanceDate: editNextMaintenance,
        lastInspectorName: editLastInspectorName.trim() || null,
        xPercent: editX,
        yPercent: editY,
      });

      if (res.success) {
        setCurrentEquip(res.equipment);
        setIsEditing(false);
        setFeedbackMessage({ type: 'success', text: `บันทึกข้อมูล ${res.equipment.id} เรียบร้อยแล้ว` });
        if (onEquipmentUpdated) {
          onEquipmentUpdated(res.equipment);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      setFeedbackMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!canEdit) {
      if (onRequestOwnerLogin) onRequestOwnerLogin();
      return;
    }

    setIsDeleting(true);
    try {
      const res = await api.deleteEquipment(currentEquip.id);
      if (res.success) {
        if (onEquipmentDeleted) {
          onEquipmentDeleted(currentEquip.id);
        }
        onClose();
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบอุปกรณ์';
      alert(errorMsg);
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: Equipment['status']) => {
    switch (status) {
      case 'READY':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✓ READY (ตรวจสอบแล้วพร้อมใช้)</span>;
      case 'DEFECTIVE':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">✕ DEFECTIVE (พบชำรุด)</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">⏳ IN PROGRESS (กำลังซ่อม)</span>;
      case 'PENDING':
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">⏳ PENDING (รอตรวจสอบ)</span>;
    }
  };

  // Month Thai formatting helper
  const formatMonthNameTh = (cycle: string) => {
    const [year, month] = cycle.split('-');
    const m = parseInt(month, 10);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thYear = parseInt(year, 10) + 543;
    return `${months[m - 1] || month} ${thYear}`;
  };

  // Distinct cycles available in history
  const distinctCycles = Array.from(new Set(history.map(h => h.cycle || h.inspectedAt.slice(0, 7)))).filter(Boolean);
  
  // Selected inspection record for monthly view
  const selectedRecord = selectedMonthCycle === 'latest' 
    ? history[0] 
    : history.find(h => (h.cycle || h.inspectedAt.slice(0, 7)) === selectedMonthCycle) || history[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92vh] text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Role-based Top Badge Bar */}
        {isAdmin ? (
          <div className="bg-amber-50 px-5 py-2.5 border-b border-amber-200 flex items-center justify-between text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span className="font-bold">👑 สิทธิ์ผู้ดูแลระบบ (ADMIN)</span>
              <span className="text-amber-800 hidden sm:inline">· ดู เพิ่ม แก้ไข และลบข้อมูลทะเบียนถังดับเพลิงได้ทั้งหมด</span>
            </div>
          </div>
        ) : isInspector ? (
          <div className="bg-sky-50 px-5 py-2.5 border-b border-sky-200 flex items-center justify-between text-xs text-sky-950">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-600" />
              <span className="font-bold">🔍 สิทธิ์ผู้ตรวจสอบ (INSPECTOR)</span>
              <span className="text-sky-800 hidden sm:inline">
                {isQrVerified
                  ? '· ยืนยันตัวถังผ่าน QR Code แล้ว (พร้อมบันทึกผลตรวจ)'
                  : '· ต้องสแกน QR Code ของถังเท่านั้นจึงจะบันทึกผลตรวจได้'}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="font-bold">👁️ ผู้เข้าชม (VISITOR) · โหมดอ่านอย่างเดียว (Read-only)</span>
              <span className="text-slate-600 hidden sm:inline">· ตรวจสอบสถานะและประวัติย้อนหลังทุกเดือน</span>
            </div>
            {onRequestOwnerLogin && (
              <button
                type="button"
                onClick={onRequestOwnerLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shadow-xs transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>เข้าสู่ระบบ</span>
              </button>
            )}
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-50 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Flame className="w-5 h-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg sm:text-xl font-bold font-mono text-slate-900">{currentEquip.id}</span>
                {getStatusBadge(currentEquip.status)}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{currentEquip.zoneName} · ผังหน้า {currentEquip.pageNumber}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs transition-colors cursor-pointer"
                title="แก้ไขข้อมูลถังดับเพลิงนี้ (เฉพาะ Admin)"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>แก้ไขข้อมูล</span>
              </button>
            )}

            {isAdmin && isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <span>ดูรายละเอียด</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <span className="flex items-center gap-1.5">
              {feedbackMessage.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              {feedbackMessage.text}
            </span>
            <button onClick={() => setFeedbackMessage(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* EDIT FORM VIEW (ONLY FOR OWNER) */}
          {isEditing && isOwner ? (
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 text-amber-900 flex items-center justify-between">
                <span className="font-semibold">กำลังอยู่ในโหมดแก้ไขข้อมูลถังดับเพลิง:</span>
                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300">{currentEquip.id}</span>
              </div>

              {/* SubType & Agent */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชนิดสารดับเพลิงและรุ่น (Agent & Specification) *</label>
                <select
                  value={editSubType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditSubType(val);
                    setEditCapacity(getDefaultCapacityForAgent(val));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  {AGENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Capacity & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ขนาดความจุ (Capacity) *</label>
                  <input
                    type="text"
                    required
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    placeholder="เช่น 15 lbs (4A-5B)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">สถานะอุปกรณ์ (Status) *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Equipment['status'])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="READY">✓ พร้อมใช้งาน (READY)</option>
                    <option value="DEFECTIVE">✕ พบข้อบกพร่อง (DEFECTIVE)</option>
                    <option value="IN_PROGRESS">⏳ กำลังซ่อมบำรุง (IN PROGRESS)</option>
                    <option value="PENDING">⏳ รอการตรวจสอบ (PENDING)</option>
                  </select>
                </div>
              </div>

              {/* Zone / Location */}
              {zones.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">โซนติดตั้ง (Warehouse Zone) *</label>
                  <select
                    value={editZoneId}
                    onChange={(e) => setEditZoneId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>
                        [หน้า {z.pageNumber}] {z.nameTh} ({z.floor})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Expiry & Maintenance Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">วันหมดอายุสารดับเพลิง:</label>
                  <input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">กำหนดซ่อมบำรุงรอบถัดไป:</label>
                  <input
                    type="date"
                    value={editNextMaintenance}
                    onChange={(e) => setEditNextMaintenance(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Inspector Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ผู้ตรวจเช็ค (Inspector):</label>
                <input
                  type="text"
                  value={editLastInspectorName}
                  onChange={(e) => setEditLastInspectorName(e.target.value)}
                  placeholder="ระบุชื่อผู้ตรวจเช็ค"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">พิกัดในผัง X (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={editX}
                    onChange={(e) => setEditX(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded font-mono bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">พิกัดในผัง Y (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={editY}
                    onChange={(e) => setEditY(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded font-mono bg-white text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบถังนี้</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-xs"
                  >
                    {isSaving ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>บันทึกการแก้ไข</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* VERIFICATION & DETAILS VIEW (VISIBLE TO BOTH VISITOR & OWNER) */
            <>
              {/* CURRENT INSPECTION STATUS CHECK CARD */}
              <div className={`p-4 rounded-xl border flex flex-col gap-3 ${
                currentEquip.status === 'READY'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : currentEquip.status === 'DEFECTIVE'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {currentEquip.status === 'READY' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : currentEquip.status === 'DEFECTIVE' ? (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide">
                        {currentEquip.status === 'READY' 
                          ? '✅ ถังดับเพลิงนี้ได้รับการตรวจสอบแล้ว (Inspected & Verified)'
                          : currentEquip.status === 'DEFECTIVE'
                          ? '⚠️ ตรวจพบข้อบกพร่อง (Defect Reported)'
                          : '⏳ รอการตรวจสอบประจำเดือน (Pending Monthly Inspection)'}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        รอบการตรวจความปลอดภัย: <strong className="text-slate-800">ประจำเดือนพฤศจิกายน 2569</strong>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    currentEquip.status === 'READY' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {currentEquip.lastResult || currentEquip.status}
                  </span>
                </div>

                {/* Inspection meta */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/70 p-2.5 rounded-lg border border-slate-200/60 text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-[10px]">วันที่ตรวจสอบล่าสุด:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {currentEquip.lastInspectedAt 
                        ? new Date(currentEquip.lastInspectedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'รอการตรวจสอบรอบนี้'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">ผู้ตรวจเช็ค (Inspector):</span>
                    <span className="font-semibold text-slate-800">
                      {currentEquip.lastInspectorName || 'นายอนันต์ แซ่ลิ้ม (จป.วิชาชีพ)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Equipment Info Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-semibold uppercase">ชนิดสารดับเพลิง (Agent Type):</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {currentEquip.type === 'fire_extinguisher' ? normalizeAgentSubType(currentEquip.subType) : currentEquip.subType}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[10px]">ขนาดความจุ:</span>
                      <span className="font-semibold text-slate-800">
                        {currentEquip.type === 'fire_extinguisher'
                          ? resolveEquipmentCapacity(currentEquip.subType, currentEquip.capacity)
                          : currentEquip.capacity || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">วันหมดอายุสาร:</span>
                      <span className="font-semibold text-slate-800 font-mono">{currentEquip.expiryDate || '2029-03-12'}</span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-600">
                    <span className="text-slate-500">จุดติดตั้ง:</span> {currentEquip.zoneName} (หน้าผัง {currentEquip.pageNumber})
                  </div>
                </div>

                {/* QR Code thumbnail */}
                <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt={`QR ${currentEquip.id}`} className="w-22 h-22 object-contain" />
                  )}
                  <span className="text-[10px] font-mono text-slate-700 mt-1 font-bold">
                    ID: {currentEquip.id}
                  </span>
                </div>
              </div>

              {/* Active Defect Alert if any */}
              {activeDefect && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-rose-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      รายการแจ้งซ่อม / ข้อบกพร่องที่อยู่ระหว่างดำเนินการ
                    </span>
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-semibold">
                      {activeDefect.status}
                    </span>
                  </div>
                  <div className="text-slate-800 font-sans">
                    {activeDefect.defectDetails}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-rose-200">
                    <span>ผู้รับผิดชอบ: {activeDefect.assignedTo}</span>
                    <span>กำหนดเสร็จ: {activeDefect.dueDate}</span>
                  </div>
                </div>
              )}

              {/* MONTHLY HISTORICAL INSPECTIONS (ตรวจสอบย้อนหลังได้ทุกเดือน) */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>ตรวจสอบประวัติย้อนหลังทุกเดือน (Monthly Inspection History)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">
                    {history.length} รอบเดือน
                  </span>
                </div>

                {/* Month Selector Pills */}
                {distinctCycles.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar text-xs">
                    {distinctCycles.map((cycle) => {
                      const isSelected = selectedMonthCycle === cycle;
                      const monthRecord = history.find(h => (h.cycle || h.inspectedAt.slice(0, 7)) === cycle);
                      const isPass = monthRecord?.overallResult === 'PASS';

                      return (
                        <button
                          key={cycle}
                          type="button"
                          onClick={() => setSelectedMonthCycle(cycle)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs font-bold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isPass ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{formatMonthNameTh(cycle)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Selected Month Detailed Breakdown Card */}
                {loading ? (
                  <div className="py-6 text-center text-xs text-slate-500">กำลังโหลดข้อมูลประวัติ...</div>
                ) : !selectedRecord ? (
                  <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                    ยังไม่มีข้อมูลการตรวจสอบในรอบเดือนที่เลือก
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs">
                    
                    {/* Month inspection header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          selectedRecord.overallResult === 'PASS'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {selectedRecord.overallResult === 'PASS' ? '✓ ผ่าน (PASS)' : '✕ ไม่ผ่าน (FAIL)'}
                        </span>
                        <span className="font-bold text-slate-900">
                          รอบประจำเดือน {formatMonthNameTh(selectedRecord.cycle || selectedRecord.inspectedAt.slice(0, 7))}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {new Date(selectedRecord.inspectedAt).toLocaleDateString('th-TH')}
                      </div>
                    </div>

                    {/* Inspector meta */}
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>ผู้ตรวจเช็ค: <strong className="text-slate-800">{selectedRecord.inspectorName}</strong> ({selectedRecord.inspectorEmployeeId})</span>
                      </span>
                      <span className="text-slate-400 font-mono">
                        {new Date(selectedRecord.inspectedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                    </div>

                    {/* Checklist items detailed grid */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        รายการตรวจเช็ค 7 หัวข้อประจำเดือน (Inspection Checklist):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {selectedRecord.checklist.map((item) => (
                          <div
                            key={item.itemId}
                            className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                              item.result === 'PASS'
                                ? 'bg-white border-slate-200 text-slate-800'
                                : 'bg-rose-50 border-rose-200 text-rose-900 font-semibold'
                            }`}
                          >
                            <span className="truncate">{item.itemTitle}</span>
                            <span className={`shrink-0 font-mono font-bold text-[10px] px-1.5 py-0.2 rounded ${
                              item.result === 'PASS'
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-rose-700 bg-rose-100'
                            }`}>
                              {item.result}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes if any */}
                    {selectedRecord.notes && (
                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700">หมายเหตุผู้ตรวจ:</span> {selectedRecord.notes}
                      </div>
                    )}
                    {selectedRecord.defectDetails && (
                      <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <span className="font-semibold">ข้อบกพร่องที่พบ:</span> {selectedRecord.defectDetails}
                      </div>
                    )}
                    {selectedRecord.photoUrl && (
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white p-1.5 space-y-1">
                        <div className="text-[10px] font-semibold text-slate-500">ภาพถ่ายประกอบการตรวจ:</div>
                        <DriveImage
                          src={selectedRecord.photoUrl}
                          alt={`Photo ${selectedRecord.equipmentId}`}
                          className="w-full max-h-48 object-cover rounded-md"
                        />
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Visitor Notice Box */}
              {!isOwner && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="text-[11px]">
                    สำหรับผู้เยี่ยมชม (Visitor): สามารถสแกนเพื่อตรวจสอบความปลอดภัยและประวัติย้อนหลังได้ทุกเดือน หากเป็นเจ้าหน้าที่หรือ Owner กรุณาเข้าสู่ระบบเพื่อแก้ไขข้อมูลหรือบันทึกผลการตรวจ
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        {!isEditing && (
          <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

              {/* Admin Edit & Delete Buttons */}
              {canEdit ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>แก้ไขข้อมูลถัง</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-colors shadow-xs cursor-pointer"
                    title="ลบถังดับเพลิงนี้ออกจากทะเบียน"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ลบถัง</span>
                  </button>
                </>
              ) : isVisitor && onRequestOwnerLogin ? (
                <button
                  onClick={onRequestOwnerLogin}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs cursor-pointer"
                  title="เข้าสู่ระบบเจ้าหน้าที่"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>เข้าสู่ระบบเจ้าหน้าที่</span>
                </button>
              ) : null}
            </div>

            {/* Inspection Trigger: Admin always; Inspector only when verified by scanning tank QR Code */}
            {canInspect ? (
              <button
                onClick={() => {
                  onClose();
                  onInspect(currentEquip);
                }}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>บันทึกตรวจเช็คอุปกรณ์นี้ (Inspect Now)</span>
              </button>
            ) : isInspector ? (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>ต้องสแกน QR Code ที่ตัวถังเท่านั้น</span>
                </span>
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenScanner();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>สแกน QR Code</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>ยืนยันข้อมูลความปลอดภัย CDC 2026 (โหมดผู้เข้าชม)</span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* CONFIRM DELETE DIALOG (ADMIN ONLY) */}
      {showDeleteConfirm && canEdit && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">ยืนยันการลบจุดติดตั้ง?</h3>
                <div className="text-xs text-slate-500">รหัส: {currentEquip.id}</div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการลบถังดับเพลิง <strong className="text-slate-900 font-mono">{currentEquip.id}</strong> ({currentEquip.subType}) ออกจากระบบความปลอดภัยหรือไม่?
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteEquipment}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>ยืนยันลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
