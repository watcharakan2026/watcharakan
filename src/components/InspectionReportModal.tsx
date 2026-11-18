import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Filter, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Waves,
  Eye,
  Clock,
  MapPin,
  X
} from 'lucide-react';
import { InspectionRecord, ZoneInfo, Equipment } from '../types';
import { DriveImage } from './DriveImage';

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
  onClose,
  onSelectEquipment,
}) => {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'PASS' | 'FAIL'>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const filtered = inspections.filter(item => {
    const itemDate = new Date(item.inspectedAt);
    const now = new Date();
    
    if (timeFilter === 'today') {
      const isToday = itemDate.toDateString() === now.toDateString();
      if (!isToday) return false;
    } else if (timeFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (itemDate < oneWeekAgo) return false;
    } else if (timeFilter === 'month') {
      const isThisMonth = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      if (!isThisMonth) return false;
    }

    if (zoneFilter !== 'all' && item.zoneId !== zoneFilter) return false;
    if (resultFilter !== 'all' && item.overallResult !== resultFilter) return false;

    return true;
  });

  const totalCount = filtered.length;
  const passCount = filtered.filter(i => i.overallResult === 'PASS').length;
  const failCount = filtered.filter(i => i.overallResult === 'FAIL').length;
  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const handleExportCSV = () => {
    const headers = [
      'วันที่และเวลา',
      'รหัสอุปกรณ์',
      'ประเภทอุปกรณ์',
      'โซน / แผนก',
      'ผลการตรวจสอบ',
      'ผู้ตรวจสอบ',
      'รหัสพนักงาน',
      'รายละเอียดข้อบกพร่อง',
      'หมายเหตุ',
    ];

    const rows = filtered.map(i => [
      `"${new Date(i.inspectedAt).toLocaleString('th-TH')}"`,
      `"${i.equipmentId}"`,
      `"${i.equipmentType === 'fire_extinguisher' ? 'ถังดับเพลิง' : 'ตู้ดับเพลิง'}"`,
      `"${i.zoneName}"`,
      `"${i.overallResult}"`,
      `"${i.inspectorName}"`,
      `"${i.inspectorEmployeeId}"`,
      `"${(i.defectDetails || '').replace(/"/g, '""')}"`,
      `"${(i.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Fire_Safety_Report_CDC_${timeFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
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
            รายงานผลตามรอบประจำวัน สัปดาห์ เดือน และประวัติย้อนหลัง พร้อมส่งออกข้อมูล Excel และ PDF
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel (CSV)</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน (PDF)</span>
          </button>
        </div>
      </div>

      {/* Filter Strip (Hidden in Print) */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        
        {/* Time Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1.5 rounded transition-colors ${timeFilter === 'today' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ประจำวัน (Today)
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-3 py-1.5 rounded transition-colors ${timeFilter === 'week' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ประจำสัปดาห์ (Week)
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1.5 rounded transition-colors ${timeFilter === 'month' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ประจำเดือน (Month)
          </button>
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded transition-colors ${timeFilter === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ย้อนหลังทั้งหมด
          </button>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          
          {/* Result Filter */}
          <select
            aria-label="กรองผลการตรวจ"
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
          >
            <option value="all">ผลการตรวจ: ทั้งหมด</option>
            <option value="PASS">เฉพาะที่ผ่าน (PASS)</option>
            <option value="FAIL">เฉพาะที่พบชำรุด (FAIL)</option>
          </select>


          {/* Zone Filter */}
          <select
            aria-label="กรองโซนคลังสินค้า"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-slate-50 text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none max-w-[200px]"
          >
            <option value="all">ทุกโซนคลังสินค้า (20 โซน)</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nameTh}
              </option>
            ))}
          </select>

        </div>

      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">จำนวนการตรวจทั้งหมด</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{totalCount}</div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-emerald-800 font-medium">ผ่านเกณฑ์ (PASS)</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{passCount}</div>
        </div>
        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-rose-800 font-medium">พบข้อบกพร่อง (FAIL)</div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{failCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500">อัตราผ่านการตรวจ</div>
          <div className="text-2xl font-bold font-mono text-sky-600 mt-1">{passRate}%</div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        
        {/* Printable Official Header */}
        <div className="hidden print:block p-6 text-center border-b border-black">
          <h1 className="text-xl font-bold text-black uppercase">
            รายงานการตรวจสอบอุปกรณ์ดับเพลิงและตู้ดับเพลิง ประจำคลังสินค้า CDC 2026
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            พิมพ์เมื่อ: {new Date().toLocaleString('th-TH')} | มาตรฐานความปลอดภัยอาชีวอนามัย ISO 45001
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-3">วันที่ / เวลา</th>
                <th className="py-3 px-3">รหัสอุปกรณ์</th>
                <th className="py-3 px-3">ประเภท</th>
                <th className="py-3 px-3">โซนคลังสินค้า</th>
                <th className="py-3 px-3">ผลการตรวจ</th>
                <th className="py-3 px-3">ผู้ตรวจสอบ</th>
                <th className="py-3 px-3">ข้อบกพร่อง / หมายเหตุ</th>
                <th className="py-3 px-3 text-center no-print">หลักฐาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    ไม่พบบันทึกการตรวจสอบในช่วงเวลาและเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isPass = item.overallResult === 'PASS';
                  const isExt = item.equipmentType === 'fire_extinguisher';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
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
                              const eq = allEquipment.find(e => e.id.toUpperCase() === item.equipmentId.toUpperCase());
                              if (eq) onSelectEquipment(eq);
                            }}
                            className="font-mono font-bold text-amber-700 hover:text-amber-800 hover:underline flex items-center gap-1"
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
                        {isExt ? 'ถังดับเพลิง' : 'ตู้ดับเพลิง'}
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
                            className="p-1 hover:bg-slate-100 text-amber-600 rounded transition-colors"
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
