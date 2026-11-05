import React, { useState } from 'react';
import type { Project, Task, TeamMember, DailyLog, JoinedSession, TaskStatus, TaskExtension } from '../lib/types';
import {
  calculateFinishTime,
  calculateProjectScheduleDrift,
  formatDate,
  triggerCelebration,
  getLocalDateString,
  getSavedDevSessions,
} from '../lib/utils';
import { TaskCard } from '../components/TaskCard';
import { DailyLogModal } from '../components/DailyLogModal';
import {
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Plus,
  LogOut,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Copy,
  Check,
  History,
  ArrowLeftRight,
  ChevronDown,
} from 'lucide-react';

interface DevDashboardProps {
  session: JoinedSession;
  project: Project;
  tasks: Task[];
  teamMembers: TeamMember[];
  dailyLogs: DailyLog[];
  extensions: TaskExtension[];
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onOpenExtendModal: (task: Task) => void;
  onSubmitDailyLog: (logData: {
    log_date: string;
    content: string;
    blockers: string | null;
    hours_spent: number;
    tasks_completed_summary: string | null;
  }) => Promise<void>;
  onLeaveProject: () => void;
  onSwitchProject?: (session: JoinedSession) => void;
}

export const DevDashboard: React.FC<DevDashboardProps> = ({
  session,
  project,
  tasks,
  teamMembers,
  dailyLogs,
  extensions,
  onUpdateTaskStatus,
  onOpenExtendModal,
  onSubmitDailyLog,
  onLeaveProject,
  onSwitchProject,
}) => {
  const [activeTab, setActiveTab] = useState<'my_tasks' | 'all_tasks' | 'my_logs' | 'my_extensions'>('my_tasks');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [copiedDevPin, setCopiedDevPin] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const savedSessions = getSavedDevSessions();
  const hasOtherSessions = savedSessions.length > 1;

  // Filter tasks assigned to this developer
  const myTasks = tasks.filter((t) => t.assignee_id === session.memberId);
  const myCompletedTasks = myTasks.filter((t) => t.status === 'completed');
  const myInProgressTasks = myTasks.filter((t) => t.status === 'in_progress');

  // Filter logs & extensions by this dev
  const myLogs = dailyLogs.filter((l) => l.member_id === session.memberId);
  const myExtensions = extensions.filter((e) => e.member_id === session.memberId);
  const todayStr = getLocalDateString();
  const todayLog = myLogs.find((l) => l.log_date === todayStr);

  const totalHoursLogged = myLogs.reduce((acc, l) => acc + (Number(l.hours_spent) || 0), 0);
  const myTotalDelayHours = myExtensions.reduce((acc, e) => acc + (Number(e.extended_hours) || 0), 0);
  const myTotalDelayDays = myExtensions.reduce((acc, e) => acc + (Number(e.extended_days) || 0), 0);

  const currentMember = teamMembers.find((m) => m.id === session.memberId) || {
    id: session.memberId,
    project_id: project.id,
    dev_code: session.devCode,
    name: session.memberName,
    role: session.memberRole,
    email: null,
    joined_at: new Date().toISOString(),
    avatar_color: '#4F46E5',
  };

  const finishTime = calculateFinishTime(
    project.start_date,
    project.end_date,
    project.duration_days,
    project.status
  );

  const drift = calculateProjectScheduleDrift(project, tasks);

  const handleTaskStatusChange = (taskId: string, nextStatus: TaskStatus) => {
    onUpdateTaskStatus(taskId, nextStatus);
    if (nextStatus === 'completed') {
      triggerCelebration();
    }
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(session.devCode);
    setCopiedDevPin(true);
    setTimeout(() => setCopiedDevPin(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Dev Welcome & Project Overview Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2 text-xs mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-semibold">
                Project #{project.code}
              </span>
              <button
                type="button"
                onClick={handleCopyPin}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-700 font-mono font-bold text-xs transition"
                title="Copy personal PIN code"
              >
                <ShieldCheck className="w-3 h-3 text-indigo-500" />
                <span>PIN #{session.devCode}</span>
                {copiedDevPin ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-indigo-400" />}
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
              Welcome, {session.memberName}
            </h1>
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{session.memberRole}</span> • <span className="text-indigo-600 font-semibold">{project.title}</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {todayLog ? (
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-semibold text-xs shadow-2xs hover:bg-emerald-100 transition"
                title="Today's log is already recorded"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Today Logged ({todayLog.hours_spent}h)</span>
              </button>
            ) : (
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>+ Daily Log</span>
              </button>
            )}

            {/* Workspace Switcher */}
            {hasOtherSessions && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-semibold text-xs transition"
                  title="Switch to another joined project"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Switch Project</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isSwitcherOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-lg p-2 z-30 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                      Your Projects ({savedSessions.length})
                    </span>
                    {savedSessions.map((s) => (
                      <button
                        key={s.projectId}
                        type="button"
                        onClick={() => {
                          setIsSwitcherOpen(false);
                          if (onSwitchProject) {
                            onSwitchProject({
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
                          s.projectId === session.projectId
                            ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="font-bold truncate">{s.projectTitle}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {s.memberName} • PIN #{s.devCode}
                          </div>
                        </div>
                        {s.projectId === session.projectId && (
                          <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-1.5 py-0.5 rounded shadow-2xs">
                            Active
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSwitcherOpen(false);
                          onLeaveProject();
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition flex items-center space-x-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Join Another Project</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onLeaveProject}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition"
              title="Exit Project"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* Project Schedule & Developer Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 text-xs">
          <div className={`rounded-2xl p-4 border ${drift.hasDrift ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 block text-[11px] uppercase font-bold">
                Schedule
              </span>
              {drift.hasDrift && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                  +{drift.driftDays}d
                </span>
              )}
            </div>
            <span className="text-base font-extrabold text-slate-900 block">
              {project.status === 'completed'
                ? 'Completed'
                : drift.hasDrift
                ? `Est. ${formatDate(drift.projectedEnd)}`
                : finishTime.text}
            </span>
            <span className="text-[11px] text-slate-500">
              {drift.hasDrift ? `Target was ${formatDate(drift.baselineEnd)}` : `Target: ${formatDate(project.end_date)}`}
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <span className="text-slate-400 block text-[11px] uppercase font-bold mb-1">
              Tasks
            </span>
            <span className="text-base font-extrabold text-indigo-600 block">
              {myCompletedTasks.length} / {myTasks.length} Done
            </span>
            <span className="text-[11px] text-slate-500">
              {myInProgressTasks.length} in progress
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <span className="text-slate-400 block text-[11px] uppercase font-bold mb-1">
              Delays
            </span>
            <span className="text-base font-extrabold text-amber-700 block">
              {myTotalDelayDays > 0 ? `+${myTotalDelayDays}d (${myTotalDelayHours}h)` : `+${myTotalDelayHours}h`}
            </span>
            <span className="text-[11px] text-slate-500">
              {myExtensions.length} extension{myExtensions.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <span className="text-slate-400 block text-[11px] uppercase font-bold mb-1">
              Hours Logged
            </span>
            <span className="text-base font-extrabold text-slate-900 block">
              {totalHoursLogged} hrs
            </span>
            <span className="text-[11px] text-slate-500">
              {myLogs.length} daily log{myLogs.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('my_tasks')}
            className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
              activeTab === 'my_tasks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>My Tasks ({myTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('all_tasks')}
            className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
              activeTab === 'all_tasks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All Tasks ({tasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('my_logs')}
            className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
              activeTab === 'my_logs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Daily Logs ({myLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('my_extensions')}
            className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
              activeTab === 'my_extensions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Delays ({myExtensions.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: My Tasks */}
      {activeTab === 'my_tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                My Tasks ({myTasks.length})
              </h3>
              <p className="text-xs text-slate-500">
                Tasks assigned to you. Click status to update.
              </p>
            </div>
          </div>

          {myTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  allTasks={tasks}
                  teamMembers={teamMembers}
                  isDevView={true}
                  onUpdateStatus={handleTaskStatusChange}
                  onOpenExtendModal={onOpenExtendModal}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No Tasks Assigned Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Your Project Manager will assign tasks to your profile (code #{session.devCode}).
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: All Project Tasks */}
      {activeTab === 'all_tasks' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              All Tasks ({tasks.length})
            </h3>
            <p className="text-xs text-slate-500">
              Deliverables across the entire team
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                allTasks={tasks}
                teamMembers={teamMembers}
                isDevView={true}
                onUpdateStatus={handleTaskStatusChange}
                onOpenExtendModal={onOpenExtendModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: My Daily Work Logs */}
      {activeTab === 'my_logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Daily Logs ({myLogs.length})
              </h3>
              <p className="text-xs text-slate-500">
                Daily work submissions and progress updates
              </p>
            </div>

            <button
              onClick={() => setIsLogModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Daily Log</span>
            </button>
          </div>

          {myLogs.length > 0 ? (
            <div className="space-y-3">
              {myLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      {formatDate(log.log_date)}
                    </span>
                    <span className="text-slate-500 flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {log.hours_spent} hours logged
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {log.content}
                  </p>

                  {log.tasks_completed_summary && (
                    <div className="text-[11px] text-indigo-700 font-medium">
                      Tasks: {log.tasks_completed_summary}
                    </div>
                  )}

                  {log.blockers && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/60 flex items-start space-x-2 text-xs text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <strong className="font-semibold">Blockers:</strong> {log.blockers}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No Logs Submitted Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Record your daily work and blockers for the team.
              </p>
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Daily Log</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: My Extended Time */}
      {activeTab === 'my_extensions' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Delays & Extensions ({myExtensions.length})
            </h3>
            <p className="text-xs text-slate-500">
              Extensions requested with reasons
            </p>
          </div>

          {myExtensions.length > 0 ? (
            <div className="space-y-3">
              {myExtensions.map((ext) => {
                const task = tasks.find((t) => t.id === ext.task_id);
                return (
                  <div
                    key={ext.id}
                    className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 text-sm">
                        {task?.title || 'Assigned Task'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 border border-amber-300 text-xs">
                        {ext.unit === 'days' || (ext.extended_days && ext.extended_days > 0)
                          ? `+${ext.extended_days}d (${ext.extended_hours}h)`
                          : `+${ext.extended_hours}h`}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                      <span className="text-slate-500 font-semibold text-[11px] block mb-0.5">Reason:</span>
                      <p className="italic">{ext.reason}</p>
                    </div>

                    <span className="text-[11px] text-slate-400 block text-right">
                      {formatDate(ext.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
              <History className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-800">No Extensions Logged</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                You can extend assigned task deadlines by clicking Extend on any task card.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Daily Log Modal */}
      <DailyLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        projectId={project.id}
        currentMember={currentMember}
        myTasks={myTasks}
        existingLog={todayLog}
        onSubmitLog={onSubmitDailyLog}
      />
    </div>
  );
};
