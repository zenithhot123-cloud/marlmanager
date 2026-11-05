import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AdminSession } from '../lib/types';
import { triggerCelebration } from '../lib/utils';
import {
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface AdminLoginViewProps {
  onLoginSuccess: (session: AdminSession) => void;
  onSwitchToDev: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onLoginSuccess,
  onSwitchToDev,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFillDemo = () => {
    setEmail('admin@marline.com');
    setPassword('admin123');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both admin email and password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Query admin_users table in Supabase
      const { data: adminUsers, error: queryErr } = await supabase
        .from('admin_users')
        .select('*')
        .ilike('email', email.trim())
        .limit(1);

      let isValid = false;
      let adminName = 'Project Manager';
      let adminRole = 'Lead PM';

      if (!queryErr && adminUsers && adminUsers.length > 0) {
        const admin = adminUsers[0];
        if (admin.password_hash === password.trim()) {
          isValid = true;
          adminName = admin.name || 'Project Manager';
          adminRole = admin.role || 'Lead PM';
        }
      } else {
        // Fallback default demo check
        if (
          (email.trim().toLowerCase() === 'admin@marline.com' || email.trim().toLowerCase() === 'admin') &&
          (password.trim() === 'admin123' || password.trim() === 'admin')
        ) {
          isValid = true;
          adminName = 'Project Manager';
          adminRole = 'Lead PM';
        }
      }

      if (!isValid) {
        throw new Error('Invalid Project Manager credentials. Please check your email and password.');
      }

      const session: AdminSession = {
        email: email.trim().toLowerCase(),
        name: adminName,
        role: adminRole,
        loggedInAt: new Date().toISOString(),
      };

      localStorage.setItem('marlinetodo_admin_session', JSON.stringify(session));
      triggerCelebration();
      onLoginSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <div className="p-6 text-center border-b border-slate-100">
        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-900 text-white flex items-center justify-center mb-2.5">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Manager Sign In
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Access your projects, team assignments, and schedules.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Demo Credentials Quick Pill */}
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">Demo: </span>
            <span>admin@marline.com / admin123</span>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 font-semibold text-[11px] transition shadow-2xs"
          >
            Fill
          </button>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Email or Username
          </label>
          <input
            type="text"
            required
            placeholder="admin@marline.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900"
          />
        </div>

        {/* Sign In Button */}
        <div className="pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </div>

        {/* Switch to Developer Portal Link */}
        <div className="pt-2 text-center">
          <p className="text-xs text-slate-500">
            Developer?{' '}
            <button
              type="button"
              onClick={onSwitchToDev}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Go to Developer Join
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

