import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  QrCode, 
  Upload, 
  Search, 
  Flame, 
  Waves, 
  AlertCircle
} from 'lucide-react';
import { Equipment, UserRole } from '../types';

interface QRScannerModalProps {
  allEquipment: Equipment[];
  userRole?: UserRole;
  onClose: () => void;
  onEquipmentFound: (equipment: Equipment, verifiedViaQr?: boolean) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  allEquipment,
  userRole = 'VISITOR',
  onClose,
  onEquipmentFound,
}) => {
  const isInspectorOnlyQr = userRole === 'INSPECTOR';
  const [scannerMode, setScannerMode] = useState<'camera' | 'select' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const parseEquipmentId = (qrText: string): string => {
    const trimmed = qrText.trim();
    if (trimmed.includes('scan=')) {
      const match = trimmed.match(/[?&]scan=([^&]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]).toUpperCase();
    }
    if (trimmed.startsWith('{') && trimmed.includes('"id"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.id) return parsed.id.toUpperCase();
      } catch (e) {
        // ignore
      }
    }
    return trimmed.toUpperCase();
  };

  const handleScanSuccess = (decodedText: string) => {
    const id = parseEquipmentId(decodedText);
    const equip = allEquipment.find(e => e.id.toUpperCase() === id);
    if (equip) {
      stopCamera();
      onEquipmentFound(equip, true);
    } else {
      setCameraError(`ไม่พบรหัสอุปกรณ์ "${id}" ในระบบคลังสินค้า CDC`);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      const scannerId = 'reader-camera-view';
      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        (_error) => {
          // ignore
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.warn('Camera start error:', err);
      if (isInspectorOnlyQr) {
        setCameraError('ไม่สามารถเปิดกล้องในหน้าต่างนี้ได้ กรุณาอัปโหลดรูปถ่าย QR Code ที่ติดอยู่บนตัวถังเพื่อยืนยันการตรวจ');
        setScannerMode('upload');
      } else {
        setCameraError('ไม่สามารถเปิดกล้องได้ (เบราว์เซอร์อาจจำกัดสิทธิ์ในกรอบ iFrame หรือยังไม่อนุญาตให้เข้าถึงกล้อง)');
        setScannerMode('select');
      }
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error('Error stopping scanner', e);
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (scannerMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [scannerMode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      const html5QrCode = new Html5Qrcode('file-scanner-temp');
      const result = await html5QrCode.scanFile(file, true);
      handleScanSuccess(result);
    } catch (err: any) {
      setCameraError('ไม่พบ QR Code ในรูปภาพที่อัปโหลด กรุณาลองรูปใหม่อีกครั้ง');
    }
  };

  const filteredEquipment = allEquipment.filter(e => {
    const q = searchTerm.toLowerCase();
    return (
      e.id.toLowerCase().includes(q) ||
      e.zoneName.toLowerCase().includes(q) ||
      e.subType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800">
        
        {/* Header */}
        <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
              <QrCode className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">สแกน QR Code ตรวจสอบอุปกรณ์</div>
              <div className="text-[11px] text-slate-500">ระบบตรวจสอบถังและตู้ดับเพลิง CDC</div>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Navigation Tabs */}
        <div className={`grid ${isInspectorOnlyQr ? 'grid-cols-2' : 'grid-cols-3'} bg-slate-100 border-b border-slate-200 p-1 text-xs font-medium`}>
          <button
            onClick={() => setScannerMode('camera')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              scannerMode === 'camera'
                ? 'bg-white text-amber-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>กล้องสด</span>
          </button>
          {!isInspectorOnlyQr && (
            <button
              onClick={() => setScannerMode('select')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                scannerMode === 'select'
                  ? 'bg-white text-amber-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>ค้นหาอุปกรณ์</span>
            </button>
          )}
          <button
            onClick={() => setScannerMode('upload')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              scannerMode === 'upload'
                ? 'bg-white text-amber-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>อัปโหลดภาพ QR</span>
          </button>
        </div>

        {/* Body content based on mode */}
        <div className="p-5 space-y-4">
          
          {/* CAMERA MODE */}
          {scannerMode === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-300 aspect-square max-w-[320px] mx-auto flex items-center justify-center">
                <div id="reader-camera-view" className="w-full h-full" />
                
                {/* Aim Reticle Overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-amber-400 rounded-2xl relative shadow-sm">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br" />
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-slate-500 font-medium">
                นำกล้องมือถือส่องตรงกับ QR Code บนถังหรือตู้ดับเพลิง
              </div>
            </div>
          )}

          {/* UPLOAD MODE */}
          {scannerMode === 'upload' && (
            <div className="space-y-3 py-4">
              <div id="file-scanner-temp" className="hidden" />
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors group">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-amber-600 transition-colors mb-2" />
                <span className="text-xs font-semibold text-slate-800">
                  แตะเพื่อเลือกรูปภาพ QR Code จากอัลบั้ม
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  รองรับไฟล์ PNG, JPG, JPEG
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* SEARCH & QUICK PICK MODE */}
          {scannerMode === 'select' && (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหา เช่น FF1, DF83, CT34, อาหารสด, โรงอาหาร..."
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              <div className="text-xs text-slate-500 flex items-center justify-between font-medium">
                <span>เลือกอุปกรณ์เพื่อเริ่มตรวจทันที:</span>
                <span className="font-mono text-[11px]">{filteredEquipment.length} รายการ</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filteredEquipment.slice(0, 30).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      stopCamera();
                      onEquipmentFound(item, false);
                    }}
                    className="w-full p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-amber-400 flex items-center justify-between text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-bold ${
                        item.type === 'fire_extinguisher' 
                          ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                          : 'bg-sky-100 text-sky-700 border border-sky-200'
                      }`}>
                        {item.type === 'fire_extinguisher' ? <Flame className="w-3.5 h-3.5" /> : <Waves className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-mono font-bold text-xs text-slate-900 group-hover:text-amber-700 flex items-center gap-2">
                          <span>{item.id}</span>
                          <span className="text-[10px] font-sans font-normal text-slate-500">({item.subType})</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{item.zoneName}</div>
                      </div>
                    </div>
                    <span className="text-xs text-amber-700 font-semibold group-hover:underline">
                      ตรวจ →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Camera or scan error notice */}
          {cameraError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">{cameraError}</div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  {isInspectorOnlyQr
                    ? 'สำหรับผู้ตรวจสอบ (Inspector) ต้องสแกน QR Code ที่ติดอยู่บนตัวถังด้วยกล้องหรืออัปโหลดภาพ QR เท่านั้น'
                    : 'ท่านสามารถใช้แท็บ "ค้นหาอุปกรณ์" เพื่อเลือกอุปกรณ์จำลองการสแกนได้ทันที'}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>รหัสอุปกรณ์เชื่อมโยงกับฐานข้อมูล CDC</span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-600 hover:text-slate-900 font-medium"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
