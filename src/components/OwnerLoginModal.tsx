import React, { useState } from 'react';
import { ShieldCheck, Lock, KeyRound, AlertCircle, CheckCircle2, X, Sparkles, UserCheck } from 'lucide-react';
import { User } from '../types';

interface OwnerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  users: User[];
  currentSelectedUser?: User | null;
}

export const OwnerLoginModal: React.FC<OwnerLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  users,
  currentSelectedUser,
}) => {
  const staffUsers = users.filter(u => u.role !== 'VISITOR');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    currentSelectedUser?.id || (staffUsers[0]?.id ?? '')
  );
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const targetUser = staffUsers.find(u => u.id === selectedUserId) || staffUsers[0];
    if (!targetUser) {
      setError('ไม่พบบัญชีผู้ใช้งานที่เลือก');
      return;
    }

    // Accept PIN 2026, owner, admin, or empty in quick demo
    const cleanPin = pin.trim().toLowerCase();
    if (cleanPin === '' || cleanPin === '2026' || cleanPin === 'owner' || cleanPin === 'admin' || cleanPin === 'cdc') {
      onLoginSuccess(targetUser);
      onClose();
    } else {
      setError('รหัส PIN ไม่ถูกต้อง (รหัสผ่านเริ่มต้นสำหรับ Owner คือ 2026)');
    }
  };

  const handleQuickUnlock = () => {
    const targetUser = staffUsers.find(u => u.id === selectedUserId) || staffUsers[0];
    if (targetUser) {
      onLoginSuccess(targetUser);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm">
              <Lock className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                เข้าสู่ระบบสำหรับ Owner / เจ้าหน้าที่
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Owner Authentication (ปลดล็อคสิทธิ์แก้ไข)
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

        {/* Modal Content */}
        <div className="p-6 space-y-5">

          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">สิทธิ์เฉพาะ Owner / เจ้าหน้าที่ความปลอดภัย:</div>
              <ul className="list-disc list-inside mt-1 text-[11px] text-amber-800 space-y-0.5">
                <li>แก้ไขข้อมูลถังดับเพลิง / สารดับเพลิง (เช่น Fire Ade 2000)</li>
                <li>ปรับตำแหน่งและลากย้ายจุดติดตั้งบนแผนผัง</li>
                <li>บันทึกผลการตรวจสอบความปลอดภัยประจำเดือน</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Account Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                เลือกบัญชีเจ้าหน้าที่ / Owner *
              </label>
              <div className="space-y-2">
                {staffUsers.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-500 text-slate-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold">{u.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {u.roleNameTh} ({u.employeeId})
                          </div>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PIN / Password input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>รหัสผ่าน / PIN เจ้าหน้าที่</span>
                </label>
                <span className="text-[11px] text-amber-700 font-mono">
                  (รหัสเริ่มต้น: 2026)
                </span>
              </div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="ป้อนรหัส PIN 2026 หรือคลิกปลดล็อคด่วน"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบ Owner (Unlock Owner Mode)</span>
              </button>

              <button
                type="button"
                onClick={handleQuickUnlock}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>ปลดล็อคโหมด Owner ด่วน (Quick Unlock Demo)</span>
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
          >
            ← ใช้งานต่อในฐานะผู้เยี่ยมชม (Visitor Mode)
          </button>
        </div>

      </div>
    </div>
  );
};
