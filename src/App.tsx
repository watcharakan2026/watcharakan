import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Header, TabType } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { LayoutViewer } from './components/LayoutViewer';
import { InspectionFormModal } from './components/InspectionFormModal';
import { QRScannerModal } from './components/QRScannerModal';
import { QRPrintSheetModal } from './components/QRPrintSheetModal';
import { CorrectiveActionList } from './components/CorrectiveActionList';
import { InspectionReportModal } from './components/InspectionReportModal';
import { EquipmentDetailModal } from './components/EquipmentDetailModal';
import { LoginPage } from './components/LoginPage';
import { InspectorDashboard } from './components/InspectorDashboard';
import { PublicVisitorView } from './components/PublicVisitorView';
import { UserManagementModal } from './components/UserManagementModal';
import { Equipment, ZoneInfo, User, UserRole, DashboardMetrics, InspectionRecord, CorrectiveAction } from './types';
import { api } from './services/api';
import { RotateCcw, AlertTriangle } from 'lucide-react';

const DEFAULT_VISITOR: User = {
  id: 'VIS-003',
  name: 'ผู้เข้าชมทั่วไป (Visitor)',
  username: 'visitor',
  role: 'VISITOR',
  roleNameTh: 'ผู้เข้าชม (VISITOR)',
  employeeId: 'VIS-000',
  department: 'Public / Guest',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('cdc_auth_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_VISITOR;
  });

  const userRole: UserRole = currentUser?.role || 'VISITOR';
  const isAdmin = userRole === 'ADMIN';
  const isInspector = userRole === 'INSPECTOR';
  const isVisitor = userRole === 'VISITOR' || (!isAdmin && !isInspector);

  // Active Tab: initial tab based on role
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (isAdmin) return 'dashboard';
    if (isInspector) return 'inspect-dashboard';
    return 'public-verify';
  });

  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('zone-fresh');
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentInspections, setRecentInspections] = useState<InspectionRecord[]>([]);
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Modals & Dialogs
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isPrintSheetOpen, setIsPrintSheetOpen] = useState<boolean>(false);
  const [inspectingEquipment, setInspectingEquipment] = useState<Equipment | null>(null);
  const [selectedEquipmentDetail, setSelectedEquipmentDetail] = useState<Equipment | null>(null);
  const [qrVerifiedIds, setQrVerifiedIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Handle Login Success with role-based routing
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('cdc_auth_user', JSON.stringify(user));
    } catch {
      // ignore
    }
    setIsLoginOpen(false);

    // Automatic role-based redirect
    if (user.role === 'ADMIN') {
      setActiveTab('dashboard');
    } else if (user.role === 'INSPECTOR') {
      setActiveTab('inspect-dashboard');
    } else {
      setActiveTab('public-verify');
    }
  };

  const handleContinueAsVisitor = () => {
    setCurrentUser(DEFAULT_VISITOR);
    localStorage.removeItem('cdc_auth_user');
    setIsLoginOpen(false);
    setActiveTab('public-verify');
  };

  const handleLogout = () => {
    setCurrentUser(DEFAULT_VISITOR);
    localStorage.removeItem('cdc_auth_user');
    setActiveTab('public-verify');
  };

  // Load initial warehouse data
  const loadData = useCallback(async () => {
    try {
      const [fetchedZones, fetchedUsers, fetchedEquip, fetchedMetrics, fetchedInspections, fetchedActions] =
        await Promise.all([
          api.getZones(),
          api.getUsers(),
          api.getEquipment(),
          api.getMetrics(),
          api.getInspections({ limit: 100 }),
          api.getCorrectiveActions(),
        ]);

      setZones(fetchedZones);
      setUsers(fetchedUsers);
      setEquipmentList(fetchedEquip);
      setMetrics(fetchedMetrics);
      setRecentInspections(fetchedInspections);
      setCorrectiveActions(fetchedActions);

      // Check if URL has ?scan=... parameter (from physical QR code scan)
      const params = new URLSearchParams(window.location.search);
      const scanId = params.get('scan');
      if (scanId) {
        const found = fetchedEquip.find(e => e.id.toUpperCase() === scanId.toUpperCase());
        if (found) {
          setQrVerifiedIds(prev => {
            const next = new Set(prev);
            next.add(found.id.toUpperCase());
            return next;
          });
          setSelectedEquipmentDetail(found);
          setSelectedZoneId(found.zoneId);
        }
      }
    } catch (err) {
      console.error('Failed to load initial warehouse data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Quietly refresh aggregated metrics & logs after optimistic local state updates (zero UI flicker)
  const refreshSummaryData = useCallback(async () => {
    try {
      const [fetchedMetrics, fetchedInspections, fetchedActions] = await Promise.all([
        api.getMetrics(),
        api.getInspections({ limit: 100 }),
        api.getCorrectiveActions(),
      ]);
      setMetrics(fetchedMetrics);
      setRecentInspections(fetchedInspections);
      setCorrectiveActions(fetchedActions);
    } catch (err) {
      console.error('Background refresh failed:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Callback when an inspection is submitted
  const handleInspectionSuccess = (updatedEquipment: Equipment) => {
    setEquipmentList(prev => prev.map(e => (e.id === updatedEquipment.id ? updatedEquipment : e)));
    setInspectingEquipment(null);
    setQrVerifiedIds(prev => {
      if (!prev.has(updatedEquipment.id.toUpperCase())) return prev;
      const next = new Set(prev);
      next.delete(updatedEquipment.id.toUpperCase());
      return next;
    });
    void refreshSummaryData();

    if (activeTab === 'layout') {
      setSelectedZoneId(updatedEquipment.zoneId);
    }
  };

  // Reset demo state
  const handleResetDemo = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmResetDemo = async () => {
    setIsResetting(true);
    try {
      await api.resetData();
      await loadData();
      setIsResetConfirmOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100/60 flex flex-col">
        <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-36 h-3.5 bg-slate-200 rounded animate-pulse" />
              <div className="w-48 h-2.5 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="w-28 h-8 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-white border border-slate-200/80 rounded-xl p-4 space-y-3 animate-pulse">
                <div className="w-20 h-3 bg-slate-200 rounded" />
                <div className="w-14 h-7 bg-slate-200 rounded" />
                <div className="w-28 h-2.5 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          <div className="h-72 bg-white border border-slate-200/80 rounded-xl flex flex-col items-center justify-center gap-3">
            <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-xs font-mono text-slate-500">กำลังเตรียมข้อมูลความปลอดภัยคลังสินค้า CDC...</div>
          </div>
        </div>
      </div>
    );
  }

  const defectiveCount = equipmentList.filter(e => e.status === 'DEFECTIVE' || e.status === 'IN_PROGRESS').length;

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 flex flex-col selection:bg-amber-300 selection:text-slate-950">
      
      {/* Top Bar Header with Role-Based Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        userRole={userRole}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenPrintSheet={() => setIsPrintSheetOpen(true)}
        defectiveCount={defectiveCount}
      />

      {/* Main Content Area with Smooth Animated Transitions */}
      <main className="flex-1 pb-16">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* 1. ADMIN DASHBOARD */}
            {activeTab === 'dashboard' && (
              <DashboardOverview
                metrics={metrics}
                recentInspections={recentInspections}
                activeDefects={correctiveActions}
                onOpenScanner={() => setIsScannerOpen(true)}
                onNavigateToZone={(zoneId) => {
                  setSelectedZoneId(zoneId);
                  setActiveTab('layout');
                }}
                onNavigateToDefects={() => setActiveTab('actions')}
                onOpenReports={() => setActiveTab('reports')}
              />
            )}

            {/* 2. INSPECTOR DASHBOARD */}
            {activeTab === 'inspect-dashboard' && currentUser && (
              <InspectorDashboard
                currentUser={currentUser}
                equipmentList={equipmentList}
                zones={zones}
                recentInspections={recentInspections}
                onOpenScanner={() => setIsScannerOpen(true)}
                onInspectEquipment={(equip) => {
                  if (isAdmin || qrVerifiedIds.has(equip.id.toUpperCase())) {
                    setInspectingEquipment(equip);
                  } else {
                    setIsScannerOpen(true);
                  }
                }}
                onSelectEquipment={(equip) => setSelectedEquipmentDetail(equip)}
                onNavigateToZone={(zoneId) => {
                  setSelectedZoneId(zoneId);
                  setActiveTab('layout');
                }}
              />
            )}

            {/* 3. PUBLIC VISITOR VERIFICATION VIEW */}
            {activeTab === 'public-verify' && (
              <PublicVisitorView
                equipmentList={equipmentList}
                zones={zones}
                onSelectEquipment={(equip) => setSelectedEquipmentDetail(equip)}
                onOpenScanner={() => setIsScannerOpen(true)}
                onOpenLogin={() => setIsLoginOpen(true)}
              />
            )}

            {/* 4. 2D SAFETY LAYOUT VIEWER */}
            {activeTab === 'layout' && (
              <LayoutViewer
                zones={zones}
                selectedZoneId={selectedZoneId}
                onSelectZone={setSelectedZoneId}
                equipment={equipmentList}
                onSelectEquipment={(equip) => setSelectedEquipmentDetail(equip)}
                onInspectEquipment={(equip) => {
                  if (isAdmin || (isInspector && qrVerifiedIds.has(equip.id.toUpperCase()))) {
                    setInspectingEquipment(equip);
                  } else {
                    setSelectedEquipmentDetail(equip);
                  }
                }}
                onEquipmentUpdated={(updated) => {
                  setEquipmentList(prev => prev.map(e => e.id === updated.id ? updated : e));
                  void refreshSummaryData();
                }}
                onEquipmentBatchUpdated={(updatedItems) => {
                  const updatedMap = new Map(updatedItems.map(e => [e.id, e]));
                  setEquipmentList(prev => prev.map(e => updatedMap.get(e.id) || e));
                  void refreshSummaryData();
                }}
                onEquipmentCreated={(newEquip) => {
                  setEquipmentList(prev => [...prev, newEquip]);
                  void refreshSummaryData();
                }}
                onEquipmentDeleted={(deletedId) => {
                  setEquipmentList(prev => prev.filter(e => e.id !== deletedId));
                  void refreshSummaryData();
                }}
                isOwner={isAdmin}
                userRole={userRole}
                onRequestOwnerLogin={() => setIsLoginOpen(true)}
              />
            )}

            {/* 5. CORRECTIVE ACTIONS (ADMIN & SAFETY) */}
            {activeTab === 'actions' && (
              <CorrectiveActionList
                actions={correctiveActions}
                currentUser={currentUser || DEFAULT_VISITOR}
                onRefresh={loadData}
                onNavigateToLayout={(zoneId) => {
                  setSelectedZoneId(zoneId);
                  setActiveTab('layout');
                }}
              />
            )}

            {/* 6. INSPECTION REPORTS & EXPORT (ADMIN) */}
            {activeTab === 'reports' && (
              <InspectionReportModal
                inspections={recentInspections}
                allEquipment={equipmentList}
                zones={zones}
                onSelectEquipment={(equip) => setSelectedEquipmentDetail(equip)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persistent Bottom Floating Strip for Demo Reset */}
      <div className="fixed bottom-3 right-4 z-30 flex items-center gap-2 no-print">
        <button
          onClick={handleResetDemo}
          title="รีเซ็ตข้อมูลทดสอบ (Reset Demo Data)"
          className="p-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200 shadow-md transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* MODALS */}

      {/* 1. Mobile Camera QR Scanner */}
      {isScannerOpen && (
        <QRScannerModal
          allEquipment={equipmentList}
          userRole={userRole}
          onClose={() => setIsScannerOpen(false)}
          onEquipmentFound={(equip, verifiedViaQr = false) => {
            setIsScannerOpen(false);
            if (verifiedViaQr) {
              setQrVerifiedIds(prev => {
                const next = new Set(prev);
                next.add(equip.id.toUpperCase());
                return next;
              });
            }
            setSelectedEquipmentDetail(equip);
          }}
        />
      )}

      {/* 2. Inspection Checklist Form Modal (ADMIN & QR-verified INSPECTOR) */}
      {inspectingEquipment && (isAdmin || (isInspector && qrVerifiedIds.has(inspectingEquipment.id.toUpperCase()))) && (
        <InspectionFormModal
          equipment={inspectingEquipment}
          currentUser={currentUser || DEFAULT_VISITOR}
          onClose={() => setInspectingEquipment(null)}
          onSuccess={handleInspectionSuccess}
          isOwner={isAdmin || isInspector}
          onRequestOwnerLogin={() => setIsLoginOpen(true)}
        />
      )}

      {/* 3. Equipment Verification & Monthly History Modal (For All 3 Roles) */}
      {selectedEquipmentDetail && (
        <EquipmentDetailModal
          equipment={selectedEquipmentDetail}
          zones={zones}
          userRole={userRole}
          isQrVerified={qrVerifiedIds.has(selectedEquipmentDetail.id.toUpperCase())}
          onOpenScanner={() => setIsScannerOpen(true)}
          onClose={() => setSelectedEquipmentDetail(null)}
          onInspect={(equip) => {
            setSelectedEquipmentDetail(null);
            if (isAdmin || (isInspector && qrVerifiedIds.has(equip.id.toUpperCase()))) {
              setInspectingEquipment(equip);
            } else if (isInspector) {
              setIsScannerOpen(true);
            } else {
              setIsLoginOpen(true);
            }
          }}
          onEquipmentUpdated={(updated) => {
            setEquipmentList(prev => prev.map(e => e.id === updated.id ? updated : e));
            setSelectedEquipmentDetail(updated);
            void refreshSummaryData();
          }}
          onEquipmentDeleted={(deletedId) => {
            setEquipmentList(prev => prev.filter(e => e.id !== deletedId));
            setSelectedEquipmentDetail(null);
            void refreshSummaryData();
          }}
          isOwner={isAdmin}
          onRequestOwnerLogin={() => setIsLoginOpen(true)}
        />
      )}

      {/* 4. Printable Sheet of QR Codes (ADMIN) */}
      {isPrintSheetOpen && (
        <QRPrintSheetModal
          equipmentList={equipmentList}
          zones={zones}
          onClose={() => setIsPrintSheetOpen(false)}
        />
      )}

      {/* 5. User Management Modal (ADMIN ONLY) */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        users={users}
        onRefreshUsers={loadData}
      />

      {/* 6. Login Modal (ADMIN: admin_cj/2026, INSPECTOR: Inspecter_cj/0000, VISITOR) */}
      <LoginPage
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(user, tab) => {
          handleLoginSuccess(user);
          if (tab) setActiveTab(tab);
        }}
        onContinueAsVisitor={handleContinueAsVisitor}
      />

      {/* 7. Local Confirmation Dialog for Resetting Data */}
      <AnimatePresence>
        {isResetConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    รีเซ็ตข้อมูลคลังสินค้า CDC กลับสู่สถานะเริ่มต้น?
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ต้องการรีเซ็ตข้อมูลการตรวจและข้อบกพร่องกลับสู่สถานะเริ่มต้นของคลังสินค้า CDC หรือไม่? การดำเนินการนี้จะอัปเดตข้อมูลในฐานข้อมูลหลังบ้านทันที
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleConfirmResetDemo}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? 'กำลังรีเซ็ต...' : 'ยืนยันรีเซ็ตข้อมูล'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
