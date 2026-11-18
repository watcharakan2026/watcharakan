import React from 'react';
import { 
  QrCode, 
  Flame, 
  Printer, 
  LogIn, 
  LogOut, 
  Users, 
  ShieldCheck, 
  ClipboardCheck, 
  LayoutDashboard, 
  Map, 
  AlertTriangle, 
  FileSpreadsheet, 
  Search,
  User as UserIcon
} from 'lucide-react';
import { User, UserRole } from '../types';

export type TabType = 'dashboard' | 'inspect-dashboard' | 'public-verify' | 'layout' | 'actions' | 'reports';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  currentUser: User | null;
  userRole: UserRole;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenUserManagement: () => void;
  onOpenScanner: () => void;
  onOpenPrintSheet: () => void;
  defectiveCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  userRole,
  onOpenLogin,
  onLogout,
  onOpenUserManagement,
  onOpenScanner,
  onOpenPrintSheet,
  defectiveCount,
}) => {
  const isAdmin = userRole === 'ADMIN';
  const isInspector = userRole === 'INSPECTOR';
  const isVisitor = userRole === 'VISITOR' || (!isAdmin && !isInspector);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 text-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Zone 1: Wordmark */}
        <div 
          onClick={() => {
            if (isAdmin) setActiveTab('dashboard');
            else if (isInspector) setActiveTab('inspect-dashboard');
            else setActiveTab('public-verify');
          }}
          className="flex items-center gap-2 sm:gap-3 shrink-0 cursor-pointer min-w-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-white shadow-xs shrink-0">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
                Inspection Fire Extinguisher CDC
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono shrink-0">
                2026
              </span>
            </div>
            <span className="text-[11px] text-slate-500 tracking-wide hidden sm:inline">
              ระบบตรวจสอบความปลอดภัยถังดับเพลิง
            </span>
          </div>
        </div>

        {/* Zone 2: Role-based Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
          
          {/* ADMIN TABS */}
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>แดชบอร์ดผู้ดูแล</span>
              </button>
              <button
                onClick={() => setActiveTab('layout')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'layout'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>ผัง 2D & ปรับตำแหน่ง</span>
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'actions'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>รายการชำรุด/ซ่อม</span>
                {defectiveCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold">
                    {defectiveCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                <span>รายงาน & Export</span>
              </button>
            </>
          )}

          {/* INSPECTOR TABS */}
          {isInspector && (
            <>
              <button
                onClick={() => setActiveTab('inspect-dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'inspect-dashboard'
                    ? 'bg-blue-100 text-blue-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>ภารกิจตรวจสอบประจำเดือน</span>
              </button>
              <button
                onClick={() => setActiveTab('layout')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'layout'
                    ? 'bg-blue-100 text-blue-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>ผังความปลอดภัย 2D</span>
              </button>
              <button
                onClick={() => setActiveTab('public-verify')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'public-verify'
                    ? 'bg-blue-100 text-blue-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>สแกน & ค้นหาถัง</span>
              </button>
            </>
          )}

          {/* VISITOR TABS */}
          {isVisitor && (
            <>
              <button
                onClick={() => setActiveTab('public-verify')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'public-verify'
                    ? 'bg-emerald-100 text-emerald-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>ตรวจสอบความปลอดภัยสาธารณะ (QR Verify)</span>
              </button>
              <button
                onClick={() => setActiveTab('layout')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'layout'
                    ? 'bg-emerald-100 text-emerald-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>ผังจุดติดตั้งถังดับเพลิง 2D</span>
              </button>
            </>
          )}

        </nav>

        {/* Zone 3: Actions + User Profile/Role */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Quick Print QR Labels (Admin Only) */}
          {isAdmin && (
            <button
              onClick={onOpenPrintSheet}
              title="พิมพ์สติกเกอร์ QR Code"
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>พิมพ์สติกเกอร์ QR</span>
            </button>
          )}

          {/* Manage Users (Admin Only) */}
          {isAdmin && (
            <button
              onClick={onOpenUserManagement}
              title="จัดการบัญชีผู้ใช้และกำหนดสิทธิ์"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-amber-700" />
              <span>จัดการสิทธิ์</span>
            </button>
          )}

          {/* Primary Action: QR Scanner */}
          <button
            onClick={onOpenScanner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">สแกน QR Code</span>
            <span className="sm:hidden">สแกน</span>
          </button>

          {/* Current User Badge & Auth Action */}
          {currentUser && !isVisitor ? (
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div className="flex flex-col text-left">
                  <span className="font-bold text-slate-800 leading-tight">
                    {currentUser.username || currentUser.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    {isAdmin ? '👑 ADMIN' : '🔍 INSPECTOR'}
                  </span>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={onLogout}
                title="ออกจากระบบ"
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              {/* Visitor indicator */}
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs border border-slate-200">
                <UserIcon className="w-3 h-3 text-slate-400" />
                <span>Visitor (อ่านอย่างเดียว)</span>
              </div>

              {/* Login Button */}
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>เข้าสู่ระบบ</span>
              </button>
            </div>
          )}

        </div>

      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden border-t border-slate-200 bg-white px-2 py-1.5 flex items-center justify-start sm:justify-around gap-1.5 text-xs font-semibold overflow-x-auto no-scrollbar">
        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-2 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'dashboard' ? 'text-amber-800 bg-amber-100' : 'text-slate-600'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`px-2 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'layout' ? 'text-amber-800 bg-amber-100' : 'text-slate-600'}`}
            >
              ผัง 2D
            </button>
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-2 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'actions' ? 'text-amber-800 bg-amber-100' : 'text-slate-600'}`}
            >
              ชำรุด ({defectiveCount})
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-2 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'reports' ? 'text-amber-800 bg-amber-100' : 'text-slate-600'}`}
            >
              รายงาน
            </button>
            <button
              onClick={onOpenUserManagement}
              className="px-2 py-1 rounded-md text-amber-700 shrink-0"
            >
              สิทธิ์
            </button>
          </>
        )}

        {isInspector && (
          <>
            <button
              onClick={() => setActiveTab('inspect-dashboard')}
              className={`px-2.5 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'inspect-dashboard' ? 'text-blue-800 bg-blue-100' : 'text-slate-600'}`}
            >
              ภารกิจตรวจ
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`px-2.5 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'layout' ? 'text-blue-800 bg-blue-100' : 'text-slate-600'}`}
            >
              ผัง 2D
            </button>
            <button
              onClick={() => setActiveTab('public-verify')}
              className={`px-2.5 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'public-verify' ? 'text-blue-800 bg-blue-100' : 'text-slate-600'}`}
            >
              ค้นหา/สแกน
            </button>
          </>
        )}

        {isVisitor && (
          <>
            <button
              onClick={() => setActiveTab('public-verify')}
              className={`px-2.5 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'public-verify' ? 'text-emerald-800 bg-emerald-100' : 'text-slate-600'}`}
            >
              ตรวจสอบสาธารณะ
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`px-2.5 py-1 rounded-md transition-colors shrink-0 ${activeTab === 'layout' ? 'text-emerald-800 bg-emerald-100' : 'text-slate-600'}`}
            >
              ผัง 2D
            </button>
            <button
              onClick={onOpenLogin}
              className="px-2.5 py-1 rounded-md text-amber-700 font-bold shrink-0"
            >
              เข้าสู่ระบบ
            </button>
          </>
        )}
      </div>
    </header>
  );
};
