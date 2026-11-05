import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Project, TeamMember, JoinedSession } from '../lib/types';
import {
  getAvatarColor,
  generate2DigitCode,
  triggerCelebration,
  getSavedDevSessions,
  saveDevSession,
  removeSavedDevSession,
  type SavedDevSession,
} from '../lib/utils';
import {
  Code2,
  User,
  Briefcase,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  UserCheck,
  X,
} from 'lucide-react';

interface DevJoinModalProps {
  onJoinSuccess: (session: JoinedSession) => void;
  availableProjects?: Project[];
}

const COMMON_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Fullstack Engineer',
  'UI/UX Designer',
  'Mobile Developer',
  'QA / Test Engineer',
  'DevOps / Cloud Engineer',
  'Data Engineer',
];

export const DevJoinModal: React.FC<DevJoinModalProps> = ({
  onJoinSuccess,
  availableProjects = [],
}) => {
  const [mode, setMode] = useState<'returning' | 'new'>('returning');

  // Returning Developer state
  const [returningProjectCode, setReturningProjectCode] = useState('');
  const [returningDevCode, setReturningDevCode] = useState('');

  // New Developer state
  const [newProjectCode, setNewProjectCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(COMMON_ROLES[0]);
  const [customRole, setCustomRole] = useState('');

  // Assigned 2-digit code reveal modal state
  const [assignedCodeSession, setAssignedCodeSession] = useState<JoinedSession | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Multi-project saved developer sessions
  const [savedSessions, setSavedSessions] = useState<SavedDevSession[]>(() => getSavedDevSessions());

  const handleSelectSavedSession = (s: SavedDevSession) => {
    const session: JoinedSession = {
      projectId: s.projectId,
      projectCode: s.projectCode,
      projectTitle: s.projectTitle,
      memberId: s.memberId,
      memberName: s.memberName,
      memberRole: s.memberRole || 'Developer',
      devCode: s.devCode,
    };
    localStorage.setItem('marlinetodo_dev_session', JSON.stringify(session));
    saveDevSession(session);
    triggerCelebration();
    onJoinSuccess(session);
  };

  const handleRemoveSavedSession = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    removeSavedDevSession(projectId);
    setSavedSessions(getSavedDevSessions());
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Handle Returning Developer Login with 4-digit project code + 2-digit dev code
  const handleReturningLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningProjectCode || returningProjectCode.length !== 4) {
      setError('Please enter your 4-digit Project PIN.');
      return;
    }
    if (!returningDevCode || returningDevCode.length !== 2) {
      setError('Please enter your 2-digit Personal Access Code.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Find project
      const { data: projects, error: pErr } = await supabase
        .from('projects')
        .select('*')
        .eq('code', returningProjectCode.trim())
        .limit(1);

      if (pErr) throw pErr;
      if (!projects || projects.length === 0) {
        throw new Error(`Project with 4-digit code "${returningProjectCode}" not found.`);
      }
      const project: Project = projects[0];

      // Find member in this project with this 2-digit code
      const { data: members, error: mErr } = await supabase
        .from('team_members')
        .select('*')
        .eq('project_id', project.id)
        .eq('dev_code', returningDevCode.trim())
        .limit(1);

      if (mErr) throw mErr;
      if (!members || members.length === 0) {
        throw new Error(`No team member found with 2-digit code "${returningDevCode}" in project #${project.code}.`);
      }

      const member: TeamMember = members[0];
      const session: JoinedSession = {
        projectId: project.id,
        projectCode: project.code,
        projectTitle: project.title,
        memberId: member.id,
        memberName: member.name,
        memberRole: member.role,
        devCode: member.dev_code || returningDevCode.trim(),
      };

      localStorage.setItem('marlinetodo_dev_session', JSON.stringify(session));
      saveDevSession(session);
      triggerCelebration();
      onJoinSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Handle New Developer Registration & 2-Digit Code Generation
  const handleNewJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectCode || newProjectCode.length !== 4) {
      setError('Please enter a valid 4-digit project code.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const selectedRole = role === 'Other' ? customRole.trim() : role;
    if (!selectedRole) {
      setError('Please specify your role.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Find project
      const { data: projects, error: projectErr } = await supabase
        .from('projects')
        .select('*')
        .eq('code', newProjectCode.trim())
        .limit(1);

      if (projectErr) throw projectErr;
      if (!projects || projects.length === 0) {
        throw new Error(`No project found with code "${newProjectCode}".`);
      }
      const project: Project = projects[0];

      // 2. Fetch existing team members and perform atomic reservation retry loop
      let member: TeamMember | null = null;
      let lastInsertError: unknown = null;
      const MAX_RETRIES = 5;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        // Fetch fresh team members in this project to prevent race collisions
        const { data: existingMembers, error: membersErr } = await supabase
          .from('team_members')
          .select('id, name, role, dev_code')
          .eq('project_id', project.id);

        if (membersErr) throw membersErr;

        // Check if dev with same name already joined
        const alreadyJoined = existingMembers?.find(
          (m) => m.name.toLowerCase() === name.trim().toLowerCase()
        );

        if (alreadyJoined && alreadyJoined.dev_code) {
          member = alreadyJoined as TeamMember;
          break;
        }

        const existingCodes = (existingMembers || []).map((m) => m.dev_code).filter(Boolean);
        const assignedDevCode = generate2DigitCode(existingCodes);

        const { data: newMembers, error: createErr } = await supabase
          .from('team_members')
          .insert({
            project_id: project.id,
            name: name.trim(),
            role: selectedRole,
            dev_code: assignedDevCode,
            avatar_color: getAvatarColor(name.trim()),
          })
          .select();

        if (!createErr && newMembers && newMembers.length > 0) {
          member = newMembers[0];
          break;
        }

        lastInsertError = createErr;
        // Collision or transient issue: brief exponential jitter delay before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, 50 * Math.pow(2, attempt) + Math.random() * 50)
        );
      }

      if (!member) {
        throw new Error(
          (lastInsertError instanceof Error ? lastInsertError.message : null) ||
            'Could not allocate a unique PIN for this project after multiple attempts. Please try again.'
        );
      }

      const session: JoinedSession = {
        projectId: project.id,
        projectCode: project.code,
        projectTitle: project.title,
        memberId: member.id,
        memberName: member.name,
        memberRole: member.role,
        devCode: member.dev_code,
      };

      localStorage.setItem('marlinetodo_dev_session', JSON.stringify(session));
      saveDevSession(session);
      triggerCelebration();

      // Show assigned code confirmation dialog
      setAssignedCodeSession(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not join project';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyAssignedCode = () => {
    if (assignedCodeSession) {
      navigator.clipboard.writeText(assignedCodeSession.devCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleProceedToWorkspace = () => {
    if (assignedCodeSession) {
      onJoinSuccess(assignedCodeSession);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
      {/* Assigned Code Announcement Modal / View */}
      {assignedCodeSession ? (
        <div className="p-8 text-center space-y-5 animate-in fade-in duration-200">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Welcome, {assignedCodeSession.memberName}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Joined <strong className="text-slate-800">{assignedCodeSession.projectTitle}</strong>
            </p>
          </div>

          {/* 2-Digit Code Highlight Card */}
          <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-200 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block mb-1">
              Your 2-Digit PIN
            </span>
            <div className="flex items-center justify-center space-x-3 my-2">
              <span className="font-mono font-black text-3xl tracking-widest text-indigo-900 bg-white px-5 py-2 rounded-xl border border-indigo-300 shadow-2xs">
                {assignedCodeSession.devCode}
              </span>
              <button
                type="button"
                onClick={handleCopyAssignedCode}
                className="p-2.5 bg-white rounded-xl border border-indigo-200 hover:bg-indigo-50 text-indigo-700 transition"
                title="Copy PIN"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-indigo-950 font-medium">
              Save this PIN to log back in next time.
            </p>
          </div>

          <button
            onClick={handleProceedToWorkspace}
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition"
          >
            <span>Continue to Project</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Header Banner */}
          <div className="p-6 text-center bg-slate-50/50 border-b border-slate-100">
            <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2 shadow-2xs">
              <Code2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Developer Sign In
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your project code and personal PIN to access tasks
            </p>

            {/* Quick Switch: Recent Developer Workspaces */}
            {savedSessions.length > 0 && (
              <div className="mt-4 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Your Saved Workspaces ({savedSessions.length})</span>
                  </span>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {savedSessions.map((s) => (
                    <div
                      key={s.projectId}
                      onClick={() => handleSelectSavedSession(s)}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-2xs cursor-pointer transition text-xs group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                          <span>{s.projectTitle}</span>
                          <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            #{s.projectCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {s.memberName} • PIN <strong className="text-indigo-700">#{s.devCode}</strong>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="text-[11px] font-bold text-indigo-600 group-hover:underline">
                          Enter →
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveSavedSession(e, s.projectId)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Remove from saved list"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode Switcher Pills */}
            <div className="mt-4 flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setMode('returning');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1.5 ${
                  mode === 'returning'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sign In (PIN)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('new');
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1.5 ${
                  mode === 'new'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Join Project</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* MODE 1: Returning Developer */}
            {mode === 'returning' ? (
              <form onSubmit={handleReturningLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    4-Digit Project Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. 4829"
                    value={returningProjectCode}
                    onChange={(e) => setReturningProjectCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center font-mono font-extrabold text-xl tracking-[0.3em] py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-indigo-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      Your 2-Digit Personal Code *
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">Assigned on day 1</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="e.g. 10"
                    value={returningDevCode}
                    onChange={(e) => setReturningDevCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="w-full text-center font-mono font-extrabold text-2xl tracking-[0.4em] py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* MODE 2: New Developer Join */
              <form onSubmit={handleNewJoin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    4-Digit Project Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. 4829"
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center font-mono font-extrabold text-xl tracking-[0.3em] py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-indigo-700"
                  />
                </div>

                {/* Quick Select Project */}
                {availableProjects.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Or pick active project:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableProjects.slice(0, 3).map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setNewProjectCode(p.code)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium ${
                            newProjectCode === p.code
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="font-bold mr-1 font-mono text-[11px]">#{p.code}</span>
                          <span className="truncate max-w-[100px] inline-block align-bottom">{p.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya Lin"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    Your Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs font-medium text-slate-900 bg-white"
                  >
                    {COMMON_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="Other">Other Role...</option>
                  </select>

                  {role === 'Other' && (
                    <input
                      type="text"
                      placeholder="Specify role..."
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      className="mt-2 w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs text-slate-900"
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-md transition disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Project</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
};
