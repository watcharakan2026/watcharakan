import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Flame, 
  Waves, 
  AlertTriangle, 
  QrCode, 
  Filter, 
  Eye,
  Sliders,
  Move,
  Save,
  Plus,
  Trash2,
  Check,
  Table as TableIcon,
  Lock
} from 'lucide-react';
import { Equipment, ZoneInfo, EquipmentType, UserRole } from '../types';
import { api } from '../services/api';

interface LayoutViewerProps {
  zones: ZoneInfo[];
  selectedZoneId: string;
  onSelectZone: (zoneId: string) => void;
  equipment: Equipment[];
  onSelectEquipment: (equipment: Equipment) => void;
  onInspectEquipment: (equipment: Equipment) => void;
  onEquipmentUpdated?: (updated: Equipment) => void;
  onEquipmentBatchUpdated?: (updatedItems: Equipment[]) => void;
  onEquipmentCreated?: (newEquip: Equipment) => void;
  onEquipmentDeleted?: (id: string) => void;
  isOwner?: boolean;
  onRequestOwnerLogin?: () => void;
  userRole?: UserRole;
}

export const LayoutViewer: React.FC<LayoutViewerProps> = ({
  zones,
  selectedZoneId,
  onSelectZone,
  equipment,
  onSelectEquipment,
  onInspectEquipment,
  onEquipmentUpdated,
  onEquipmentBatchUpdated,
  onEquipmentCreated,
  onEquipmentDeleted,
  isOwner = false,
  onRequestOwnerLogin,
  userRole = 'VISITOR',
}) => {
  const isAdmin = userRole === 'ADMIN' || (isOwner && userRole !== 'INSPECTOR');
  // Navigation & Viewport State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'DEFECTIVE' | 'PENDING' | 'IN_PROGRESS'>('ALL');

  // Layout Edit Mode State
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedMoveItem, setSelectedMoveItem] = useState<Equipment | null>(null);
  const [pendingPositions, setPendingPositions] = useState<Map<string, { xPercent: number; yPercent: number }>>(new Map());
  const [isSavingPositions, setIsSavingPositions] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [isDraggingMarker, setIsDraggingMarker] = useState<boolean>(false);
  const [draggedMarkerId, setDraggedMarkerId] = useState<string | null>(null);
  const [draggedCoords, setDraggedCoords] = useState<{ x: number; y: number } | null>(null);

  // Modals & Drawers in Edit Mode
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCoordinatesDrawerOpen, setIsCoordinatesDrawerOpen] = useState<boolean>(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  const [equipmentToEdit, setEquipmentToEdit] = useState<Equipment | null>(null);

  // Add Equipment Form State
  const [newEquipId, setNewEquipId] = useState<string>('');
  const [newEquipType, setNewEquipType] = useState<EquipmentType>('fire_extinguisher');
  const [newEquipSubType, setNewEquipSubType] = useState<string>('Dry Chemical (ถังผงเคมีแห้ง 15 lbs)');
  const [newEquipCapacity, setNewEquipCapacity] = useState<string>('15 lbs (4A-5B)');
  const [newEquipX, setNewEquipX] = useState<number>(50);
  const [newEquipY, setNewEquipY] = useState<number>(50);
  const [isSubmittingNew, setIsSubmittingNew] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Equipment Form State
  const [editSubType, setEditSubType] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<string>('');
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [editNextMaintenance, setEditNextMaintenance] = useState<string>('');
  const [editX, setEditX] = useState<number>(50);
  const [editY, setEditY] = useState<number>(50);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const currentZone = zones.find(z => z.id === selectedZoneId) || zones[0];

  // Helper to get coordinates (merging saved equipment with pending position changes)
  const getEquipmentCoords = useCallback((item: Equipment) => {
    if (pendingPositions.has(item.id)) {
      return pendingPositions.get(item.id)!;
    }
    return { xPercent: item.xPercent, yPercent: item.yPercent };
  }, [pendingPositions]);

  // Filter equipment for this zone
  const zoneEquipment = equipment.filter(e => {
    if (e.zoneId !== currentZone.id) return false;
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    return true;
  });

  // Reset zoom & pan when zone changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedMoveItem(null);
  }, [selectedZoneId]);

  // Clear save banner after 4 seconds
  useEffect(() => {
    if (saveSuccessMessage) {
      const timer = setTimeout(() => setSaveSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessMessage]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.6));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Convert screen mouse coordinates to percentage on floor plan image
  const getPercentFromClient = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(1, Math.min(99, Math.round(x * 10) / 10)),
      y: Math.max(1, Math.min(99, Math.round(y * 10) / 10)),
    };
  }, []);

  // Map panning handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    
    // In edit mode: if user clicks on the plan while a marker is selected, move that marker to the clicked spot!
    if (isEditMode && selectedMoveItem && !isDraggingMarker) {
      const coords = getPercentFromClient(e.clientX, e.clientY);
      if (coords) {
        setPendingPositions(prev => {
          const next = new Map(prev);
          next.set(selectedMoveItem.id, { xPercent: coords.x, yPercent: coords.y });
          return next;
        });
        setSaveSuccessMessage(`ย้าย ${selectedMoveItem.id} ไปที่ X: ${coords.x}%, Y: ${coords.y}% แล้ว (อย่าลืมกดบันทึก)`);
        return;
      }
    }

    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingMarker && draggedMarkerId) {
      const coords = getPercentFromClient(e.clientX, e.clientY);
      if (coords) {
        setDraggedCoords(coords);
        setPendingPositions(prev => {
          const next = new Map(prev);
          next.set(draggedMarkerId, { xPercent: coords.x, yPercent: coords.y });
          return next;
        });
      }
      return;
    }

    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    if (isDraggingMarker && draggedMarkerId && draggedCoords) {
      setIsDraggingMarker(false);
      setDraggedCoords(null);
      const movedItem = equipment.find(e => e.id === draggedMarkerId);
      if (movedItem) {
        setSelectedMoveItem(movedItem);
      }
      return;
    }
    setIsPanning(false);
    setIsDraggingMarker(false);
    setDraggedMarkerId(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
      setIsPanning(true);
      setPanStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - panStart.x,
      y: e.touches[0].clientY - panStart.y,
    });
  };

  const handleTouchEnd = () => setIsPanning(false);

  // Start dragging a specific marker in Edit Mode
  const handleMarkerDragStart = (e: React.MouseEvent, item: Equipment) => {
    e.stopPropagation();
    if (!isEditMode) return;
    setIsDraggingMarker(true);
    setDraggedMarkerId(item.id);
    setSelectedMoveItem(item);
    const coords = getPercentFromClient(e.clientX, e.clientY);
    if (coords) setDraggedCoords(coords);
  };

  // Save all pending position updates to backend
  const handleSaveAllPositions = async () => {
    if (pendingPositions.size === 0) return;
    setIsSavingPositions(true);
    try {
      const updates = Array.from(pendingPositions.entries()).map(([id, pos]) => ({
        id,
        xPercent: pos.xPercent,
        yPercent: pos.yPercent,
      }));

      const res = await api.batchUpdateEquipmentPositions(updates);
      if (res.success) {
        setSaveSuccessMessage(`บันทึกตำแหน่ง ${res.count} จุดเรียบร้อยแล้ว`);
        setPendingPositions(new Map());
        if (onEquipmentBatchUpdated) {
          onEquipmentBatchUpdated(res.equipment);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกตำแหน่ง';
      alert(errorMsg);
    } finally {
      setIsSavingPositions(false);
    }
  };

  // Discard pending changes
  const handleDiscardPositions = () => {
    if (pendingPositions.size > 0 && !window.confirm('ต้องการยกเลิกตำแหน่งที่ยังไม่ได้บันทึกทั้งหมดหรือไม่?')) {
      return;
    }
    setPendingPositions(new Map());
    setSelectedMoveItem(null);
  };

  // Open Add Point Modal
  const handleOpenAddModal = (initialX = 50, initialY = 50) => {
    const existingIds = new Set(equipment.map(e => e.id));
    let suggestedId = `FE-${currentZone.nameEn.split(' ')[0].toUpperCase()}-${zoneEquipment.length + 1}`;
    let counter = 1;
    while (existingIds.has(suggestedId)) {
      counter++;
      suggestedId = `FE-${currentZone.nameEn.split(' ')[0].toUpperCase()}-${zoneEquipment.length + counter}`;
    }

    setNewEquipId(suggestedId);
    setNewEquipType('fire_extinguisher');
    setNewEquipSubType('Dry Chemical (ถังผงเคมีแห้ง 15 lbs)');
    setNewEquipCapacity('15 lbs (4A-5B)');
    setNewEquipX(initialX);
    setNewEquipY(initialY);
    setAddError(null);
    setIsAddModalOpen(true);
  };

  // Submit Add Equipment
  const handleSubmitNewEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipId.trim()) {
      setAddError('กรุณาระบุรหัสอุปกรณ์ (Equipment ID)');
      return;
    }

    setIsSubmittingNew(true);
    setAddError(null);
    try {
      const res = await api.createEquipment({
        id: newEquipId.trim().toUpperCase(),
        type: newEquipType,
        subType: newEquipSubType,
        zoneId: currentZone.id,
        zoneName: currentZone.nameTh,
        pageNumber: currentZone.pageNumber,
        xPercent: newEquipX,
        yPercent: newEquipY,
        capacity: newEquipCapacity,
        expiryDate: '2031-12-31',
        nextMaintenanceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      if (res.success) {
        setIsAddModalOpen(false);
        setSaveSuccessMessage(`เพิ่มอุปกรณ์ ${res.equipment.id} บนผังสำเร็จ`);
        if (onEquipmentCreated) {
          onEquipmentCreated(res.equipment);
        }
        setSelectedMoveItem(res.equipment);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์';
      setAddError(errorMsg);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Open Edit Equipment Modal
  const handleOpenEditModal = (item: Equipment) => {
    const coords = getEquipmentCoords(item);
    setEquipmentToEdit(item);
    setEditSubType(item.subType);
    setEditCapacity(item.capacity || '');
    setEditExpiryDate(item.expiryDate || '');
    setEditNextMaintenance(item.nextMaintenanceDate || '');
    setEditX(coords.xPercent);
    setEditY(coords.yPercent);
    setIsEditModalOpen(true);
  };

  // Submit Edit Equipment Details
  const handleSubmitEditEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentToEdit) return;

    setIsSubmittingEdit(true);
    try {
      const res = await api.updateEquipment(equipmentToEdit.id, {
        subType: editSubType,
        capacity: editCapacity,
        expiryDate: editExpiryDate,
        nextMaintenanceDate: editNextMaintenance,
        xPercent: editX,
        yPercent: editY,
      });

      if (res.success) {
        setIsEditModalOpen(false);
        setSaveSuccessMessage(`อัปเดตข้อมูล ${res.equipment.id} เรียบร้อยแล้ว`);
        // Remove from pending positions if was there
        setPendingPositions(prev => {
          const next = new Map(prev);
          next.delete(equipmentToEdit.id);
          return next;
        });
        if (onEquipmentUpdated) {
          onEquipmentUpdated(res.equipment);
        }
        setSelectedMoveItem(res.equipment);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอัปเดต';
      alert(errorMsg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Delete Equipment Confirmation
  const handleConfirmDeleteEquipment = async () => {
    if (!equipmentToDelete) return;
    try {
      const res = await api.deleteEquipment(equipmentToDelete.id);
      if (res.success) {
        setSaveSuccessMessage(`ลบจุดติดตั้ง ${equipmentToDelete.id} ออกจากผังแล้ว`);
        setPendingPositions(prev => {
          const next = new Map(prev);
          next.delete(equipmentToDelete.id);
          return next;
        });
        if (selectedMoveItem?.id === equipmentToDelete.id) {
          setSelectedMoveItem(null);
        }
        if (onEquipmentDeleted) {
          onEquipmentDeleted(equipmentToDelete.id);
        }
        setEquipmentToDelete(null);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบ';
      alert(errorMsg);
    }
  };

  // Helper for marker color
  const getMarkerBadgeStyle = (status: Equipment['status'], isModified: boolean, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-slate-900 shadow-lg scale-125 z-40';
    }
    if (isModified) {
      return 'bg-sky-600 text-white border-sky-300 ring-2 ring-sky-400 shadow-md animate-bounce z-30';
    }
    switch (status) {
      case 'READY':
        return 'bg-emerald-600 text-white border-emerald-500 shadow-sm';
      case 'DEFECTIVE':
        return 'bg-rose-600 text-white border-rose-400 animate-pulse shadow-sm';
      case 'IN_PROGRESS':
        return 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm';
      case 'PENDING':
      default:
        return 'bg-emerald-600/95 text-white border-emerald-500 shadow-sm';
    }
  };

  const pendingCount = pendingPositions.size;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      
      {/* Top Notification / Save Banner */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button 
            onClick={() => setSaveSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Zone Selector and View Controls Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        
        {/* Zone Selector Dropdown & Info */}
        <div className="flex-1 w-full md:w-auto">
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5 font-medium">
            <span>ผังความปลอดภัยคลังสินค้า CDC (20 โซน)</span>
            <span>·</span>
            <span className="font-mono text-amber-700 font-bold">
              Page {currentZone.pageNumber}/20 · ถังดับเพลิง {zoneEquipment.length} ถัง
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="เลือกโซนคลังสินค้า"
              value={selectedZoneId}
              onChange={(e) => onSelectZone(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[240px] bg-slate-50 text-slate-900 font-semibold text-sm rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id} className="bg-white text-slate-800 py-1">
                  [{z.pageNumber}] {z.nameTh} ({z.floor})
                </option>
              ))}
            </select>
            
            <div className="text-xs text-slate-500 hidden lg:inline">
              {currentZone.description}
            </div>
          </div>
        </div>

        {/* Action Buttons: Edit Mode Toggle & Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          
          {/* EDIT MODE TOGGLE BUTTON */}
          {isAdmin ? (
            <button
              onClick={() => {
                if (isEditMode && pendingCount > 0) {
                  if (window.confirm('มีตำแหน่งที่ยังไม่ได้บันทึก ต้องการบันทึกก่อนปิดโหมดปรับแต่งหรือไม่?')) {
                    handleSaveAllPositions();
                  }
                }
                setIsEditMode(!isEditMode);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs border cursor-pointer ${
                isEditMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Move className="w-3.5 h-3.5 text-slate-900" />
              <span>{isEditMode ? 'กำลังเปิดโหมดปรับตำแหน่ง (Active)' : '🛠️ ปรับตำแหน่งจุดติดตั้ง'}</span>
            </button>
          ) : (
            <button
              onClick={onRequestOwnerLogin}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all shadow-xs border bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer"
              title="เข้าสู่ระบบ Admin เพื่อปรับแต่งตำแหน่งจุดติดตั้ง"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>ปรับตำแหน่ง (เฉพาะ ADMIN)</span>
            </button>
          )}

          {/* ADD POINT BUTTON (ADMIN ONLY) */}
          {isAdmin && (
            <button
              onClick={() => handleOpenAddModal(50, 50)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer"
              title="เพิ่มจุดติดตั้งถังหรือตู้ดับเพลิงใหม่"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มจุดใหม่</span>
            </button>
          )}

          {/* COORDINATES DRAWER BUTTON */}
          <button
            onClick={() => setIsCoordinatesDrawerOpen(!isCoordinatesDrawerOpen)}
            className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              isCoordinatesDrawerOpen
                ? 'bg-slate-100 text-slate-900 border-slate-300 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="เปิดตารางพิกัดทั้งหมดในโซนนี้"
          >
            <TableIcon className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">ตารางพิกัด</span>
          </button>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2 py-1 rounded transition-colors ${statusFilter === 'ALL' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setStatusFilter('READY')}
              className={`px-2 py-1 rounded transition-colors ${statusFilter === 'READY' ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'text-slate-600 hover:text-emerald-700'}`}
            >
              พร้อม
            </button>
            <button
              onClick={() => setStatusFilter('DEFECTIVE')}
              className={`px-2 py-1 rounded transition-colors ${statusFilter === 'DEFECTIVE' ? 'bg-rose-100 text-rose-800 font-semibold' : 'text-slate-600 hover:text-rose-700'}`}
            >
              ชำรุด
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono px-1.5 text-[11px] text-slate-600 select-none font-semibold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1.5 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset View"
              className="p-1.5 hover:bg-white rounded text-slate-500 hover:text-slate-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

      {/* EDIT MODE ACTIVE INSTRUCTION & SAVE BAR */}
      {isEditMode && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
              <Move className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950 flex items-center gap-2">
                <span>โหมดปรับแต่งตำแหน่งจุดติดตั้งอุปกรณ์ (Layout Drag & Relocate)</span>
                {pendingCount > 0 && (
                  <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold animate-pulse">
                    มีการย้าย {pendingCount} จุด
                  </span>
                )}
              </div>
              <div className="text-[11px] text-amber-900/80">
                คลิกค้างแล้วลาก (Drag) จุดไปวางใหม่ หรือคลิกที่จุดแล้วคลิกบนผังเพื่อย้ายตำแหน่งทันที
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {pendingCount > 0 && (
              <>
                <button
                  onClick={handleDiscardPositions}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  ยกเลิก ({pendingCount})
                </button>
                <button
                  onClick={handleSaveAllPositions}
                  disabled={isSavingPositions}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                >
                  {isSavingPositions ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>บันทึกตำแหน่ง ({pendingCount})</span>
                </button>
              </>
            )}
            <button
              onClick={() => setIsEditMode(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Map Viewport */}
      <div 
        ref={containerRef}
        className={`relative w-full h-[340px] sm:h-[480px] lg:h-[620px] touch-none bg-slate-100 border border-slate-200 rounded-xl overflow-hidden select-none shadow-xs ${
          isEditMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Transformable Canvas Layer */}
        <div
          className={`relative w-full h-full origin-top-left will-change-transform ${
            isPanning || isDraggingMarker ? '' : 'transition-transform duration-200 ease-out'
          }`}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          }}
        >
          {/* Real Background Floor Plan Image extracted from PDF */}
          <img
            ref={imgRef}
            src={currentZone.imagePath}
            alt={currentZone.nameTh}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain pointer-events-none drop-shadow-sm"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          {/* Guidelines when dragging in Edit Mode */}
          {isDraggingMarker && draggedCoords && (
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Vertical guideline */}
              <div
                style={{ left: `${draggedCoords.x}%` }}
                className="absolute top-0 bottom-0 border-l border-dashed border-sky-500/80 w-px"
              />
              {/* Horizontal guideline */}
              <div
                style={{ top: `${draggedCoords.y}%` }}
                className="absolute left-0 right-0 border-t border-dashed border-sky-500/80 h-px"
              />
            </div>
          )}

          {/* Interactive Equipment Markers Overlaid on Real Plan */}
          {zoneEquipment.map((item) => {
            const isDefective = item.status === 'DEFECTIVE';
            const isSelected = selectedMoveItem?.id === item.id;
            const isModified = pendingPositions.has(item.id);
            const coords = getEquipmentCoords(item);

            return (
              <div
                key={item.id}
                style={{
                  left: `${coords.xPercent}%`,
                  top: `${coords.yPercent}%`,
                  position: 'absolute',
                  transform: 'translate(-50%, -50%)',
                }}
                className={`z-20 group ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                onMouseDown={(e) => {
                  if (isEditMode) {
                    handleMarkerDragStart(e, item);
                  }
                }}
              >
                {/* Defect Pulse Ring */}
                {isDefective && !isEditMode && (
                  <span className="absolute -inset-2 rounded-full bg-rose-500/40 animate-ping pointer-events-none" />
                )}

                {/* Selected Ring */}
                {isSelected && (
                  <span className="absolute -inset-2 rounded-full border-2 border-amber-500 bg-amber-400/20 animate-pulse pointer-events-none" />
                )}

                {/* Modified Indicator */}
                {isModified && (
                  <span className="absolute -top-3 -right-2 bg-sky-600 text-[9px] text-white font-mono px-1 rounded-full font-bold shadow-xs">
                    NEW
                  </span>
                )}

                {/* Marker Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditMode) {
                      setSelectedMoveItem(item);
                    } else {
                      onSelectEquipment(item);
                    }
                  }}
                  className={`relative flex items-center justify-center gap-1 min-w-[46px] min-h-[22px] px-1.5 py-0.5 rounded-[4px] shadow-sm border text-[11px] font-mono font-bold transition-transform duration-150 ease-out ${getMarkerBadgeStyle(
                    item.status,
                    isModified,
                    isSelected
                  )} ${isEditMode ? 'hover:scale-110' : 'hover:scale-125'}`}
                >
                  <Flame className="w-3 h-3 shrink-0" />
                  <span>{item.id}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Floating Controls Overlay: Legend and Equipment Counter (Desktop/Tablet inside map so mobile pins stay clear) */}
        <div className="hidden sm:block absolute bottom-3 left-3 bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 shadow-md space-y-1.5 z-30 max-w-xs">
          <div className="font-semibold text-slate-900 flex items-center justify-between pb-1 border-b border-slate-100">
            <span>คำอธิบายสถานะอุปกรณ์ (Legend)</span>
            <span className="font-mono text-amber-700 font-bold">{zoneEquipment.length} ชิ้นในโซนนี้</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>พร้อมใช้งาน (Ready)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
              <span>พบชำรุด (Defective)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>กำลังแก้ไข (In Progress)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span>ยังไม่ตรวจ (Pending)</span>
            </div>
          </div>
          <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-2 border-t border-slate-100">
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <Flame className="w-3 h-3 text-emerald-600" /> สัญลักษณ์สีเขียว = จุดติดตั้งถังดับเพลิง (รันเลขตรงตามตำแหน่งผัง)
            </span>
          </div>
        </div>
      </div>

      {/* Compact Mobile Legend Bar (Placed below viewport so map pins aren't covered) */}
      <div className="sm:hidden bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 shadow-xs space-y-2">
        <div className="flex items-center justify-between font-semibold text-slate-900 pb-1 border-b border-slate-100">
          <span>คำอธิบายสถานะอุปกรณ์</span>
          <span className="font-mono text-amber-700 font-bold">{zoneEquipment.length} ชิ้นในโซนนี้</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
            <span>พร้อมใช้งาน (Ready)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
            <span>พบชำรุด (Defective)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span>กำลังแก้ไข (In Progress)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
            <span>ยังไม่ตรวจ (Pending)</span>
          </div>
        </div>
      </div>

      {/* Zone Quick Navigator Strips */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
        <div className="text-xs text-slate-600 mb-2 font-medium flex items-center justify-between">
          <span>เลือกเปิดแผนผังแบบเร็ว (Quick Zone Jump):</span>
          <span className="text-slate-400 text-[11px]">20 Floors & Sections</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {zones.map((z) => {
            const isCurrent = z.id === selectedZoneId;
            const zoneItems = equipment.filter(e => e.zoneId === z.id);
            const extCount = zoneItems.length;
            const hasDefect = zoneItems.some(e => e.status === 'DEFECTIVE');
            
            return (
              <button
                key={z.id}
                onClick={() => onSelectZone(z.id)}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 transition-all border flex items-center gap-1.5 ${
                  isCurrent 
                    ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="font-mono text-[10px] text-slate-400">P{z.pageNumber}</span>
                <span>{z.shortName || z.nameTh}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${isCurrent ? 'bg-amber-200 text-amber-950 font-bold' : 'text-slate-500'}`}>
                  {extCount} ถัง
                </span>
                {hasDefect && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="มีอุปกรณ์ชำรุด" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* COORDINATES DRAWER / TABLE MODAL */}
      {isCoordinatesDrawerOpen && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                ตารางพิกัดจุดติดตั้งอุปกรณ์: {currentZone.nameTh} ({zoneEquipment.length} จุด)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenAddModal(50, 50)}
                className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>เพิ่มจุดใหม่</span>
              </button>
              <button
                onClick={() => setIsCoordinatesDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1"
              >
                ✕ ปิด
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">รหัส (ID)</th>
                  <th className="py-2 px-3">ประเภท</th>
                  <th className="py-2 px-3">รุ่น / ขนาด</th>
                  <th className="py-2 px-3">พิกัด X (%)</th>
                  <th className="py-2 px-3">พิกัด Y (%)</th>
                  <th className="py-2 px-3">สถานะ</th>
                  <th className="py-2 px-3 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {zoneEquipment.map((item) => {
                  const coords = getEquipmentCoords(item);
                  const isModified = pendingPositions.has(item.id);
                  const isSelected = selectedMoveItem?.id === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-amber-50 font-medium' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        {item.id}
                        {isModified && (
                          <span className="ml-1 text-[9px] text-sky-600 font-mono font-bold">
                            (ย้ายแล้ว)
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {item.type === 'fire_extinguisher' ? 'ถังดับเพลิง' : 'ตู้ดับเพลิง'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[160px]">
                        {item.subType}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="99"
                          value={coords.xPercent}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPendingPositions(prev => {
                              const next = new Map(prev);
                              next.set(item.id, { xPercent: val, yPercent: coords.yPercent });
                              return next;
                            });
                          }}
                          className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs bg-white"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="99"
                          value={coords.yPercent}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPendingPositions(prev => {
                              const next = new Map(prev);
                              next.set(item.id, { xPercent: coords.xPercent, yPercent: val });
                              return next;
                            });
                          }}
                          className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs bg-white"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${getMarkerBadgeStyle(item.status, false, false)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedMoveItem(item);
                            setIsEditMode(true);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                          title="เล็งตำแหน่งบนผัง"
                        >
                          เล็งตำแหน่ง
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                          title="แก้ไขข้อมูล"
                        >
                          แก้ไข
                        </button>
                        <button
                          onClick={() => setEquipmentToDelete(item)}
                          className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600"
                          title="ลบจุดนี้"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW EQUIPMENT POINT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">เพิ่มจุดติดตั้งอุปกรณ์ดับเพลิงใหม่</h3>
                  <div className="text-[11px] text-slate-500">{currentZone.nameTh}</div>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewEquipment} className="p-5 space-y-4 text-xs">
              {addError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {addError}
                </div>
              )}

              {/* Equipment ID */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">รหัสอุปกรณ์ (Equipment ID) *</label>
                <input
                  type="text"
                  required
                  value={newEquipId}
                  onChange={(e) => setNewEquipId(e.target.value.toUpperCase())}
                  placeholder="เช่น FF15, DF85, FE-01"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm uppercase focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Type Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ประเภทอุปกรณ์ *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewEquipType('fire_extinguisher');
                      setNewEquipSubType('Dry Chemical (ถังผงเคมีแห้ง 15 lbs)');
                      setNewEquipCapacity('15 lbs (4A-5B)');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      newEquipType === 'fire_extinguisher'
                        ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold ring-1 ring-rose-400'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <div className="font-bold">ถังดับเพลิง</div>
                      <div className="text-[10px] text-slate-500 font-normal">Fire Extinguisher</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewEquipType('fire_hose_cabinet');
                      setNewEquipSubType('Fire Hose Reel & Rack 1.5 in x 100 ft');
                      setNewEquipCapacity('1.5 in x 100 ft');
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                      newEquipType === 'fire_hose_cabinet'
                        ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold ring-1 ring-sky-400'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Waves className="w-4 h-4 text-sky-600 shrink-0" />
                    <div>
                      <div className="font-bold">ตู้ดับเพลิง</div>
                      <div className="text-[10px] text-slate-500 font-normal">Fire Hose Cabinet</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Subtype Dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">รุ่นและขนาดสารดับเพลิง *</label>
                {newEquipType === 'fire_extinguisher' ? (
                  <select
                    value={newEquipSubType}
                    onChange={(e) => {
                      setNewEquipSubType(e.target.value);
                      if (e.target.value.includes('15 lbs')) setNewEquipCapacity('15 lbs (4A-5B)');
                      else if (e.target.value.includes('10 lbs')) setNewEquipCapacity('10 lbs (CO2)');
                      else if (e.target.value.includes('Foam')) setNewEquipCapacity('9 Litres');
                      else if (e.target.value.includes('Fire Ade')) setNewEquipCapacity('10 Litres');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white"
                  >
                    <option value="Dry Chemical (ถังผงเคมีแห้ง 15 lbs)">Dry Chemical (ผงเคมีแห้ง 15 lbs - มาตรฐานคลังสินค้า)</option>
                    <option value="Dry Chemical (ถังผงเคมีแห้ง 10 lbs)">Dry Chemical (ผงเคมีแห้ง 10 lbs)</option>
                    <option value="CO2 Carbon Dioxide (ถังก๊าซคาร์บอนไดออกไซด์ 10 lbs)">CO2 Carbon Dioxide (ก๊าซ CO2 10 lbs - ห้องเซิร์ฟเวอร์/ตู้ไฟ)</option>
                    <option value="Clean Agent Non-CFC (สารสะอาด Halotron 10 lbs)">Clean Agent Non-CFC (สารสะอาด 10 lbs)</option>
                    <option value="Foam Extinguisher (ถังโฟม 9 ลิตร)">Foam Extinguisher (ถังโฟม 9 ลิตร - สารไวไฟ/น้ำมัน)</option>
                    <option value="Fire Ade 2000 (ถังดับเพลิงสูตรน้ำชีวภาพ)">Fire Ade 2000 (ถังดับเพลิงสูตรน้ำชีวภาพ - ดับได้ทุกประเภท A, B, C, D, K)</option>
                  </select>
                ) : (
                  <select
                    value={newEquipSubType}
                    onChange={(e) => setNewEquipSubType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white"
                  >
                    <option value="Fire Hose Reel 1 in x 100 ft">Fire Hose Reel (สายส่งน้ำแบบม้วน 1 นิ้ว x 100 ฟุต)</option>
                    <option value="Fire Hose Rack 1.5 in x 100 ft">Fire Hose Rack (สายส่งน้ำผ้าใบแบบพับ 1.5 นิ้ว x 100 ฟุต)</option>
                    <option value="Combined Cabinet (Hose Reel + Extinguisher)">ตู้ดับเพลิงคู่ (Hose Reel + ถังเคมีแห้งในตู้)</option>
                  </select>
                )}
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">พิกัดแกน X (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={newEquipX}
                    onChange={(e) => setNewEquipX(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">พิกัดแกน Y (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={newEquipY}
                    onChange={(e) => setNewEquipY(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded font-mono bg-white"
                  />
                </div>
                <div className="col-span-2 text-[10px] text-slate-500">
                  💡 Tip: หลังจากเพิ่มแล้ว สามารถใช้เมาส์ลากขยับจุดไปยังตำแหน่งที่แม่นยำบนผังได้ตลอดเวลา
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="flex-1 py-2 rounded-lg text-slate-950 bg-amber-500 hover:bg-amber-400 font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {isSubmittingNew ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>บันทึกจุดใหม่</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EQUIPMENT DETAILS */}
      {isEditModalOpen && equipmentToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">แก้ไขข้อมูลจุดติดตั้ง: {equipmentToEdit.id}</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEditEquipment} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">รุ่นและสารดับเพลิง:</label>
                <input
                  type="text"
                  value={editSubType}
                  onChange={(e) => setEditSubType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ขนาด / ความจุ:</label>
                <input
                  type="text"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  placeholder="เช่น 15 lbs หรือ 1.5 นิ้ว x 100 ft"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">วันหมดอายุสาร:</label>
                  <input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">กำหนดซ่อมบำรุงรอบถัดไป:</label>
                  <input
                    type="date"
                    value={editNextMaintenance}
                    onChange={(e) => setEditNextMaintenance(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">พิกัด X (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={editX}
                    onChange={(e) => setEditX(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-slate-200 rounded font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">พิกัด Y (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="99"
                    value={editY}
                    onChange={(e) => setEditY(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-slate-200 rounded font-mono bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex-1 py-2 rounded-lg text-slate-950 bg-amber-500 hover:bg-amber-400 font-bold flex items-center justify-center gap-1.5"
                >
                  {isSubmittingEdit ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {equipmentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">ยืนยันการลบจุดติดตั้ง?</h3>
                <div className="text-xs text-slate-500">รหัส: {equipmentToDelete.id}</div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              คุณต้องการลบจุดติดตั้ง <strong className="text-slate-900 font-mono">{equipmentToDelete.id}</strong> ({equipmentToDelete.subType}) ออกจากแผนผังความปลอดภัยคลังสินค้าหรือไม่?
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setEquipmentToDelete(null)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmDeleteEquipment}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
