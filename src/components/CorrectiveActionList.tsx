import React, { useState } from 'react';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  User, 
  Calendar, 
  Camera, 
  Upload, 
  MapPin, 
  FileText,
  Filter,
  Check
} from 'lucide-react';
import { CorrectiveAction, User as UserType } from '../types';
import { api } from '../services/api';
import { DriveImage } from './DriveImage';

interface CorrectiveActionListProps {
  actions: CorrectiveAction[];
  currentUser: UserType;
  onRefresh: () => void;
  onNavigateToLayout?: (zoneId: string) => void;
}

export const CorrectiveActionList: React.FC<CorrectiveActionListProps> = ({
  actions,
  currentUser,
  onRefresh,
  onNavigateToLayout,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedAction, setSelectedAction] = useState<CorrectiveAction | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editStatus, setEditStatus] = useState<CorrectiveAction['status']>('IN_PROGRESS');
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null);

  const isSafetyOfficerOrAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SAFETY_OFFICER';

  const filtered = actions.filter(a => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    return true;
  });

  const handleOpenEdit = (action: CorrectiveAction) => {
    setSelectedAction(action);
    setEditNotes(action.resolutionNotes || '');
    setEditAssignedTo(action.assignedTo || '');
    setEditDueDate(action.dueDate || '');
    setEditStatus(action.status);
    setResolvedPhotoUrl(action.resolvedPhotoUrl || null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setResolvedPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUpdates = async () => {
    if (!selectedAction) return;
    try {
      setIsUpdating(true);
      await api.updateCorrectiveAction(selectedAction.id, {
        status: editStatus,
        assignedTo: editAssignedTo,
        dueDate: editDueDate,
        resolutionNotes: editNotes,
        resolvedPhotoUrl: resolvedPhotoUrl || undefined,
        resolvedBy: currentUser.name,
      });
      setSelectedAction(null);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกการแก้ไข');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerify = async (action: CorrectiveAction) => {
    if (!isSafetyOfficerOrAdmin) {
      alert('ต้องใช้สิทธิ์ Safety Officer หรือ Admin ในการตรวจสอบและยืนยันความพร้อมใช้งาน');
      return;
    }

    const confirmed = window.confirm(`ยืนยันว่าอุปกรณ์ ${action.equipmentId} ได้รับการแก้ไขเรียบร้อยและพร้อมใช้งาน (สีเขียว) หรือไม่?`);
    if (!confirmed) return;

    try {
      setIsUpdating(true);
      await api.verifyCorrectiveAction(action.id, currentUser.name);
      setSelectedAction(null);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการยืนยัน');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Title & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">ระบบติดตามการแก้ไขข้อบกพร่อง (Corrective Action Tracking)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            อุปกรณ์ที่พบชำรุดจากการสแกน จะถูกสร้างรายการติดตามและมอบหมายงานแก้ไขอัตโนมัติ
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs self-stretch md:self-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded transition-colors ${statusFilter === 'ALL' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ทั้งหมด ({actions.length})
          </button>
          <button
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded transition-colors ${statusFilter === 'OPEN' ? 'bg-rose-100 text-rose-800 font-semibold' : 'text-slate-600 hover:text-rose-700'}`}
          >
            รอแก้ไข ({actions.filter(a => a.status === 'OPEN').length})
          </button>
          <button
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded transition-colors ${statusFilter === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 font-semibold' : 'text-slate-600 hover:text-amber-700'}`}
          >
            กำลังซ่อม ({actions.filter(a => a.status === 'IN_PROGRESS').length})
          </button>
          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded transition-colors ${statusFilter === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'text-slate-600 hover:text-emerald-700'}`}
          >
            แก้ไขแล้ว ({actions.filter(a => a.status === 'COMPLETED').length})
          </button>
        </div>
      </div>

      {/* Action Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
          ไม่พบรายการแก้ไขในหมวดนี้ อุปกรณ์ความปลอดภัยในคลังสินค้า CDC พร้อมใช้งาน
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((action) => {
            const isCompleted = action.status === 'COMPLETED';
            const isOpen = action.status === 'OPEN';

            return (
              <div
                key={action.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-xs transition-all"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {action.equipmentId}
                      </span>
                      <span className="text-xs text-slate-600 font-medium truncate max-w-[150px]">
                        {action.zoneName}
                      </span>
                    </div>

                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isOpen
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {isOpen ? '● OPEN (รอแก้ไข)' : isCompleted ? '✓ COMPLETED (เสร็จสิ้น)' : '⏳ IN PROGRESS'}
                    </span>
                  </div>

                  {/* Problem Details */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="font-semibold flex items-center gap-1.5 text-rose-700">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>ข้อบกพร่องที่พบ:</span>
                    </div>
                    <div className="text-slate-800 leading-relaxed font-sans">
                      {action.defectDetails}
                    </div>
                  </div>

                  {/* Photo Evidence if any */}
                  {action.photoEvidence && (
                    <div className="rounded-lg overflow-hidden border border-slate-200 h-32 bg-slate-100">
                      <DriveImage
                        src={action.photoEvidence}
                        alt="Defect evidence"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Assigned & Due Date */}
                  <div className="space-y-1 text-xs text-slate-600 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-sans">ผู้รับผิดชอบ:</span>
                      <span className="text-slate-800 font-medium truncate">{action.assignedTo}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-sans">กำหนดเสร็จ:</span>
                      <span className="text-amber-800 font-semibold">{action.dueDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-sans">ผู้แจ้ง:</span>
                      <span>{action.reportedBy}</span>
                    </div>
                  </div>

                  {/* Resolution Notes if completed or in progress */}
                  {action.resolutionNotes && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                      <span className="text-emerald-800 font-semibold">การแก้ไข:</span>
                      <div className="text-slate-700 text-[11px] font-sans">{action.resolutionNotes}</div>
                    </div>
                  )}

                  {/* Verification by Safety Officer badge */}
                  {action.verifiedBy && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ยืนยันความปลอดภัยโดย: {action.verifiedBy}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenEdit(action)}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                  >
                    {isCompleted ? 'ดูรายละเอียด' : 'อัปเดตการแก้ไข'}
                  </button>

                  {!isCompleted && isSafetyOfficerOrAdmin && (
                    <button
                      onClick={() => handleVerify(action)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1 shadow-xs"
                      title="ยืนยันการแก้ไขเสร็จสิ้นและเปลี่ยนสถานะเป็นพร้อมใช้งาน (สีเขียว)"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ยืนยัน (Verify)</span>
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Update Modal Drawer */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 text-slate-800">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  อัปเดตสถานะการแก้ไข: {selectedAction.equipmentId}
                </h3>
                <div className="text-xs text-slate-500">{selectedAction.zoneName}</div>
              </div>
              <button
                onClick={() => setSelectedAction(null)}
                className="text-slate-400 hover:text-slate-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              
              <div>
                <label className="text-slate-700 font-medium block mb-1">สถานะดำเนินการ:</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-900 p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="OPEN">OPEN (ยังไม่เริ่มแก้ไข)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (กำลังดำเนินการแก้ไข)</option>
                  <option value="COMPLETED">COMPLETED (ซ่อมแซมเสร็จสิ้น รอตรวจสอบยืนยัน)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">ผู้รับผิดชอบงานแก้ไข:</label>
                <input
                  type="text"
                  value={editAssignedTo}
                  onChange={(e) => setEditAssignedTo(e.target.value)}
                  placeholder="เช่น ช่างบำรุงรักษาอาคาร หรือ แผนกความปลอดภัย"
                  className="w-full bg-slate-50 text-slate-900 p-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">กำหนดวันที่แล้วเสร็จ:</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 p-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">บันทึกผลการซ่อมแซม/แก้ไข:</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="ระบุสิ่งที่ได้ดำเนินการ เช่น เปลี่ยนสายฉีดใหม่, ปรับตั้งเข็มแรงดัน, ย้ายสิ่งกีดขวาง..."
                  rows={3}
                  className="w-full bg-slate-50 text-slate-900 p-2 rounded-lg border border-slate-200 placeholder-slate-400"
                />
              </div>

              {/* Photo after fix */}
              <div>
                <label className="text-slate-700 font-medium block mb-1">รูปถ่ายยืนยันหลังการแก้ไข:</label>
                {resolvedPhotoUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 h-36 bg-slate-100">
                    <DriveImage src={resolvedPhotoUrl} alt="Resolved" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setResolvedPhotoUrl(null)}
                      className="absolute top-2 right-2 px-2 py-1 bg-rose-600 text-white rounded text-[10px]"
                    >
                      ลบรูป
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center p-3 border border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-amber-500">
                    <span className="text-[11px] text-slate-500">📷 แตะเพื่อแนบรูปถ่ายหลังซ่อมเสร็จ</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
              </div>

            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedAction(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900"
              >
                ยกเลิก
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveUpdates}
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-xs"
                >
                  บันทึกข้อมูล
                </button>
                {isSafetyOfficerOrAdmin && (
                  <button
                    onClick={() => handleVerify(selectedAction)}
                    disabled={isUpdating}
                    className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ยืนยันพร้อมใช้งาน (READY)</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
