import React, { useState } from 'react';
import type { UserRole, JoinedSession, AdminSession } from '../lib/types';
import { getSavedDevSessions } from '../lib/utils';
import {
  Briefcase,
  Code2,
  CheckCircle2,
  ChevronRight,
  LogOut,
  ShieldCheck,
  ArrowLeftRight,
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  adminSession: AdminSession | null;
  onAdminSignOut?: () => void;
  devSession: JoinedSession | null;
  onDevLeaveProject?: () => void;
  onDevSwitchProject?: (session: JoinedSession) => void;
  activeProjectTitle?: string | null;
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  adminSession,
  onAdminSignOut,
  devSession,
  onDevLeaveProject,
  onDevSwitchProject,
  activeProjectTitle,
  onNavigateHome,
}) => {
  const [isDevSwitcherOpen, setIsDevSwitcherOpen] = useState(false);
  const savedDevSessions = getSavedDevSessions();
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={onNavigateHome}>
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              Marline<span className="text-indigo-600 font-extrabold">Todo</span>
            </span>
          </div>

          {/* Breadcrumb if inside project */}
          {activeProjectTitle && (
            <div className="hidden md:flex items-center text-xs text-slate-500 font-medium">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-1" />
              <span className="text-slate-800 font-semibold truncate max-w-[200px]">
                {activeProjectTitle}
              </span>
            </div>
          )}

          {/* Right Section: Role Switcher, Session Badges & Logouts */}
          <div className="flex items-center space-x-2.5">
            {/* Admin Session Badge */}
            {currentRole === 'admin' && adminSession && (
              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold">{adminSession.name}</span>
                {onAdminSignOut && (
                  <button
                    onClick={onAdminSignOut}
                    title="Sign Out"
                    className="ml-1 text-slate-400 hover:text-rose-600 transition"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Dev Project info badge & Workspace Switcher */}
            {currentRole === 'dev' && devSession && (
              <div className="relative">
                <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                  <span className="font-semibold">{devSession.memberName}</span>
                  <span className="text-slate-400 font-mono text-[11px]">#{devSession.projectCode}</span>
                  
                  {savedDevSessions.length > 1 && onDevSwitchProject && (
                    <button
                      type="button"
                      onClick={() => setIsDevSwitcherOpen(!isDevSwitcherOpen)}
                      title="Switch Workspace"
                      className="ml-1 text-indigo-600 hover:text-indigo-800 transition"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                    </button>
                  )}

                  {onDevLeaveProject && (
                    <button
                      onClick={onDevLeaveProject}
                      title="Exit Project"
                      className="ml-1 text-slate-400 hover:text-slate-800 transition"
                    >
                      <LogOut className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Navbar Dev Workspace Dropdown */}
                {isDevSwitcherOpen && savedDevSessions.length > 1 && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-lg p-2 z-40 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                      Switch Project
                    </span>
                    {savedDevSessions.map((s) => (
                      <button
                        key={s.projectId}
                        type="button"
                        onClick={() => {
                          setIsDevSwitcherOpen(false);
                          if (onDevSwitchProject) {
                            onDevSwitchProject({
                              projectId: s.projectId,
                              projectCode: s.projectCode,
                              projectTitle: s.projectTitle,
                              memberId: s.memberId,
                              memberName: s.memberName,
                              memberRole: s.memberRole || 'Developer',
                              devCode: s.devCode,
                            });
                          }
                        }}
                        className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition ${
                          s.projectId === devSession.projectId
                            ? 'bg-indigo-50 text-indigo-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold truncate">{s.projectTitle}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">#{s.projectCode} • PIN #{s.devCode}</div>
                        </div>
                        {s.projectId === devSession.projectId && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-white px-1.5 py-0.5 rounded shadow-2xs">
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Role Switcher */}
            <div className="bg-slate-100 p-0.5 rounded-lg flex items-center border border-slate-200 text-xs">
              <button
                onClick={() => onRoleChange('admin')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md font-semibold transition ${
                  currentRole === 'admin'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-3 h-3 text-indigo-600" />
                <span>Admin</span>
              </button>

              <button
                onClick={() => onRoleChange('dev')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md font-semibold transition ${
                  currentRole === 'dev'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3 h-3 text-emerald-600" />
                <span>Developer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
