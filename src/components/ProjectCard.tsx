import React, { useState } from 'react';
import type { Project, Task, TeamMember } from '../lib/types';
import { calculateFinishTime, calculateProjectScheduleDrift, formatDate } from '../lib/utils';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  tasks: Task[];
  teamMembers: TeamMember[];
  onOpenProject: (project: Project) => void;
  onOpenAiReport: (project: Project) => void;
  onToggleComplete?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  tasks,
  teamMembers,
  onOpenProject,
  onOpenAiReport,
}) => {
  const [copied, setCopied] = useState(false);

  const projectTasks = tasks.filter((t) => t.project_id === project.id);
  const completedTasks = projectTasks.filter((t) => t.status === 'completed');
  const projectMembers = teamMembers.filter((m) => m.project_id === project.id);

  const taskProgress = projectTasks.length > 0
    ? Math.round((completedTasks.length / projectTasks.length) * 100)
    : 0;

  const finishTime = calculateFinishTime(
    project.start_date,
    project.end_date,
    project.duration_days,
    project.status
  );

  const drift = calculateProjectScheduleDrift(project, projectTasks);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(project.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => onOpenProject(project)}
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
    >
      <div className="p-6">
        {/* Top Header: code pill and status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700 transition"
            title="Copy project code"
          >
            <span className="text-indigo-600 font-extrabold tracking-wider">#{project.code}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
            )}
          </button>

          {/* Status & Schedule Drift Badges */}
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 justify-end">
            {drift.hasDrift && project.status !== 'completed' && (
              <span
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                title={`Projected Finish: ${formatDate(drift.projectedEnd)} (${drift.driftDays} days pushed)`}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                <span>+{drift.driftDays}d Drift</span>
              </span>
            )}

            {project.status === 'completed' ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Completed</span>
              </span>
            ) : finishTime.isOverdue ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <Clock className="w-3 h-3 text-rose-500" />
                <span>Overdue</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                <span>Active</span>
              </span>
            )}
          </div>
        </div>

        {/* Project Title & Description */}
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition tracking-tight line-clamp-1 mb-1">
          {project.title}
        </h3>
        <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px] mb-4">
          {project.description || 'No description provided for this project.'}
        </p>

        {/* Total Finish Time & Schedule Drift Card */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
            <div>
              <span className="font-semibold block text-slate-900">
                {project.status === 'completed'
                  ? 'Finished on time'
                  : drift.hasDrift
                  ? `Est. ${formatDate(drift.projectedEnd)}`
                  : finishTime.text}
              </span>
              <span className="text-[11px] text-slate-500">
                {project.duration_days} working days {drift.hasDrift ? `(+${drift.driftDays}d drift)` : ''}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">
              {drift.hasDrift ? 'Projected Finish' : 'Target Finish'}
            </span>
            <span className={`font-semibold ${drift.hasDrift ? 'text-amber-700 font-bold' : 'text-slate-700'}`}>
              {formatDate(drift.hasDrift ? drift.projectedEnd : project.end_date)}
            </span>
          </div>
        </div>

        {/* Task Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
            <span className="text-slate-600 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              Task Progress
            </span>
            <span className="text-slate-900 font-semibold">
              {completedTasks.length} / {projectTasks.length} ({taskProgress}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                taskProgress === 100
                  ? 'bg-emerald-500'
                  : taskProgress > 50
                  ? 'bg-indigo-600'
                  : 'bg-indigo-400'
              }`}
              style={{ width: `${taskProgress}%` }}
            />
          </div>
        </div>

        {/* Joined Devs Preview */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {projectMembers.length}{' '}
              {projectMembers.length === 1 ? 'dev joined' : 'devs joined'}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Started {formatDate(project.start_date)}</span>
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenAiReport(project);
          }}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>{project.ai_report ? 'View Report' : 'Project Report'}</span>
        </button>

        <span className="inline-flex items-center text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition">
          <span>Manage</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </div>
  );
};
