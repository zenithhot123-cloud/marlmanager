import React, { useState, useMemo } from 'react';
import type { Project, Task, TeamMember, DailyLog, TaskStatus, TaskExtension } from '../lib/types';
import { calculateFinishTime, calculateProjectScheduleDrift, formatDate, triggerCelebration, downloadFile } from '../lib/utils';
import { TaskCard } from '../components/TaskCard';
import { ScheduleGanttTimeline } from '../components/ScheduleGanttTimeline';
import { generateDailyStandupDigest, generateOneLineDailySummary } from '../lib/gemini';
import {
  ArrowLeft,
  Plus,
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  FileText,
  ListTodo,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Download,
  Trash2,
  Search,
  X,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AdminProjectDetailProps {
  project: Project;
  tasks: Task[];
  teamMembers: TeamMember[];
  dailyLogs: DailyLog[];
  extensions: TaskExtension[];
  onBack: () => void;
  onOpenTaskModal: (task?: Task | null, preselectedMemberId?: string) => void;
  onOpenAiReport: (project: Project) => void;
  onOpenExtendModal: (task: Task) => void;
  onOpenDeleteModal: (project: Project) => void;
  onUpdateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  onReorderTask?: (taskId: string, newStatus: TaskStatus, newPosition: number) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleProjectComplete: (project: Project) => Promise<void>;
  onSaveOneLiner: (projectId: string, oneLiner: string) => Promise<void>;
}

export const AdminProjectDetail: React.FC<AdminProjectDetailProps> = ({
  project,
  tasks,
  teamMembers,
  dailyLogs,
  extensions,
  onBack,
  onOpenTaskModal,
  onOpenAiReport,
  onOpenExtendModal,
  onOpenDeleteModal,
  onUpdateTaskStatus,
  onReorderTask,
  onDeleteTask,
  onToggleProjectComplete,
  onSaveOneLiner,
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'timeline' | 'team' | 'logs' | 'delays' | 'ai'>('tasks');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Advanced Task Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [showOnlyDelayed, setShowOnlyDelayed] = useState(false);

  // Drag and Drop State
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // 1-Line Summary generation state
  const [isGeneratingOneLiner, setIsGeneratingOneLiner] = useState(false);

  // Standup Digest state
  const [standupDigest, setStandupDigest] = useState<string | null>(null);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);

  const projectTasks = tasks.filter((t) => t.project_id === project.id);
  const projectMembers = teamMembers.filter((m) => m.project_id === project.id);
  const projectLogs = dailyLogs.filter((l) => l.project_id === project.id);
  const projectExtensions = extensions.filter((e) => e.project_id === project.id);

  const completedTasks = projectTasks.filter((t) => t.status === 'completed');
  const inProgressTasks = projectTasks.filter((t) => t.status === 'in_progress');

  const progressPercent = projectTasks.length > 0
    ? Math.round((completedTasks.length / projectTasks.length) * 100)
    : 0;

  const finishTime = calculateFinishTime(
    project.start_date,
    project.end_date,
    project.duration_days,
    project.status
  );

  // Compute Project Schedule Drift
  const drift = useMemo(() => {
    return calculateProjectScheduleDrift(project, projectTasks);
  }, [project, projectTasks]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(project.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleToggleComplete = async () => {
    setIsUpdatingStatus(true);
    try {
      await onToggleProjectComplete(project);
      if (project.status !== 'completed') {
        triggerCelebration();
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Generate 1-line daily summary for Project Manager
  const handleGenerateOneLiner = async () => {
    setIsGeneratingOneLiner(true);
    try {
      const summary = await generateOneLineDailySummary(
        project.title,
        projectLogs,
        projectMembers
      );
      await onSaveOneLiner(project.id, summary);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingOneLiner(false);
    }
  };

  const handleGenerateDigest = async () => {
    setIsGeneratingDigest(true);
    try {
      const digest = await generateDailyStandupDigest(
        project.title,
        projectLogs,
        projectMembers
      );
      setStandupDigest(digest);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  const handleDownloadReport = () => {
    if (project.ai_report) {
      downloadFile(`${project.title.replace(/\s+/g, '_')}_Report_${project.code}.md`, project.ai_report);
    } else {
      onOpenAiReport(project);
    }
  };

  // Advanced Filtering
  const filteredTasks = useMemo(() => {
    return projectTasks.filter((task) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc) return false;
      }

      // Assignee filter
      if (selectedAssigneeFilter === 'unassigned') {
        if (task.assignee_id) return false;
      } else if (selectedAssigneeFilter !== 'all') {
        if (task.assignee_id !== selectedAssigneeFilter) return false;
      }

      // Priority filter
      if (selectedPriorityFilter !== 'all') {
        if (task.priority !== selectedPriorityFilter) return false;
      }

      // Delayed only filter
      if (showOnlyDelayed) {
        const hasDelay = (Number(task.total_delay_days) || 0) > 0 || (Number(task.total_delay_hours) || 0) > 0;
        if (!hasDelay) return false;
      }

      return true;
    });
  }, [projectTasks, searchQuery, selectedAssigneeFilter, selectedPriorityFilter, showOnlyDelayed]);

  const isFilteringActive =
    searchQuery.trim() !== '' ||
    selectedAssigneeFilter !== 'all' ||
    selectedPriorityFilter !== 'all' ||
    showOnlyDelayed;

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedAssigneeFilter('all');
    setSelectedPriorityFilter('all');
    setShowOnlyDelayed(false);
  };

  // Sort tasks in-column by position (fractional ordering) or creation date fallback
  const sortTasksByPosition = (taskList: Task[]): Task[] => {
    return [...taskList].sort((a, b) => {
      const posA = a.position !== undefined && a.position !== null ? a.position : 999999;
      const posB = b.position !== undefined && b.position !== null ? b.position : 999999;
      if (posA !== posB) return posA - posB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  // Dropping on column blank space (appends to end of column)
  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      const columnTasks = sortTasksByPosition(projectTasks.filter((t) => t.status === status));
      const lastTask = columnTasks[columnTasks.length - 1];
      const newPosition = lastTask ? (lastTask.position ?? 1000) + 1000 : 1000;

      if (onReorderTask) {
        onReorderTask(taskId, status, newPosition);
      } else {
        onUpdateTaskStatus(taskId, status);
      }

      if (status === 'completed') {
        triggerCelebration();
      }
    }
  };

  // Dropping directly onto another task card (calculates fractional insertion index)
  const handleDropOnTask = (
    sourceTaskId: string,
    targetTask: Task,
    insertPosition: 'before' | 'after'
  ) => {
    if (!sourceTaskId || sourceTaskId === targetTask.id) return;
    const targetStatus = targetTask.status;
    const columnTasks = sortTasksByPosition(projectTasks.filter((t) => t.status === targetStatus));
    const targetIndex = columnTasks.findIndex((t) => t.id === targetTask.id);
    if (targetIndex === -1) return;

    let newPosition = 1000;
    if (insertPosition === 'before') {
      if (targetIndex === 0) {
        newPosition = (targetTask.position ?? 1000) - 1000;
      } else {
        const prevTask = columnTasks[targetIndex - 1];
        newPosition = ((prevTask.position ?? 0) + (targetTask.position ?? 1000)) / 2;
      }
    } else {
      if (targetIndex === columnTasks.length - 1) {
        newPosition = (targetTask.position ?? 1000) + 1000;
      } else {
        const nextTask = columnTasks[targetIndex + 1];
        newPosition = ((targetTask.position ?? 1000) + (nextTask.position ?? 2000)) / 2;
      }
    }

    if (onReorderTask) {
      onReorderTask(sourceTaskId, targetStatus, newPosition);
    } else {
      onUpdateTaskStatus(sourceTaskId, targetStatus);
    }

    if (targetStatus === 'completed') {
      triggerCelebration();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Navigation & Action Ribbon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Projects</span>
        </button>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Complete / Reopen Toggle Button */}
          <button
            onClick={handleToggleComplete}
            disabled={isUpdatingStatus}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              project.status === 'completed'
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {project.status === 'completed' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Complete</span>
              </>
            )}
          </button>

          {/* Download Report Button */}
          {project.ai_report && (
            <button
              onClick={handleDownloadReport}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
              title="Download Report (.md)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
          )}

          {/* Report Button */}
          <button
            onClick={() => onOpenAiReport(project)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{project.ai_report ? 'View Report' : 'Generate Report'}</span>
          </button>

          {/* Delete Project Button */}
          <button
            onClick={() => onOpenDeleteModal(project)}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            title="Delete Project"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1-Line Daily Team Summary Banner */}
      <div className="bg-slate-50/80 rounded-xl px-4 py-2.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center space-x-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="font-semibold text-slate-800 shrink-0">Today:</span>
          <span className="text-slate-600 truncate">
            {project.daily_one_liner || 'No daily summary generated yet today.'}
          </span>
        </div>

        <button
          onClick={handleGenerateOneLiner}
          disabled={isGeneratingOneLiner}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0 self-start sm:self-auto transition disabled:opacity-50"
        >
          {isGeneratingOneLiner ? 'Summarizing...' : project.daily_one_liner ? 'Refresh' : 'Generate Summary'}
        </button>
      </div>

      {/* Project Hero Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700 transition"
                title="Copy project PIN"
              >
                <span className="text-indigo-600 font-extrabold tracking-wider">#{project.code}</span>
                {copiedCode ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </button>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {project.title}
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl mt-1 leading-relaxed">
              {project.description || 'No description added for this project.'}
            </p>
          </div>

          {/* Schedule Widget */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 min-w-[240px] shrink-0 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Schedule
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  project.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : drift.hasDrift
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : finishTime.isOverdue
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {project.status === 'completed' ? 'Delivered' : drift.statusText}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="font-semibold text-slate-800">{project.duration_days} working days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target End:</span>
                <span className="font-medium text-slate-700">{formatDate(drift.baselineEnd)}</span>
              </div>
              {drift.hasDrift && (
                <div className="flex justify-between text-amber-800 pt-0.5 border-t border-slate-200/50">
                  <span className="font-semibold">Projected:</span>
                  <span className="font-bold">{formatDate(drift.projectedEnd)} (+{drift.driftDays}d)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px] font-semibold">Tasks Done</span>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="text-lg font-bold text-slate-900">
                {completedTasks.length} / {projectTasks.length}
              </span>
              <span className="text-xs text-indigo-600 font-semibold">({progressPercent}%)</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold">In Progress</span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">
              {inProgressTasks.length}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold">Schedule Drift</span>
            <span className={`text-lg font-bold mt-0.5 block ${drift.hasDrift ? 'text-amber-600' : 'text-slate-900'}`}>
              {drift.hasDrift ? `+${drift.driftDays}d` : '0d (On Track)'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold">Team</span>
            <span className="text-lg font-bold text-slate-900 mt-0.5 block">
              {projectMembers.length} {projectMembers.length === 1 ? 'dev' : 'devs'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-1.5 ${
              activeTab === 'tasks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>Tasks ({projectTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-1.5 ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Timeline</span>
            {drift.hasDrift && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                +{drift.driftDays}d
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`pb-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-1.5 ${
              activeTab === 'team'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team ({projectMembers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('delays')}
            className={`pb-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-1.5 ${
              activeTab === 'delays'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Delays ({projectExtensions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-2 ${
              activeTab === 'logs'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Daily Logs ({projectLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`pb-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition flex items-center space-x-1.5 ${
              activeTab === 'ai'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Tasks & Kanban */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Task Filtering Toolbar */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              {/* Search input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Filters Dropdowns & Buttons */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                {/* Assignee Filter */}
                <select
                  value={selectedAssigneeFilter}
                  onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Developers</option>
                  <option value="unassigned">Unassigned</option>
                  {projectMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (#{m.dev_code})
                    </option>
                  ))}
                </select>

                {/* Priority Filter */}
                <select
                  value={selectedPriorityFilter}
                  onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                {/* Delayed Only Toggle Pill */}
                <button
                  type="button"
                  onClick={() => setShowOnlyDelayed(!showOnlyDelayed)}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    showOnlyDelayed
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-slate-600 hover:text-amber-800 hover:bg-amber-50/50 border-slate-200'
                  }`}
                  title="Filter delayed tasks"
                >
                  <AlertTriangle className={`w-3 h-3 ${showOnlyDelayed ? 'text-white' : 'text-amber-500'}`} />
                  <span>Delayed ({projectTasks.filter((t) => (Number(t.total_delay_days) || 0) > 0 || (Number(t.total_delay_hours) || 0) > 0).length})</span>
                </button>

                {/* Assign Task */}
                <button
                  onClick={() => onOpenTaskModal(null)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Task</span>
                </button>
              </div>
            </div>

            {/* Active Filters Summary Bar */}
            {isFilteringActive && (
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <SlidersHorizontal className="w-3 h-3 text-indigo-600" />
                  <span>
                    Showing {filteredTasks.length} of {projectTasks.length} tasks
                  </span>
                </div>

                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center space-x-1 text-xs font-semibold text-rose-600 hover:text-rose-800 transition"
                >
                  <X className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              </div>
            )}
          </div>

          {/* Kanban / 3-Column Task View with Native HTML5 Drag and Drop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* TO DO COLUMN */}
            <div
              onDragOver={(e) => handleDragOver(e, 'todo')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'todo')}
              className={`rounded-2xl p-4 border transition-all duration-200 min-h-[350px] flex flex-col justify-between ${
                dragOverColumn === 'todo'
                  ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300 ring-offset-2'
                  : 'bg-slate-100/60 border-slate-200/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      To Do
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {filteredTasks.filter((t) => t.status === 'todo').length}
                  </span>
                </div>

                {dragOverColumn === 'todo' && (
                  <div className="mb-3 py-2 px-3 rounded-xl border border-dashed border-indigo-400 bg-indigo-100/60 text-center text-xs font-bold text-indigo-700 animate-pulse">
                    Drop to move to To Do
                  </div>
                )}

                <div className="space-y-3">
                  {sortTasksByPosition(filteredTasks.filter((t) => t.status === 'todo')).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      allTasks={projectTasks}
                      teamMembers={projectMembers}
                      onUpdateStatus={onUpdateTaskStatus}
                      onDropOnTask={handleDropOnTask}
                      onEditTask={(t) => onOpenTaskModal(t)}
                      onDeleteTask={onDeleteTask}
                      onOpenExtendModal={onOpenExtendModal}
                    />
                  ))}
                  {filteredTasks.filter((t) => t.status === 'todo').length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-8">
                      No tasks in To Do
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* IN PROGRESS COLUMN */}
            <div
              onDragOver={(e) => handleDragOver(e, 'in_progress')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'in_progress')}
              className={`rounded-2xl p-4 border transition-all duration-200 min-h-[350px] flex flex-col justify-between ${
                dragOverColumn === 'in_progress'
                  ? 'bg-indigo-100/90 border-indigo-500 ring-2 ring-indigo-400 ring-offset-2'
                  : 'bg-indigo-50/40 border-indigo-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      In Progress
                    </span>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                    {filteredTasks.filter((t) => t.status === 'in_progress').length}
                  </span>
                </div>

                {dragOverColumn === 'in_progress' && (
                  <div className="mb-3 py-2 px-3 rounded-xl border border-dashed border-indigo-500 bg-indigo-200/60 text-center text-xs font-bold text-indigo-800 animate-pulse">
                    Drop to move In Progress
                  </div>
                )}

                <div className="space-y-3">
                  {sortTasksByPosition(filteredTasks.filter((t) => t.status === 'in_progress')).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      allTasks={projectTasks}
                      teamMembers={projectMembers}
                      onUpdateStatus={onUpdateTaskStatus}
                      onDropOnTask={handleDropOnTask}
                      onEditTask={(t) => onOpenTaskModal(t)}
                      onDeleteTask={onDeleteTask}
                      onOpenExtendModal={onOpenExtendModal}
                    />
                  ))}
                  {filteredTasks.filter((t) => t.status === 'in_progress').length === 0 && (
                    <p className="text-xs text-indigo-400 italic text-center py-8">
                      No tasks in progress
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* COMPLETED COLUMN */}
            <div
              onDragOver={(e) => handleDragOver(e, 'completed')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'completed')}
              className={`rounded-2xl p-4 border transition-all duration-200 min-h-[350px] flex flex-col justify-between ${
                dragOverColumn === 'completed'
                  ? 'bg-emerald-100/90 border-emerald-500 ring-2 ring-emerald-400 ring-offset-2'
                  : 'bg-emerald-50/40 border-emerald-100'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      Completed
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                    {filteredTasks.filter((t) => t.status === 'completed').length}
                  </span>
                </div>

                {dragOverColumn === 'completed' && (
                  <div className="mb-3 py-2 px-3 rounded-xl border border-dashed border-emerald-500 bg-emerald-200/60 text-center text-xs font-bold text-emerald-800 animate-pulse">
                    Drop to mark Completed 🎉
                  </div>
                )}

                <div className="space-y-3">
                  {sortTasksByPosition(filteredTasks.filter((t) => t.status === 'completed')).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      allTasks={projectTasks}
                      teamMembers={projectMembers}
                      onUpdateStatus={onUpdateTaskStatus}
                      onDropOnTask={handleDropOnTask}
                      onEditTask={(t) => onOpenTaskModal(t)}
                      onDeleteTask={onDeleteTask}
                      onOpenExtendModal={onOpenExtendModal}
                    />
                  ))}
                  {filteredTasks.filter((t) => t.status === 'completed').length === 0 && (
                    <p className="text-xs text-emerald-400 italic text-center py-8">
                      No completed tasks yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Timeline & Gantt Chart */}
      {activeTab === 'timeline' && (
        <ScheduleGanttTimeline
          project={project}
          tasks={projectTasks}
          teamMembers={projectMembers}
          extensions={projectExtensions}
        />
      )}

      {/* TAB 2: Dev Team Members & 2-Digit Codes */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Dev Team Roster & Access Codes ({projectMembers.length})
            </h3>
            <p className="text-xs text-slate-500">
              Each developer holds a personal 2-digit PIN to re-enter this project anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectMembers.map((member) => {
              const memberTasks = projectTasks.filter((t) => t.assignee_id === member.id);
              const memberDone = memberTasks.filter((t) => t.status === 'completed').length;
              const memberLogs = projectLogs.filter((l) => l.member_id === member.id);
              const memberExts = projectExtensions.filter((e) => e.member_id === member.id);

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs"
                        style={{ backgroundColor: member.avatar_color || '#4F46E5' }}
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                        <span className="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
                          {member.role}
                        </span>
                      </div>
                    </div>

                    {/* Personal 2-Digit PIN Badge */}
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Personal PIN</span>
                      <span className="font-mono font-extrabold text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg inline-block">
                        #{member.dev_code}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Tasks Assigned:</span>
                      <span className="font-semibold text-slate-900">
                        {memberDone} / {memberTasks.length} done
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Daily Logs:</span>
                      <span className="font-semibold text-slate-900">{memberLogs.length} submitted</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Time Extensions:</span>
                      <span className="font-semibold text-amber-700">
                        {memberExts.length} ({memberExts.reduce((a, b) => a + Number(b.extended_days || 0), 0) > 0 ? `+${memberExts.reduce((a, b) => a + Number(b.extended_days || 0), 0)}d / ` : ''}+{memberExts.reduce((a, b) => a + Number(b.extended_hours), 0)}h)
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenTaskModal(null, member.id)}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
                  >
                    Assign Task to {member.name.split(' ')[0]}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Extended Time & Delays */}
      {activeTab === 'delays' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Task Schedule Extensions & Delay Log ({projectExtensions.length})
            </h3>
            <p className="text-xs text-slate-500">
              Full record of time added to tasks, reasons provided by developers, and total impact on project deadline
            </p>
          </div>

          {projectExtensions.length > 0 ? (
            <div className="space-y-3">
              {projectExtensions.map((ext) => {
                const task = projectTasks.find((t) => t.id === ext.task_id);
                const member = projectMembers.find((m) => m.id === ext.member_id);

                return (
                  <div
                    key={ext.id}
                    className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {ext.unit === 'days' || (ext.extended_days && ext.extended_days > 0)
                            ? `+${ext.extended_days} Days Added (${ext.extended_hours}h)`
                            : `+${ext.extended_hours} Hours Added`}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {task?.title || 'Unknown Task'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-slate-500">
                        <span>Requested by <strong>{member?.name || 'Developer'}</strong></span>
                        <span>•</span>
                        <span>{formatDate(ext.created_at)}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                      <strong className="text-slate-900 block mb-1">Reason for Extension:</strong>
                      <p className="italic">{ext.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">No Task Delays Logged</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No developer has requested a time extension for this project yet. All tasks are proceeding on their initial duration estimates.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Daily Dev Logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                End-of-Day Developer Logs ({projectLogs.length})
              </h3>
              <p className="text-xs text-slate-500">
                Daily basis work submitted by each person at the end of each work day
              </p>
            </div>

            <button
              onClick={handleGenerateDigest}
              disabled={isGeneratingDigest || projectLogs.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              {isGeneratingDigest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Standup Digest</span>
                </>
              )}
            </button>
          </div>

          {/* Standup Digest output */}
          {standupDigest && (
            <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-200 text-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Standup Digest
                </span>
                <button
                  onClick={() => setStandupDigest(null)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Dismiss
                </button>
              </div>
              <div className="prose prose-xs max-w-none text-slate-800">
                <ReactMarkdown>{standupDigest}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Daily Logs list */}
          <div className="space-y-3">
            {projectLogs.map((log) => {
              const author = projectMembers.find((m) => m.id === log.member_id);
              return (
                <div
                  key={log.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {author && (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: author.avatar_color || '#4F46E5' }}
                        >
                          {author.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs font-bold text-slate-900">
                        {author?.name || 'Developer'}
                      </span>
                      {author?.dev_code && (
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          #{author.dev_code}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {author?.role || 'Team Member'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{log.hours_spent} hours</span>
                      <span className="text-slate-300">|</span>
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700">{formatDate(log.log_date)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {log.content}
                  </p>

                  {log.tasks_completed_summary && (
                    <div className="pt-1 text-[11px] text-indigo-700 font-medium">
                      Tasks: {log.tasks_completed_summary}
                    </div>
                  )}

                  {log.blockers && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/60 flex items-start space-x-2 text-xs text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <strong className="font-semibold">Blocker:</strong> {log.blockers}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: Project Report */}
      {activeTab === 'ai' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Project Summary & Delivery Report
              </h3>
              <p className="text-xs text-slate-500">
                Evaluation of tasks, delays, reasons, and team contributions.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {project.ai_report && (
                <button
                  onClick={handleDownloadReport}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              )}
              <button
                onClick={() => onOpenAiReport(project)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{project.ai_report ? 'Regenerate Report' : 'Generate Report'}</span>
              </button>
            </div>
          </div>

          {project.ai_report ? (
            <div className="prose prose-xs max-w-none text-slate-800">
              <ReactMarkdown>{project.ai_report}</ReactMarkdown>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Sparkles className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                Report is ready to be generated
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                Click the button above to generate a full report detailing all extended times, reasons, daily work of each dev, and project delivery status.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
