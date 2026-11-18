import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, 
  Flame, 
  Waves, 
  Camera, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Upload, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  MapPin,
  Trash2,
  Lock
} from 'lucide-react';
import { Equipment, User, ChecklistResult } from '../types';
import { EXTINGUISHER_CHECKLIST, HOSE_CABINET_CHECKLIST } from '../data/warehouseData';
import { api } from '../services/api';

interface InspectionFormModalProps {
  equipment: Equipment;
  currentUser: User;
  onClose: () => void;
  onSuccess: (updatedEquipment: Equipment) => void;
  isOwner?: boolean;
  onRequestOwnerLogin?: () => void;
}

export const InspectionFormModal: React.FC<InspectionFormModalProps> = ({
  equipment,
  currentUser,
  onClose,
  onSuccess,
  isOwner = true,
  onRequestOwnerLogin,
}) => {
  const isExtinguisher = equipment.type === 'fire_extinguisher';
  const checklistDefs = isExtinguisher ? EXTINGUISHER_CHECKLIST : HOSE_CABINET_CHECKLIST;

  const [checklistResults, setChecklistResults] = useState<Record<string, ChecklistResult>>(() => {
    const initial: Record<string, ChecklistResult> = {};
    checklistDefs.forEach(item => {
      initial[item.id] = 'PASS';
    });
    return initial;
  });

  const [defectDetails, setDefectDetails] = useState<string>('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [inspectorName, setInspectorName] = useState<string>(currentUser.name);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasFail = Object.values(checklistResults).some(r => r === 'FAIL');
  const overallResult: 'PASS' | 'FAIL' = hasFail ? 'FAIL' : 'PASS';

  const handlePassAll = () => {
    const updated: Record<string, ChecklistResult> = {};
    checklistDefs.forEach(item => {
      updated[item.id] = 'PASS';
    });
    setChecklistResults(updated);
    setDefectDetails('');
  };

  const handleSetItemResult = (itemId: string, result: ChecklistResult) => {
    setChecklistResults(prev => ({
      ...prev,
      [itemId]: result,
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isOwner) {
      if (onRequestOwnerLogin) onRequestOwnerLogin();
      else setErrorMessage('เฉพาะ Owner หรือเจ้าหน้าที่ความปลอดภัยเท่านั้นที่สามารถบันทึกผลการตรวจสอบได้');
      return;
    }

    if (!inspectorName.trim()) {
      setErrorMessage('กรุณาระบุชื่อผู้ตรวจสอบ');
      return;
    }

    if (overallResult === 'FAIL' && !defectDetails.trim()) {
      setErrorMessage('กรุณาระบุรายละเอียดข้อบกพร่องที่พบเพื่อส่งต่อให้ทีมบำรุงรักษา');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const checklistPayload = checklistDefs.map(def => ({
        itemId: def.id,
        itemTitle: def.titleTh,
        result: checklistResults[def.id] || 'PASS',
      }));

      const res = await api.submitInspection({
        equipmentId: equipment.id,
        inspectorName: inspectorName.trim(),
        inspectorRole: currentUser.role,
        inspectorEmployeeId: currentUser.employeeId,
        checklist: checklistPayload,
        overallResult,
        defectDetails: overallResult === 'FAIL' ? defectDetails : undefined,
        photoUrl: photoDataUrl || undefined,
        notes: notes.trim() || undefined,
      });

      if (overallResult === 'PASS') {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#F59E0B'],
        });
      }

      onSuccess(res.updatedEquipment);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92vh] text-slate-800">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              isExtinguisher 
                ? 'bg-rose-100 text-rose-600 border border-rose-200' 
                : 'bg-sky-100 text-sky-600 border border-sky-200'
            }`}>
              {isExtinguisher ? <Flame className="w-5 h-5 text-rose-600" /> : <Waves className="w-5 h-5 text-sky-600" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-bold font-mono text-slate-900">{equipment.id}</span>
                <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-medium">
                  {isExtinguisher ? 'ถังดับเพลิง' : 'ตู้ดับเพลิง'}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{equipment.zoneName} · {equipment.subType}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
          
          {/* Quick Bar: Pass All & Status Preview */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">ผลการประเมินรวม:</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                overallResult === 'PASS' 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
              }`}>
                {overallResult === 'PASS' ? '✓ PASS (พร้อมใช้งาน)' : '✕ FAIL (พบข้อบกพร่อง)'}
              </span>
            </div>

            <button
              type="button"
              onClick={handlePassAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ผ่านทุกรายการ (Pass All)</span>
            </button>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>รายการตรวจสอบ (Inspection Checklist)</span>
              <span className="text-[11px] text-slate-400 lowercase font-normal">{checklistDefs.length} รายการ</span>
            </div>

            <div className="space-y-2">
              {checklistDefs.map((item, index) => {
                const current = checklistResults[item.id] || 'PASS';

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition-all ${
                      current === 'FAIL'
                        ? 'bg-rose-50 border-rose-200'
                        : current === 'NA'
                        ? 'bg-slate-50/70 border-slate-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-slate-800 flex items-baseline gap-2">
                          <span className="font-mono text-slate-400 text-[11px] font-semibold">{index + 1}.</span>
                          <span>{item.titleTh}</span>
                        </div>
                        {item.descriptionTh && (
                          <div className="text-[11px] text-slate-500 ml-4 mt-0.5">
                            {item.descriptionTh}
                          </div>
                        )}
                      </div>

                      {/* PASS / FAIL / NA Segmented Toggle */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetItemResult(item.id, 'PASS')}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                            current === 'PASS'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          PASS
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetItemResult(item.id, 'FAIL')}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                            current === 'FAIL'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-rose-700'
                          }`}
                        >
                          FAIL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetItemResult(item.id, 'NA')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            current === 'NA'
                              ? 'bg-slate-300 text-slate-800 font-semibold'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          N/A
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Defect details if any FAIL */}
          {hasFail && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <label className="text-xs font-semibold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                รายละเอียดข้อบกพร่องที่ตรวจพบ (Defect Details) *
              </label>
              <textarea
                value={defectDetails}
                onChange={(e) => setDefectDetails(e.target.value)}
                placeholder="ระบุสาเหตุ เช่น เข็มแรงดันตก, สลักและซีลหลุด, สายฉีดฉีกขาด, มีพาเลทสินค้าวางขวางหน้าอุปกรณ์..."
                rows={3}
                required
                className="w-full bg-white text-slate-900 text-xs rounded-lg p-2.5 border border-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder-slate-400"
              />
            </div>
          )}

          {/* Photo Evidence Capture from Camera or File */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-600" />
                รูปถ่ายประกอบการตรวจสอบ (Photo Evidence)
              </span>
              <span className="text-[11px] text-slate-500 font-normal">กล้องมือถือ / ไฟล์ภาพ</span>
            </label>

            {photoDataUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-56">
                <img
                  src={photoDataUrl}
                  alt="Inspection Evidence"
                  className="w-full h-56 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors shadow-md"
                  title="ลบรูปภาพ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100/60 transition-colors group">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <Camera className="w-6 h-6 text-slate-400 group-hover:text-amber-600 transition-colors" />
                  <span className="text-xs text-slate-700 font-medium">
                    แตะเพื่อถ่ายรูปด้วยกล้องมือถือ หรือเลือกไฟล์ภาพ
                  </span>
                  <span className="text-[11px] text-slate-500">
                    หลักฐานภาพถ่ายเกจวัดแรงดัน ตัวถัง หรือสิ่งกีดขวาง
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">หมายเหตุเพิ่มเติม (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ระบุข้อสังเกตเพิ่มเติม เช่น ฝุ่นเกาะมาก ควรเช็ดทำความสะอาด"
              className="w-full bg-white text-slate-900 text-xs rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
            />
          </div>

          {/* Inspector Signature & Timestamp Info */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 flex-1">
              <label htmlFor="inspector-name-input" className="text-slate-600 font-semibold shrink-0">
                ผู้ตรวจสอบ:
              </label>
              <input
                id="inspector-name-input"
                type="text"
                required
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="กรอกชื่อ-นามสกุลผู้ตรวจสอบ"
                className="flex-1 min-w-0 bg-white text-slate-900 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
              />
              <span className="text-[11px] text-slate-400 font-mono shrink-0">({currentUser.employeeId})</span>
            </div>
            <div className="font-mono text-[11px] text-slate-500 shrink-0 self-end sm:self-auto">
              <span className="text-slate-400">เวลา:</span> {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

        </form>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            ยกเลิก (Cancel)
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all shadow-xs ${
              overallResult === 'PASS'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <span>กำลังบันทึกข้อมูล...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {overallResult === 'PASS'
                    ? 'บันทึกผลตรวจสอบ (PASS)'
                    : 'บันทึกพร้อมแจ้งแก้ไข (FAIL)'}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
