import React, { useState } from 'react';
import { 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Search, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  Filter,
  Flame,
  UserCheck,
  Shield,
  Layers
} from 'lucide-react';
import { Equipment, ZoneInfo, InspectionRecord, User } from '../types';

interface InspectorDashboardProps {
  currentUser: User;
  equipmentList: Equipment[];
  zones: ZoneInfo[];
  recentInspections: InspectionRecord[];
  onOpenScanner: () => void;
  onInspectEquipment: (equipment: Equipment) => void;
  onSelectEquipment: (equipment: Equipment) => void;
  onNavigateToZone: (zoneId: string) => void;
}

export const InspectorDashboard: React.FC<InspectorDashboardProps> = ({
  currentUser,
  equipmentList,
  zones,
  recentInspections,
  onOpenScanner,
  onInspectEquipment,
  onSelectEquipment,
  onNavigateToZone,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'zones' | 'history'>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('all');

  const totalCount = equipmentList.length;
  const inspectedCount = equipmentList.filter(e => e.status === 'READY' || e.status === 'DEFECTIVE').length;
  const pendingCount = equipmentList.filter(e => e.status === 'PENDING').length;
  const defectiveCount = equipmentList.filter(e => e.status === 'DEFECTIVE').length;
  const completionRate = totalCount > 0 ? Math.round((inspectedCount / totalCount) * 100) : 0;

  // Filter pending items
  const pendingEquipment = equipmentList.filter(e => {
    if (e.status !== 'PENDING') return false;
    if (zoneFilter !== 'all' && e.zoneId !== zoneFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.id.toLowerCase().includes(q) || e.subType.toLowerCase().includes(q) || e.zoneName.toLowerCase().includes(q);
    }
    return true;
  });

  // Filter history by current inspector
  const myInspections = recentInspections.filter(i => 
    i.inspectorName.includes('Inspector') || i.inspectorName.includes('อนันต์') || i.inspectorEmployeeId === currentUser.employeeId
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Inspector Welcome & Quick Scan Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] sm:text-xs font-semibold border border-amber-500/30">
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ผู้ตรวจสอบ (Inspector): {currentUser.name}</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
            แดชบอร์ดการตรวจสอบความปลอดภัยถังดับเพลิง
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            รอบการตรวจสอบประจำเดือน พฤศจิกายน 2569 · สแกน QR Code ประจำถัง ตรวจสอบ 7 หัวข้อมาตรฐาน และบันทึกผลเข้าระบบทันที
          </p>
        </div>

        {/* Primary CTA: Scan QR */}
        <button
          onClick={onOpenScanner}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-md hover:scale-[1.02] cursor-pointer shrink-0"
        >
          <QrCode className="w-5 h-5 text-slate-950" />
          <span>สแกน QR Code ตรวจสอบถัง (Scan QR)</span>
        </button>
      </div>

      {/* Inspection KPI Progress Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">อุปกรณ์ทั้งหมดในระบบ</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{totalCount} ถัง</div>
          <div className="text-[11px] text-slate-400 mt-0.5">ครอบคลุม 20 โซนคลังสินค้า</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ตรวจเช็คแล้วในรอบนี้</span>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{inspectedCount} ถัง</div>
          <div className="text-[11px] text-emerald-600 mt-0.5 font-semibold">ความคืบหน้า {completionRate}%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs">
          <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>รอการตรวจสอบ</span>
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono mt-1">{pendingCount} ถัง</div>
          <div className="text-[11px] text-amber-600 mt-0.5">ต้องดำเนินการในเดือนนี้</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
          <div className="text-xs text-rose-700 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>ตรวจพบข้อบกพร่อง</span>
          </div>
          <div className="text-2xl font-black text-rose-700 font-mono mt-1">{defectiveCount} จุด</div>
          <div className="text-[11px] text-rose-600 mt-0.5">ส่งต่อทีมบำรุงรักษาแล้ว</div>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('pending')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeSubTab === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>รายการที่รอตรวจสอบ ({pendingEquipment.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('zones')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeSubTab === 'zones'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>พื้นที่ตรวจสอบที่ได้รับมอบหมาย ({zones.length} โซน)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
            activeSubTab === 'history'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>ประวัติการตรวจล่าสุด ({myInspections.length})</span>
        </button>
      </div>

      {/* TAB 1: PENDING EQUIPMENT TO INSPECT */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัสถัง เช่น FF1, FC139..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="all">ทุกโซนคลังสินค้า ({equipmentList.length})</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>
                    {z.nameTh}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* List of Pending Items */}
          {pendingEquipment.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="text-base font-bold text-slate-900">ไม่มีถังที่รอตรวจสอบในเงื่อนไขนี้</div>
              <p className="text-xs text-slate-500">
                ถังดับเพลิงในโซนที่เลือกได้รับการตรวจสอบครบถ้วนเรียบร้อยแล้ว
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingEquipment.map((equip) => (
                <div
                  key={equip.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                          <Flame className="w-4 h-4" />
                        </span>
                        <span className="text-base font-black font-mono text-slate-900">{equip.id}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        ⏳ รอตรวจ
                      </span>
                    </div>

                    <div className="space-y-1 mt-2 text-xs">
                      <div className="font-semibold text-slate-800">{equip.subType}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{equip.zoneName} · หน้า {equip.pageNumber}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ความจุ: {equip.capacity || '15 lbs'} · หมดอายุ: {equip.expiryDate || '2029-03-12'}
                      </div>
                    </div>
                  </div>

                  {/* Actions for Inspector */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => onSelectEquipment(equip)}
                      className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors text-center cursor-pointer"
                    >
                      ดูข้อมูล & ประวัติ
                    </button>
                    <button
                      onClick={onOpenScanner}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>สแกน QR ตรวจถัง</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGNED ZONES */}
      {activeSubTab === 'zones' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {zones.map((zone) => {
            const zoneEquips = equipmentList.filter(e => e.zoneId === zone.id);
            const zoneInspected = zoneEquips.filter(e => e.status !== 'PENDING').length;
            const zoneRate = zoneEquips.length > 0 ? Math.round((zoneInspected / zoneEquips.length) * 100) : 0;

            return (
              <div
                key={zone.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-amber-400 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      หน้าผัง {zone.pageNumber}
                    </span>
                    <span className={`text-[11px] font-bold ${zoneRate === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {zoneRate}% เสร็จแล้ว
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-2">{zone.nameTh}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{zone.description}</p>

                  <div className="mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>จำนวนถังทั้งหมด:</span>
                      <strong className="font-mono">{zoneEquips.length} ถัง</strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>ตรวจแล้ว:</span>
                      <strong className="text-emerald-600 font-mono">{zoneInspected} ถัง</strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToZone(zone.id)}
                  className="w-full mt-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>เปิดผังโซนนี้</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: RECENT INSPECTIONS */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              ประวัติการตรวจเช็คที่ส่งแล้ว (My Submitted Inspections)
            </h3>
            <span className="text-xs text-slate-500 font-mono">{myInspections.length} รายการ</span>
          </div>

          <div className="divide-y divide-slate-100">
            {myInspections.slice(0, 30).map((record) => (
              <div key={record.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                    record.overallResult === 'PASS' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {record.overallResult}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{record.equipmentId}</span>
                      <span className="text-xs text-slate-500">· {record.zoneName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      ผู้ตรวจ: {record.inspectorName} ({record.inspectorEmployeeId}) · {record.notes || 'ตรวจตามรอบปกติ'}
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
                  <div>{new Date(record.inspectedAt).toLocaleDateString('th-TH')}</div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(record.inspectedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
