import React, { useState } from 'react';
import { 
  QrCode, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  Calendar, 
  Flame, 
  ChevronRight, 
  LogIn,
  Info,
  ExternalLink
} from 'lucide-react';
import { Equipment, ZoneInfo } from '../types';

interface PublicVisitorViewProps {
  equipmentList: Equipment[];
  zones: ZoneInfo[];
  onOpenScanner: () => void;
  onSelectEquipment: (equipment: Equipment) => void;
  onOpenLogin: () => void;
}

export const PublicVisitorView: React.FC<PublicVisitorViewProps> = ({
  equipmentList,
  zones,
  onOpenScanner,
  onSelectEquipment,
  onOpenLogin,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string>('all');

  const filteredEquipment = equipmentList.filter(e => {
    if (selectedZone !== 'all' && e.zoneId !== selectedZone) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      return e.id.toLowerCase().includes(q) || e.subType.toLowerCase().includes(q) || e.zoneName.toLowerCase().includes(q);
    }
    return true;
  });

  const readyCount = equipmentList.filter(e => e.status === 'READY').length;
  const defectiveCount = equipmentList.filter(e => e.status === 'DEFECTIVE').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Hero Banner for Public Visitors */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-slate-950 shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/15 text-slate-950 font-bold text-[11px] sm:text-xs">
            <ShieldCheck className="w-4 h-4 text-slate-950 shrink-0" />
            <span>Public Safety Verification · ตรวจสอบความปลอดภัยสาธารณะ</span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-950 leading-tight">
            ตรวจสอบมาตรฐานความปลอดภัยถังดับเพลิงประจำคลังสินค้า
          </h1>

          <p className="text-xs sm:text-sm text-slate-900/90 leading-relaxed">
            ผู้เข้าชมสามารถสแกน QR Code ที่ติดอยู่บนตัวถังดับเพลิง หรือค้นหาด้วยรหัสถัง เพื่อตรวจสอบสถานะความพร้อมใช้งาน และประวัติการตรวจสอบย้อนหลังทุกเดือนได้อย่างโปร่งใส
          </p>

          <div className="pt-2 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
            <button
              onClick={onOpenScanner}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <QrCode className="w-5 h-5 text-amber-400" />
              <span>สแกน QR Code ประจำถัง (Scan QR)</span>
            </button>

            <button
              onClick={onOpenLogin}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white/85 hover:bg-white text-slate-900 font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-amber-700" />
              <span>เข้าสู่ระบบสำหรับเจ้าหน้าที่ (Staff Login)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Visitor Safety Assurance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">อุปกรณ์ที่พร้อมใช้งาน (READY)</div>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{readyCount} ถัง</div>
            <div className="text-[10px] text-emerald-600 font-semibold">ผ่านเกณฑ์มาตรฐาน NFPA 10</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">รอบการตรวจสอบล่าสุด</div>
            <div className="text-base font-black text-slate-900 font-mono mt-0.5">พฤศจิกายน 2569</div>
            <div className="text-[10px] text-slate-500">ตรวจเช็คย้อนหลังได้ทุกเดือน</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">สิทธิ์การเข้าถึง (Access Level)</div>
            <div className="text-base font-black text-slate-900 mt-0.5">โหมดผู้เข้าชม (Read-only)</div>
            <div className="text-[10px] text-slate-500">ข้อมูลสาธารณะ ไม่สามารถแก้ไขได้</div>
          </div>
        </div>
      </div>

      {/* Equipment Search & Inspection Lookup Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-600" />
              <span>ค้นหาและตรวจสอบประวัติถังดับเพลิง (Equipment Verification Lookup)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              คลิกที่รายการเพื่อดูบัตรตรวจสอบความปลอดภัย และประวัติการตรวจเช็คย้อนหลัง 6 เดือน
            </p>
          </div>

          <span className="text-xs font-mono font-semibold text-slate-500">
            แสดง {filteredEquipment.length} จากทั้งหมด {equipmentList.length} รายการ
          </span>
        </div>

        {/* Search Input and Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="พิมพ์รหัสถังดับเพลิง เช่น FF1, FF2, FF10, FC139..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono transition-all"
            />
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="all">ทุกโซนคลังสินค้า ({equipmentList.length})</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nameTh}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Search Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-600 no-scrollbar">
          <span className="text-[11px] text-slate-400 shrink-0">ค้นหาด่วน:</span>
          {['FF1', 'FF2', 'FF3', 'FF4', 'FF10', 'FC139', 'DF82', 'CT203'].map(id => (
            <button
              key={id}
              onClick={() => setSearchQuery(id)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] transition-colors cursor-pointer shrink-0"
            >
              {id}
            </button>
          ))}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[11px] text-amber-600 hover:underline shrink-0 font-medium"
            >
              ล้างคำค้นหา
            </button>
          )}
        </div>

        {/* Equipment Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {filteredEquipment.slice(0, 36).map((equip) => {
            const isReady = equip.status === 'READY';
            const isDefective = equip.status === 'DEFECTIVE';

            return (
              <div
                key={equip.id}
                onClick={() => onSelectEquipment(equip)}
                className="p-4 rounded-xl border border-slate-200 hover:border-amber-400 bg-white hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black font-mono text-base text-slate-900 group-hover:text-amber-600 transition-colors">
                      {equip.id}
                    </span>
                    <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold font-mono ${
                      isReady ? 'bg-emerald-100 text-emerald-800' : isDefective ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isReady ? '✓ PASS' : isDefective ? '✕ DEFECT' : '⏳ PENDING'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 font-medium line-clamp-1">
                    {equip.subType}
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{equip.zoneName} · หน้า {equip.pageNumber}</span>
                  </div>
                </div>

                <div className="text-slate-400 group-hover:text-amber-500 group-hover:translate-x-1 transition-all shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>

        {filteredEquipment.length > 36 && (
          <div className="text-center pt-3 text-xs text-slate-500">
            แสดง 36 จาก {filteredEquipment.length} รายการ (ใช้ช่องค้นหาด้านบนเพื่อค้นหารหัสที่ต้องการ)
          </div>
        )}

      </div>

      {/* Visitor Read-only Notice Footer */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 text-xs text-sky-900">
        <div className="flex items-start sm:items-center gap-3">
          <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="font-bold">เงื่อนไขการใช้งานสำหรับผู้เข้าชม (Visitor Notice):</div>
            <div className="text-[11px] text-sky-800 mt-0.5">
              ข้อมูลทั้งหมดอยู่ในรูปแบบอ่านอย่างเดียว (Read-only) เพื่อความปลอดภัยของข้อมูลคลังสินค้า หากต้องการบันทึกผลการตรวจสอบ กรุณาเข้าสู่ระบบด้วยบัญชีผู้ตรวจสอบ (Inspector) หรือผู้ดูแลระบบ (Admin)
            </div>
          </div>
        </div>

        <button
          onClick={onOpenLogin}
          className="w-full sm:w-auto shrink-0 px-4 py-2.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer text-center"
        >
          เข้าสู่ระบบ
        </button>
      </div>

    </div>
  );
};
