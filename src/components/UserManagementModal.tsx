import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Shield, 
  X, 
  CheckCircle2, 
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onRefreshUsers: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  onRefreshUsers,
}) => {
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('INSPECTOR');
  const [newEmployeeId, setNewEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const roleNameTh = 
        newRole === 'ADMIN' ? 'ผู้ดูแลระบบ (ADMIN)' :
        newRole === 'INSPECTOR' ? 'ผู้ตรวจสอบ (INSPECTOR)' : 'ผู้เข้าชม (VISITOR)';

      await api.createUser({
        username: newUsername.trim(),
        name: newName.trim(),
        role: newRole,
        roleNameTh,
        employeeId: newEmployeeId.trim() || `EMP-${Date.now().toString().slice(-4)}`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${newUsername}`,
      });

      setMessage({ type: 'success', text: `สร้างผู้ใช้งาน ${newUsername} สำเร็จ` });
      setIsAdding(false);
      setNewUsername('');
      setNewName('');
      setNewEmployeeId('');
      onRefreshUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.username === 'admin_cj') {
      alert('ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (admin_cj) ได้');
      return;
    }
    if (!window.confirm(`ต้องการลบบัญชี ${user.name} (${user.username}) หรือไม่?`)) return;

    try {
      await api.deleteUser(user.id);
      onRefreshUsers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                จัดการบัญชีผู้ใช้งานและกำหนดสิทธิ์ (User & Access Control)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถจัดการผู้ใช้งานและกำหนดสิทธิ์ได้
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message */}
        {message && (
          <div className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          {/* Permissions Matrix Reference */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>ระดับสิทธิ์การเข้าถึง 3 ระดับ (Role Permissions Matrix):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
              <div className="p-2.5 bg-white rounded-lg border border-amber-200">
                <strong className="text-amber-800 block">👑 ผู้ดูแลระบบ (ADMIN)</strong>
                <span className="text-slate-500">สิทธิ์เต็มระบบ: เพิ่ม/แก้ไข/ลบถัง, ปรับผัง, ออกรายงาน, จัดการสิทธิ์</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-sky-200">
                <strong className="text-sky-800 block">🔍 ผู้ตรวจสอบ (INSPECTOR)</strong>
                <span className="text-slate-500">สแกน QR, ตรวจเช็คประจำเดือน, บันทึกรูป/หมายเหตุ (แก้ไข/ลบไม่ได้)</span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <strong className="text-slate-800 block">👁️ ผู้เข้าชม (VISITOR)</strong>
                <span className="text-slate-500">อ่านอย่างเดียว (Read-only): สแกน QR และดูประวัติย้อนหลังทุกเดือน</span>
              </div>
            </div>
          </div>

          {/* Add User Toggle */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              รายชื่อผู้ใช้งานในระบบ ({users.length} บัญชี)
            </h4>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'ปิดฟอร์ม' : 'เพิ่มผู้ใช้งานใหม่'}</span>
            </button>
          </div>

          {/* Add User Form */}
          {isAdding && (
            <form onSubmit={handleCreateUser} className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 text-xs space-y-3">
              <div className="font-bold text-amber-950">ลงทะเบียนผู้ใช้งานใหม่:</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">User ID (ชื่อผู้ใช้) *</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="เช่น inspector_02"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ชื่อ-นามสกุล *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="เช่น สมศักดิ์ ใจดี"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">บทบาทและสิทธิ์ (Role) *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="ADMIN">👑 ผู้ดูแลระบบ (ADMIN)</option>
                    <option value="INSPECTOR">🔍 ผู้ตรวจสอบ (INSPECTOR)</option>
                    <option value="VISITOR">👁️ ผู้เข้าชม (VISITOR)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">รหัสพนักงาน (Employee ID)</label>
                  <input
                    type="text"
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value)}
                    placeholder="เช่น INS-003"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                >
                  {loading ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้'}
                </button>
              </div>
            </form>
          )}

          {/* User List */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {users.map((u) => {
              const isAdmin = u.role === 'ADMIN';
              const isInspector = u.role === 'INSPECTOR';

              return (
                <div key={u.id} className="p-3.5 bg-white flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isAdmin ? 'bg-amber-100 text-amber-800' : isInspector ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{u.name}</span>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                          isAdmin ? 'bg-amber-100 text-amber-800' : isInspector ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        User ID: <strong>{u.username || u.id}</strong> · รหัส: {u.employeeId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {u.username !== 'admin_cj' && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="ลบผู้ใช้นี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
