import React, { useState } from 'react';
import { 
  Flame, 
  Lock, 
  KeyRound, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  QrCode,
  X
} from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../services/api';

interface LoginPageProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: UserType, initialTab: 'dashboard' | 'inspect-dashboard' | 'public-verify') => void;
  onContinueAsVisitor?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  isOpen = true,
  onClose,
  onLoginSuccess,
  onContinueAsVisitor,
}) => {
  const [userId, setUserId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanId = userId.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      setErrorMessage('กรุณากรอก User ID');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('กรุณากรอก Password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.login(cleanId, cleanPass);
      if (res.success && res.user) {
        if (res.user.role === 'ADMIN') {
          onLoginSuccess(res.user, 'dashboard');
        } else if (res.user.role === 'INSPECTOR') {
          onLoginSuccess(res.user, 'inspect-dashboard');
        } else {
          onLoginSuccess(res.user, 'public-verify');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'User ID หรือ Password ไม่ถูกต้อง';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterAsVisitor = () => {
    if (onContinueAsVisitor) {
      onContinueAsVisitor();
      return;
    }
    const visitorUser: UserType = {
      id: 'u-visitor',
      username: 'visitor',
      name: 'ผู้เข้าชมทั่วไป (Visitor)',
      role: 'VISITOR',
      roleNameTh: 'ผู้เข้าชม (VISITOR)',
      employeeId: 'VIS-000',
    };
    onLoginSuccess(visitorUser, 'public-verify');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header with Brand */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 p-6 text-slate-950 relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-900/60 hover:text-slate-950 hover:bg-black/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-md shrink-0">
              <Flame className="w-6 h-6 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold tracking-wider uppercase text-slate-900/80">
                CDC Warehouse Fire Safety 2026
              </div>
              <h2 className="text-xl font-black tracking-tight text-slate-950">
                ระบบเข้าสู่ระบบและกำหนดสิทธิ์
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-900/80 mt-2 font-medium">
            กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ (Admin) หรือผู้ตรวจสอบ (Inspector)
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6 space-y-5">

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* User ID Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>User ID (ชื่อผู้ใช้งาน) *</span>
              </label>
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="กรอก User ID ของคุณ"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono transition-all"
                autoFocus
              />
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                <span>Password (รหัสผ่าน) *</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านของคุณ"
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-950" />
                  <span>เข้าสู่ระบบ (Login)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Visitor Mode Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleEnterAsVisitor}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-500" />
              <span>เข้าใช้งานในฐานะผู้เข้าชม (Visitor - ไม่ต้องเข้าสู่ระบบ)</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center mt-1.5">
              ผู้เข้าชมสามารถสแกน QR Code และตรวจสอบประวัติย้อนหลังได้ในรูปแบบอ่านอย่างเดียว (Read-only)
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
