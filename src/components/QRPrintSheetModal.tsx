import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Filter, Flame, Waves, CheckCircle2 } from 'lucide-react';
import { Equipment, ZoneInfo } from '../types';

interface QRPrintSheetModalProps {
  equipmentList: Equipment[];
  zones: ZoneInfo[];
  onClose: () => void;
}

export const QRPrintSheetModal: React.FC<QRPrintSheetModalProps> = ({
  equipmentList,
  zones,
  onClose,
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  const filteredEquipment = equipmentList.filter(e => {
    if (selectedZone !== 'all' && e.zoneId !== selectedZone) return false;
    return true;
  });

  useEffect(() => {
    let isMounted = true;
    const generateQRs = async () => {
      setIsGenerating(true);
      const urls: Record<string, string> = {};

      for (const item of filteredEquipment) {
        try {
          const payload = `${window.location.origin}/?scan=${encodeURIComponent(item.id)}`;
          const dataUrl = await QRCode.toDataURL(payload, {
            width: 160,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });
          urls[item.id] = dataUrl;
        } catch (e) {
          console.error('Error generating QR for', item.id, e);
        }
      }

      if (isMounted) {
        setQrCodeDataUrls(urls);
        setIsGenerating(false);
      }
    };

    generateQRs();

    return () => {
      isMounted = false;
    };
  }, [selectedZone, filteredEquipment.length]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-800">
        
        {/* Top Controls Header (Hidden in Print) */}
        <div className="no-print bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
              <Printer className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900">
                พิมพ์สติกเกอร์ QR Code ประจำอุปกรณ์ (Equipment QR Labels)
              </div>
              <div className="text-xs text-slate-500">
                สติกเกอร์มาตรฐานพร้อมรหัส ID และคิวอาร์โค้ดสำหรับติดประจำถัง/ตู้ดับเพลิง CDC
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์สติกเกอร์ (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar (Hidden in Print) */}
        <div className="no-print bg-slate-50/80 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600 font-medium">เลือกโซนที่ต้องการพิมพ์:</span>
            <select
              aria-label="เลือกโซนพิมพ์สติกเกอร์"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">พิมพ์ทั้งหมดทุกโซน ({equipmentList.length} รายการ)</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nameTh} ({equipmentList.filter(e => e.zoneId === z.id).length} ชิ้น)
                </option>
              ))}
            </select>
          </div>
          <div className="text-slate-600 font-mono text-[11px] font-semibold">
            {filteredEquipment.length} สติกเกอร์
          </div>
        </div>

        {/* Printable Grid of Labels */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 print:bg-white print:p-0">
          
          {isGenerating ? (
            <div className="py-16 text-center text-xs text-slate-500 font-medium">
              กำลังสร้าง QR Code ความละเอียดสูง...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
              {filteredEquipment.map((item) => {
                const qrUrl = qrCodeDataUrls[item.id];
                const isExt = item.type === 'fire_extinguisher';

                return (
                  <div
                    key={item.id}
                    className="bg-white text-slate-900 rounded-xl p-3.5 border-2 border-slate-300 shadow-sm flex flex-col justify-between print:rounded-none print:border-black print:break-inside-avoid print:shadow-none"
                    style={{ minHeight: '180px' }}
                  >
                    {/* Label Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center text-slate-950 font-bold text-[10px]">
                          CDC
                        </div>
                        <span className="text-[11px] font-bold tracking-tight text-slate-800 uppercase">
                          FIRE SAFETY INSPECTION
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                        {isExt ? 'FE' : 'FHC'}
                      </span>
                    </div>

                    {/* Middle Section: ID and QR Code */}
                    <div className="flex items-center justify-between gap-3 my-2">
                      <div className="space-y-1">
                        <div className="text-2xl font-black font-mono tracking-tight text-slate-950">
                          {item.id}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-700 leading-tight">
                          {isExt ? 'ถังดับเพลิง' : 'ตู้ดับเพลิง'}
                        </div>
                        <div className="text-[9px] text-slate-500 leading-tight">
                          {item.subType}
                        </div>
                        <div className="text-[9px] text-slate-600 font-medium pt-1">
                          📍 {item.zoneName}
                        </div>
                      </div>

                      {/* QR Code Image */}
                      {qrUrl && (
                        <div className="w-24 h-24 p-1 bg-white border border-slate-200 rounded shrink-0 flex items-center justify-center">
                          <img
                            src={qrUrl}
                            alt={`QR for ${item.id}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                    </div>

                    {/* Footer instructions */}
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-600 font-mono">
                      <span>สแกนเพื่อตรวจสอบความปลอดภัย</span>
                      <span className="font-bold text-amber-700">CDC-2026</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
