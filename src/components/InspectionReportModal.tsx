import React, { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Flame,
  Waves,
  Eye,
  X,
  Search,
  Layers,
  ListChecks,
} from 'lucide-react';
import { InspectionRecord, ZoneInfo, Equipment } from '../types';
import { DriveImage } from './DriveImage';
import { api } from '../services/api';
import { normalizeAgentSubType, resolveEquipmentCapacity } from '../utils/equipmentAgents';

interface InspectionReportModalProps {
  inspections: InspectionRecord[];
  allEquipment: Equipment[];
  zones: ZoneInfo[];
  onClose?: () => void;
  onSelectEquipment?: (equipment: Equipment) => void;
}

export const InspectionReportModal: React.FC<InspectionReportModalProps> = ({
  inspections,
  allEquipment,
  zones,
  onSelectEquipment,
}) => {
  const [reportMode, setReportMode] = useState<'all-equipment' | 'logs'>('all-equipment');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'PASS' | 'FAIL' | 'PENDING'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [fullInspections, setFullInspections] = useState<InspectionRecord[]>(inspections);
  const [loadingFull, setLoadingFull] = useState<boolean>(false);

  // Sync with parent prop updates and fetch complete inspection history from Turso without truncation
  useEffect(() => {
    setFullInspections(inspections);
  }, [inspections]);

  useEffect(() => {
    let mounted = true;
    const loadAllLogs = async () => {
      try {
        setLoadingFull(true);
        const allLogs = await api.getInspections({ all: true });
        if (mounted && Array.isArray(allLogs)) {
          setFullInspections(allLogs);
        }
      } catch (err) {
        console.warn('Could not load complete inspections list:', err);
      } finally {
        if (mounted) setLoadingFull(false);
      }
    };
    void loadAllLogs();
    return () => {
      mounted = false;
    };
  }, [inspections.length]);

  // Latest inspection lookup per equipment ID
  const latestInspectionByEquipId = useMemo(() => {
    const map = new Map<string, InspectionRecord>();
    const sorted = [...fullInspections].sort(
      (a, b) => new Date(b.inspectedAt).getTime() - new Date(a.inspectedAt).getTime()
    );
    for (const rec of sorted) {
      const key = rec.equipmentId.toUpperCase();
      if (!map.has(key)) {
        map.set(key, rec);
      }
    }
    return map;
  }, [fullInspections]);

  const equipmentById = useMemo(() => {
    const map = new Map<string, Equipment>();
    for (const eq of allEquipment) {
      map.set(eq.id.toUpperCase(), eq);
    }
    return map;
  }, [allEquipment]);

  const getCanonicalSubType = (eq: Equipment) =>
    eq.type === 'fire_extinguisher' ? normalizeAgentSubType(eq.subType) : eq.subType;

  const getCanonicalCapacity = (eq: Equipment) =>
    eq.type === 'fire_extinguisher'
      ? resolveEquipmentCapacity(eq.subType, eq.capacity)
      : eq.capacity || '-';

  // Complete master list of ALL equipment (212 tanks) merged with latest inspection info
  const completeEquipmentRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return [...allEquipment]
      .sort((a, b) => {
        if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
      })
      .map(eq => {
        const latestInsp = latestInspectionByEquipId.get(eq.id.toUpperCase());
        const effectiveResult: 'PASS' | 'FAIL' | 'PENDING' =
          eq.status === 'READY'
            ? 'PASS'
            : eq.status === 'DEFECTIVE' || eq.status === 'IN_PROGRESS'
            ? 'FAIL'
            : 'PENDING';
        const effectiveInspectedAt = latestInsp?.inspectedAt || eq.lastInspectedAt || null;
        const effectiveInspector = latestInsp?.inspectorName || eq.lastInspectorName || '-';
        const effectiveNotes = latestInsp?.defectDetails || latestInsp?.notes || '';
        const canonicalSubType = getCanonicalSubType(eq);
        const canonicalCapacity = getCanonicalCapacity(eq);

        return {
          equipment: eq,
          canonicalSubType,
          canonicalCapacity,
          latestInsp,
          effectiveResult,
          effectiveInspectedAt,
          effectiveInspector,
          effectiveNotes,
        };
      })
      .filter(row => {
        if (zoneFilter !== 'all' && row.equipment.zoneId !== zoneFilter) return false;
        if (resultFilter !== 'all' && row.effectiveResult !== resultFilter) return false;
        if (q) {
          const hay = [
            row.equipment.id,
            row.canonicalSubType,
            row.canonicalCapacity,
            row.equipment.subType,
            row.equipment.zoneName,
            row.effectiveInspector,
            row.effectiveNotes,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [allEquipment, latestInspectionByEquipId, zoneFilter, resultFilter, searchQuery]);

  // Audit Log rows (chronological individual inspection records)
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();

    return fullInspections.filter(item => {
      const itemDate = new Date(item.inspectedAt);

      if (timeFilter === 'today') {
        if (itemDate.toDateString() !== now.toDateString()) return false;
      } else if (timeFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (itemDate < oneWeekAgo) return false;
      } else if (timeFilter === 'month') {
        const isThisMonth = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        if (!isThisMonth) return false;
      }

      if (zoneFilter !== 'all' && item.zoneId !== zoneFilter) return false;
      if (resultFilter === 'PASS' && item.overallResult !== 'PASS') return false;
      if (resultFilter === 'FAIL' && item.overallResult !== 'FAIL') return false;
      if (resultFilter === 'PENDING') return false;

      if (q) {
        const hay = [
          item.equipmentId,
          item.zoneName,
          item.inspectorName,
          item.defectDetails || '',
          item.notes || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [fullInspections, timeFilter, zoneFilter, resultFilter, searchQuery]);

  const totalCount = reportMode === 'all-equipment' ? completeEquipmentRows.length : filteredLogs.length;
  const passCount =
    reportMode === 'all-equipment'
      ? completeEquipmentRows.filter(r => r.effectiveResult === 'PASS').length
      : filteredLogs.filter(i => i.overallResult === 'PASS').length;
  const failCount =
    reportMode === 'all-equipment'
      ? completeEquipmentRows.filter(r => r.effectiveResult === 'FAIL').length
      : filteredLogs.filter(i => i.overallResult === 'FAIL').length;
  const pendingCount =
    reportMode === 'all-equipment'
      ? completeEquipmentRows.filter(r => r.effectiveResult === 'PENDING').length
      : 0;
  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const statusLabelTh = (status: Equipment['status']) => {
    switch (status) {
      case 'READY':
        return 'พร้อมใช้งาน (READY)';
      case 'DEFECTIVE':
        return 'พบข้อบกพร่อง (DEFECTIVE)';
      case 'IN_PROGRESS':
        return 'กำลังซ่อมบำรุง (IN PROGRESS)';
      default:
        return 'รอตรวจสอบ (PENDING)';
    }
  };

  const handleExportCSV = () => {
    const esc = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    let headers: string[];
    let rows: string[][];
    let filename: string;

    if (reportMode === 'all-equipment') {
      headers = [
        'ลำดับ',
        'รหัสอุปกรณ์',
        'ประเภทอุปกรณ์',
        'ชนิดสารดับเพลิง',
        'ขนาดความจุ',
        'หน้าผัง',
        'โซน / แผนก',
        'สถานะปัจจุบัน',
        'ผลการตรวจล่าสุด',
        'วันที่และเวลาตรวจล่าสุด',
        'ผู้ตรวจสอบล่าสุด',
        'วันหมดอายุสาร',
        'รายละเอียดข้อบกพร่อง',
        'หมายเหตุ',
      ];

      rows = completeEquipmentRows.map((row, idx) => [
        esc(idx + 1),
        esc(row.equipment.id),
        esc(row.equipment.type === 'fire_extinguisher' ? 'ถังดับเพลิง' : 'ตู้ดับเพลิง'),
        esc(row.canonicalSubType),
        esc(row.canonicalCapacity),
        esc(row.equipment.pageNumber),
        esc(row.equipment.zoneName),
        esc(statusLabelTh(row.equipment.status)),
        esc(row.effectiveResult),
        esc(row.effectiveInspectedAt ? new Date(row.effectiveInspectedAt).toLocaleString('th-TH') : 'ยังไม่เคยตรวจ'),
        esc(row.effectiveInspector),
        esc(row.equipment.expiryDate || '-'),
        esc(row.latestInsp?.defectDetails || ''),
        esc(row.latestInsp?.notes || ''),
      ]);

      filename = `Fire_Extinguisher_All_Equipment_CDC_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      headers = [
        'ลำดับ',
        'วันที่และเวลา',
        'รหัสอุปกรณ์',
        'ประเภทอุปกรณ์',
        'ชนิดสารดับเพลิง',
        'ขนาดความจุ',
        'โซน / แผนก',
        'ผลการตรวจสอบ',
        'ผู้ตรวจสอบ',
        'รหัสพนักงาน',
        'รายละเอียดข้อบกพร่อง',
        'หมายเหตุ',
      ];

      rows = filteredLogs.map((i, idx) => {
        const eq = equipmentById.get(i.equipmentId.toUpperCase());
        const sub = eq ? getCanonicalSubType(eq) : 'Dry Chemical';
        const cap = eq ? getCanonicalCapacity(eq) : '-';
        return [
          esc(idx + 1),
          esc(new Date(i.inspectedAt).toLocaleString('th-TH')),
          esc(i.equipmentId),
          esc(i.equipmentType === 'fire_extinguisher' ? 'ถังดับเพลิง' : 'ตู้ดับเพลิง'),
          esc(sub),
          esc(cap),
          esc(i.zoneName),
          esc(i.overallResult),
          esc(i.inspectorName),
          esc(i.inspectorEmployeeId),
          esc(i.defectDetails || ''),
          esc(i.notes || ''),
        ];
      });

      filename = `Fire_Safety_Audit_Log_CDC_${timeFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Top Banner and Actions */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">รายงานผลการตรวจสอบความปลอดภัย (Inspection Reports)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            รายงานครบทุกถังในคลังสินค้า ({allEquipment.length} ถัง) และประวัติการตรวจย้อนหลัง พร้อมส่งออก Excel และ PDF
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel ({totalCount} รายการ)</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน (PDF)</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher & Filter Strip (Hidden in Print) */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Report Mode Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setReportMode('all-equipment')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                reportMode === 'all-equipment'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>รายงานครบทุกถัง ({allEquipment.length} ถัง)</span>
            </button>
            <button
              type="button"
              onClick={() => setReportMode('logs')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                reportMode === 'logs'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>ประวัติการตรวจรายครั้ง ({fullInspections.length}{loadingFull ? '...' : ''})</span>
            </button>
          </div>

          {/* Time Filter Tabs (for Audit Log mode) */}
          {reportMode === 'logs' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs overflow-x-auto">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 shrink-0" />
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${timeFilter === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ทั้งหมด ({fullInspections.length})
              </button>
              <button
                onClick={() => setTimeFilter('today')}
                className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${timeFilter === 'today' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ประจำวัน
              </button>
              <button
                onClick={() => setTimeFilter('week')}
                className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${timeFilter === 'week' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                สัปดาห์นี้
              </button>
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${timeFilter === 'month' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                เดือนนี้
              </button>
            </div>
          )}
        </div>

        {/* Search & Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารหัสถัง (เช่น FF1), ชนิดสาร, โซน หรือชื่อผู้ตรวจ..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Result Filter */}
            <select
              aria-label="กรองผลการตรวจ"
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as 'all' | 'PASS' | 'FAIL' | 'PENDING')}
              className="bg-slate-50 text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
            >
              <option value="all">สถานะ: ทั้งหมด</option>
              <option value="PASS">พร้อมใช้งาน / ผ่าน (PASS)</option>
              <option value="FAIL">พบชำรุด / แก้ไข (FAIL)</option>
              {reportMode === 'all-equipment' && <option value="PENDING">รอตรวจสอบ (PENDING)</option>}
            </select>

            {/* Zone Filter */}
            <select
              aria-label="กรองโซนคลังสินค้า"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="bg-slate-50 text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none max-w-[220px]"
            >
              <option value="all">ทุกโซนคลังสินค้า ({zones.length} โซน)</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  หน้า {z.pageNumber} · {z.nameTh}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">
            {reportMode === 'all-equipment' ? 'จำนวนถังในรายงานทั้งหมด' : 'จำนวนบันทึกการตรวจทั้งหมด'}
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{totalCount}</div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-emerald-800 font-medium">พร้อมใช้งาน / ผ่าน (PASS)</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{passCount}</div>
        </div>
        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-rose-800 font-medium">พบข้อบกพร่อง (FAIL)</div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{failCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">
            {reportMode === 'all-equipment' && pendingCount > 0 ? 'รอตรวจสอบ / อัตราพร้อมใช้' : 'อัตราผ่านเกณฑ์'}
          </div>
          <div className="text-2xl font-bold font-mono text-sky-600 mt-1">
            {passRate}%
            {reportMode === 'all-equipment' && pendingCount > 0 && (
              <span className="text-xs font-sans text-amber-600 ml-2">(รอตรวจ {pendingCount})</span>
            )}
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">

        {/* Printable Official Header */}
        <div className="hidden print:block p-6 text-center border-b border-black">
          <h1 className="text-xl font-bold text-black uppercase">
            รายงานการตรวจสอบอุปกรณ์ดับเพลิงและตู้ดับเพลิง ประจำคลังสินค้า CDC 2026
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')} | จำนวนทั้งหมด {totalCount} รายการ | มาตรฐานความปลอดภัยอาชีวอนามัย ISO 45001
          </p>
        </div>

        <div className="overflow-x-auto">
          {reportMode === 'all-equipment' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3 text-center">#</th>
                  <th className="py-3 px-3">รหัสอุปกรณ์</th>
                  <th className="py-3 px-3">ชนิดสาร / ขนาด</th>
                  <th className="py-3 px-3">โซนคลังสินค้า</th>
                  <th className="py-3 px-3">สถานะ</th>
                  <th className="py-3 px-3">ตรวจล่าสุด</th>
                  <th className="py-3 px-3">ผู้ตรวจสอบ</th>
                  <th className="py-3 px-3">ข้อบกพร่อง / หมายเหตุ</th>
                  <th className="py-3 px-3 text-center no-print">หลักฐาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {completeEquipmentRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      ไม่พบข้อมูลถังดับเพลิงตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  completeEquipmentRows.map((row, index) => {
                    const eq = row.equipment;
                    const isExt = eq.type === 'fire_extinguisher';

                    return (
                      <tr key={eq.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">{index + 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {onSelectEquipment ? (
                            <button
                              type="button"
                              onClick={() => onSelectEquipment(eq)}
                              className="font-mono font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                              title="ดูและแก้ไขข้อมูลถังดับเพลิงนี้"
                            >
                              {isExt ? (
                                <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              ) : (
                                <Waves className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              )}
                              <span>{eq.id}</span>
                            </button>
                          ) : (
                            <span className="font-mono font-bold text-amber-700">{eq.id}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-700">
                          <div className="font-medium text-slate-900">{row.canonicalSubType}</div>
                          <div className="text-[10px] text-slate-500">
                            {row.canonicalCapacity} · หมดอายุ {eq.expiryDate || '-'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-700">
                          <div>{eq.zoneName}</div>
                          <div className="text-[10px] text-slate-400">ผังหน้า {eq.pageNumber}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              eq.status === 'READY'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : eq.status === 'DEFECTIVE'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : eq.status === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {eq.status === 'READY'
                              ? 'PASS (READY)'
                              : eq.status === 'DEFECTIVE'
                              ? 'FAIL (DEFECTIVE)'
                              : eq.status === 'IN_PROGRESS'
                              ? 'IN PROGRESS'
                              : 'PENDING'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                          {row.effectiveInspectedAt ? (
                            <>
                              {new Date(row.effectiveInspectedAt).toLocaleDateString('th-TH')}{' '}
                              <span className="text-slate-400 text-[10px]">
                                {new Date(row.effectiveInspectedAt).toLocaleTimeString('th-TH', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-sans">รอตรวจสอบ</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-700 whitespace-nowrap">
                          {row.effectiveInspector}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 max-w-xs truncate">
                          {row.latestInsp?.defectDetails ? (
                            <span className="text-rose-700 font-semibold">{row.latestInsp.defectDetails}</span>
                          ) : row.latestInsp?.notes ? (
                            row.latestInsp.notes
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center no-print">
                          {row.latestInsp?.photoUrl ? (
                            <button
                              onClick={() => setSelectedPhoto(row.latestInsp?.photoUrl || null)}
                              className="p-1 hover:bg-slate-100 text-amber-600 rounded transition-colors cursor-pointer"
                              title="ดูรูปถ่ายหลักฐาน"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-3 text-center">#</th>
                  <th className="py-3 px-3">วันที่ / เวลา</th>
                  <th className="py-3 px-3">รหัสอุปกรณ์</th>
                  <th className="py-3 px-3">ชนิดสาร / ขนาด</th>
                  <th className="py-3 px-3">โซนคลังสินค้า</th>
                  <th className="py-3 px-3">ผลการตรวจ</th>
                  <th className="py-3 px-3">ผู้ตรวจสอบ</th>
                  <th className="py-3 px-3">ข้อบกพร่อง / หมายเหตุ</th>
                  <th className="py-3 px-3 text-center no-print">หลักฐาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      ไม่พบบันทึกการตรวจสอบในช่วงเวลาและเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((item, idx) => {
                    const isPass = item.overallResult === 'PASS';
                    const matchedEq = equipmentById.get(item.equipmentId.toUpperCase());
                    const logSubType = matchedEq
                      ? getCanonicalSubType(matchedEq)
                      : item.equipmentType === 'fire_extinguisher'
                      ? 'Dry Chemical'
                      : 'ตู้ดับเพลิง';
                    const logCapacity = matchedEq ? getCanonicalCapacity(matchedEq) : '-';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                          {new Date(item.inspectedAt).toLocaleDateString('th-TH')}{' '}
                          <span className="text-slate-400 text-[10px]">
                            {new Date(item.inspectedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {onSelectEquipment ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (matchedEq) onSelectEquipment(matchedEq);
                              }}
                              className="font-mono font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                              title="ดูและแก้ไขข้อมูลถังดับเพลิงนี้"
                            >
                              <Flame className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>{item.equipmentId}</span>
                            </button>
                          ) : (
                            <span className="font-mono font-bold text-amber-700">{item.equipmentId}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-700 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{logSubType}</div>
                          <div className="text-[10px] text-slate-500">{logCapacity}</div>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-700">
                          {item.zoneName}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPass
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {isPass ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-700 whitespace-nowrap">
                          {item.inspectorName} ({item.inspectorEmployeeId})
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-600 max-w-xs truncate">
                          {item.defectDetails ? (
                            <span className="text-rose-700 font-semibold">{item.defectDetails}</span>
                          ) : item.notes ? (
                            item.notes
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center no-print">
                          {item.photoUrl ? (
                            <button
                              onClick={() => setSelectedPhoto(item.photoUrl || null)}
                              className="p-1 hover:bg-slate-100 text-amber-600 rounded transition-colors cursor-pointer"
                              title="ดูรูปถ่ายหลักฐาน"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Printable Official Sign-off Footer */}
        <div className="hidden print:grid grid-cols-3 gap-6 p-8 border-t border-black text-black text-xs font-sans mt-8">
          <div className="space-y-8 text-center">
            <div>ลงชื่อ......................................................</div>
            <div>( ผู้ตรวจสอบอุปกรณ์ดับเพลิง )</div>
            <div>วันที่ ..... / ..... / 2026</div>
          </div>
          <div className="space-y-8 text-center">
            <div>ลงชื่อ......................................................</div>
            <div>( เจ้าหน้าที่ความปลอดภัยในการทำงาน จป. )</div>
            <div>วันที่ ..... / ..... / 2026</div>
          </div>
          <div className="space-y-8 text-center">
            <div>ลงชื่อ......................................................</div>
            <div>( ผู้จัดการคลังสินค้า CDC )</div>
            <div>วันที่ ..... / ..... / 2026</div>
          </div>
        </div>

      </div>

      {/* Photo Modal Viewer */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">รูปถ่ายหลักฐานประกอบการตรวจ</span>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
              <DriveImage src={selectedPhoto} alt="Evidence" className="w-full max-h-96 object-contain" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
