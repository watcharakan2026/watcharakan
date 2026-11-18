import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Flame, 
  Waves, 
  ArrowRight, 
  ShieldCheck, 
  QrCode, 
  MapPin, 
  Wrench, 
  FileSpreadsheet,
  AlertOctagon
} from 'lucide-react';
import { DashboardMetrics, InspectionRecord, CorrectiveAction } from '../types';

interface DashboardOverviewProps {
  metrics: DashboardMetrics | null;
  recentInspections: InspectionRecord[];
  activeDefects: CorrectiveAction[];
  onOpenScanner: () => void;
  onNavigateToZone: (zoneId: string) => void;
  onNavigateToDefects: () => void;
  onOpenReports: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  metrics,
  recentInspections,
  activeDefects,
  onOpenScanner,
  onNavigateToZone,
  onNavigateToDefects,
  onOpenReports,
}) => {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 text-sm">กำลังโหลดข้อมูลแดชบอร์ดความปลอดภัย...</div>
      </div>
    );
  }

  const openDefects = activeDefects.filter(d => d.status === 'OPEN' || d.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Banner Alert if defects exist */}
      {openDefects.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <AlertOctagon className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-rose-950">
                พบอุปกรณ์ดับเพลิงชำรุดหรือมีข้อบกพร่อง {openDefects.length} รายการ
              </div>
              <div className="text-xs text-rose-700">
                อุปกรณ์ไม่พร้อมใช้งาน จำเป็นต้องเข้าแก้ไขเพื่อความปลอดภัยของคลังสินค้า CDC
              </div>
            </div>
          </div>
          <button
            onClick={onNavigateToDefects}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors shrink-0 shadow-xs"
          >
            <span>ดูรายการแจ้งแก้ไข</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Total Equipment */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>อุปกรณ์ทั้งหมด</span>
            <span className="font-mono text-[11px] text-slate-400">TOTAL</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-slate-900">
              {metrics.totalEquipment}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {metrics.totalEquipment} ถังดับเพลิง (20 แผนผัง)
            </div>
          </div>
        </div>

        {/* Inspected */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ตรวจสอบแล้ว</span>
            <span className="font-mono text-[11px] font-semibold text-sky-600">
              {metrics.inspectionRate}%
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-sky-600">
              {metrics.inspectedCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              ในรอบเดือนปัจจุบัน
            </div>
          </div>
        </div>

        {/* Ready to Use (Green) */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              พร้อมใช้งาน
            </span>
            <span className="font-mono text-[11px] text-emerald-700 font-semibold">READY</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-700">
              {metrics.readyCount}
            </div>
            <div className="mt-1 text-xs text-emerald-800 font-mono">
              {metrics.readinessRate}% พร้อมปฏิบัติการ
            </div>
          </div>
        </div>

        {/* Defective (Red) */}
        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-rose-800 font-medium">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              พบข้อบกพร่อง
            </span>
            <span className="font-mono text-[11px] text-rose-700 font-semibold">DEFECT</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-rose-600">
              {metrics.defectiveCount + metrics.inProgressCount}
            </div>
            <div className="mt-1 text-xs text-rose-700">
              {metrics.defectiveCount} รอซ่อม · {metrics.inProgressCount} กำลังซ่อม
            </div>
          </div>
        </div>

        {/* Pending (Yellow) */}
        <div className="col-span-2 md:col-span-1 bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-800 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              ยังไม่ตรวจสอบ
            </span>
            <span className="font-mono text-[11px] text-amber-700 font-semibold">PENDING</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-700">
              {metrics.pendingCount}
            </div>
            <div className="mt-1 text-xs text-amber-800">
              รอบตรวจเดือนนี้
            </div>
          </div>
        </div>

      </div>

      {/* Quick Action Bar for Field Inspectors */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <QrCode className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              ระบบตรวจสอบผ่านโทรศัพท์มือถือ (Mobile QR Inspection)
            </div>
            <div className="text-xs text-slate-500">
              สแกน QR Code ประจำถัง/ตู้ดับเพลิงเพื่อกรอก Checklist และบันทึกผลได้ทันที
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs"
          >
            <QrCode className="w-4 h-4" />
            <span>เริ่มสแกน QR Code ตรวจสอบ</span>
          </button>
          <button
            onClick={() => onNavigateToZone('zone-fresh')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
          >
            <MapPin className="w-4 h-4 text-slate-500" />
            <span>เปิดแผนผัง 2D</span>
          </button>
          <button
            onClick={onOpenReports}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>รายงานสรุป</span>
          </button>
        </div>
      </div>

      {/* Equipment Breakdown by Type & Readiness Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Breakdown by Equipment Type */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">ประเภทอุปกรณ์ดับเพลิง</h3>
            <span className="text-xs text-slate-500">CDC Warehouse</span>
          </div>

          {/* Fire Extinguishers Overview Card */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Flame className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">ถังดับเพลิงทั้งหมด (Fire Extinguishers)</div>
                  <div className="text-[11px] text-slate-500">รวม 212 จุดติดตั้งตามแบบแปลนคลังสินค้า</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-bold font-mono text-slate-900">
                  {metrics.totalEquipment}
                </span>
                <span className="text-xs text-slate-500 ml-1">ถัง</span>
              </div>
            </div>
            {/* Mini Progress */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all" 
                style={{ width: `${(metrics.readyCount / metrics.totalEquipment) * 100}%` }}
                title={`พร้อมใช้งาน: ${metrics.readyCount}`}
              />
              <div 
                className="bg-rose-500 h-full transition-all" 
                style={{ width: `${((metrics.defectiveCount + metrics.inProgressCount) / metrics.totalEquipment) * 100}%` }}
                title={`ชำรุด: ${metrics.defectiveCount + metrics.inProgressCount}`}
              />
              <div 
                className="bg-amber-400 h-full transition-all" 
                style={{ width: `${(metrics.pendingCount / metrics.totalEquipment) * 100}%` }}
                title={`ยังไม่ตรวจ: ${metrics.pendingCount}`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono">
              <span className="text-emerald-700 font-semibold">✓ พร้อม: {metrics.readyCount}</span>
              <span className="text-rose-700 font-semibold">✕ ชำรุด: {metrics.defectiveCount + metrics.inProgressCount}</span>
              <span className="text-amber-800 font-semibold">⏳ รอตรวจ: {metrics.pendingCount}</span>
            </div>
          </div>

          {/* Extinguisher Specification Card */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">มาตรฐานความปลอดภัย (Safety Standard)</div>
                  <div className="text-[11px] text-slate-500">NFPA 10 / มอก. 332-2537 ระดับความพร้อม {metrics.readinessRate}%</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-bold font-mono text-emerald-700">
                  {metrics.readinessRate}%
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-600 leading-relaxed bg-white p-2 rounded border border-slate-200">
              ทุกจุดติดตั้งใช้สัญลักษณ์ถังดับเพลิง (Flame) พร้อมรหัสเดิม ครอบคลุมชนิดผงเคมีแห้ง 15 lbs, ก๊าซ CO2 10 lbs และสารสะอาด
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100">
            <span>เกณฑ์ความปลอดภัยมาตรฐาน ISO 45001</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Active
            </span>
          </div>
        </div>

        {/* Zone Status Breakdown Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">สถานะการตรวจสอบแยกตามโซน (20 โซน)</h3>
              <p className="text-xs text-slate-500">คลิกที่โซนเพื่อเปิดดูแผนผัง 2D Layout ทันที</p>
            </div>
            <button
              onClick={() => onNavigateToZone('zone-fresh')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
            >
              <span>ดูผังทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto max-h-[340px] overflow-y-auto pr-1">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-600 border-b border-slate-200 sticky top-0 bg-slate-50">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">ผัง & โซนคลังสินค้า</th>
                  <th className="py-2.5 px-2 font-semibold text-right font-mono text-rose-800">จำนวนถัง (FE)</th>
                  <th className="py-2.5 px-2 font-semibold text-right font-mono">ตรวจแล้ว</th>
                  <th className="py-2.5 px-2 font-semibold text-right font-mono">ชำรุด</th>
                  <th className="py-2.5 px-2 font-semibold text-right font-mono">รอตรวจ</th>
                  <th className="py-2.5 px-3 font-semibold text-right">ความคืบหน้า</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {metrics.byZone.map((z, idx) => {
                  const pct = z.total > 0 ? Math.round((z.inspected / z.total) * 100) : 0;
                  const pageNum = z.pageNumber || (idx + 1);
                  return (
                    <tr
                      key={z.zoneId}
                      onClick={() => onNavigateToZone(z.zoneId)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-800 group-hover:text-amber-700 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-bold shrink-0">
                          P{pageNum}
                        </span>
                        <span className="truncate max-w-[200px]">{z.zoneName}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-rose-700 font-bold">
                        {z.total} ถัง
                      </td>
                      <td className="py-2.5 px-2 text-right text-sky-700 font-semibold">{z.inspected}</td>
                      <td className="py-2.5 px-2 text-right">
                        {z.defective > 0 ? (
                          <span className="text-rose-600 font-bold">{z.defective}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right text-amber-700 font-semibold">{z.pending}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[11px] text-slate-600">{pct}%</span>
                          <div className="w-14 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${z.defective > 0 ? 'bg-rose-500' : pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/90 font-bold border-t-2 border-slate-200 text-slate-900 sticky bottom-0">
                <tr>
                  <td className="py-2.5 px-3 font-sans">รวมทุกแผนผัง (Total 20 Plans)</td>
                  <td className="py-2.5 px-2 text-right text-rose-700 font-mono text-sm">{metrics.totalEquipment} ถัง</td>
                  <td className="py-2.5 px-2 text-right text-sky-700 font-mono">{metrics.inspectedCount}</td>
                  <td className="py-2.5 px-2 text-right text-rose-700 font-mono">{metrics.defectiveCount + metrics.inProgressCount}</td>
                  <td className="py-2.5 px-2 text-right text-amber-700 font-mono">{metrics.pendingCount}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">{metrics.inspectionRate}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>

      {/* Recent Activity & Active Defects Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Active Corrective Actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">รายการติดตามแก้ไข (Corrective Actions)</h3>
            </div>
            <button
              onClick={onNavigateToDefects}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium"
            >
              ดูทั้งหมด ({activeDefects.length})
            </button>
          </div>

          {openDefects.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              ไม่มีอุปกรณ์ที่อยู่ระหว่างแจ้งซ่อม ทุกชิ้นพร้อมใช้งานสมบูรณ์
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {openDefects.map(def => (
                <div
                  key={def.id}
                  onClick={onNavigateToDefects}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                        {def.equipmentId}
                      </span>
                      <span className="text-xs text-slate-800 font-medium">{def.zoneName}</span>
                    </div>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                      def.status === 'OPEN' 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {def.status === 'OPEN' ? 'รอแก้ไข' : 'กำลังดำเนินการ'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 line-clamp-1">{def.defectDetails}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200/80">
                    <span>ผู้รับผิดชอบ: {def.assignedTo}</span>
                    <span>กำหนด: {def.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Inspections Log */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-semibold text-slate-900">บันทึกการตรวจสอบล่าสุด (Audit Trail)</h3>
            </div>
            <button
              onClick={onOpenReports}
              className="text-xs text-sky-700 hover:text-sky-800 font-medium"
            >
              ดูประวัติทั้งหมด
            </button>
          </div>

          {recentInspections.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              ยังไม่มีประวัติการบันทึกการตรวจสอบใหม่ในระบบ
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {recentInspections.slice(0, 6).map(insp => (
                <div
                  key={insp.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs ${
                      insp.overallResult === 'PASS' 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-rose-100 text-rose-700 border border-rose-300'
                    }`}>
                      {insp.overallResult === 'PASS' ? '✓' : '✕'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span className="font-mono text-amber-700 font-bold">{insp.equipmentId}</span>
                        <span className="text-slate-400">·</span>
                        <span>{insp.zoneName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ผู้ตรวจ: {insp.inspectorName} ({insp.inspectorEmployeeId})
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-500 shrink-0">
                    <div>{new Date(insp.inspectedAt).toLocaleDateString('th-TH')}</div>
                    <div className="text-[10px] text-slate-400">{new Date(insp.inspectedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
