import React, { useState, useMemo } from 'react';
import type { Project, Task, TeamMember, TaskExtension } from '../lib/types';
import { calculateProjectScheduleDrift, formatDate } from '../lib/utils';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  Circle,
  Flag,
  Link2,
} from 'lucide-react';

interface ScheduleGanttTimelineProps {
  project: Project;
  tasks: Task[];
  teamMembers: TeamMember[];
  extensions: TaskExtension[];
}

export const ScheduleGanttTimeline: React.FC<ScheduleGanttTimelineProps> = ({
  project,
  tasks,
  teamMembers,
  extensions,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'delayed_only' | 'active_only'>('all');

  // Compute schedule drift
  const drift = useMemo(() => {
    return calculateProjectScheduleDrift(project, tasks);
  }, [project, tasks]);

  // Project timeline bounds
  const timelineStartMs = useMemo(() => {
    return new Date(drift.baselineStart).getTime();
  }, [drift.baselineStart]);

  const timelineEndMs = useMemo(() => {
    const projEndMs = new Date(drift.projectedEnd).getTime();
    // Add 1 extra day padding for visual clarity
    return projEndMs + 24 * 60 * 60 * 1000;
  }, [drift.projectedEnd]);

  const totalTimelineDurationMs = Math.max(timelineEndMs - timelineStartMs, 86400000);

  // Today marker percentage
  const todayMs = Date.now();
  const todayPercentage = Math.min(
    100,
    Math.max(0, ((todayMs - timelineStartMs) / totalTimelineDurationMs) * 100)
  );

  // Baseline end percentage
  const baselineEndMs = new Date(drift.baselineEnd).getTime();
  const baselineEndPercentage = Math.min(
    100,
    Math.max(0, ((baselineEndMs - timelineStartMs) / totalTimelineDurationMs) * 100)
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filterMode === 'delayed_only') {
      result = result.filter(
        (t) => (Number(t.total_delay_days) || 0) > 0 || (Number(t.total_delay_hours) || 0) > 0
      );
    } else if (filterMode === 'active_only') {
      result = result.filter((t) => t.status !== 'completed');
    }
    // Sort by due date (earliest first), then created date
    return result.sort((a, b) => {
      const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
      return dateA - dateB;
    });
  }, [tasks, filterMode]);

  // Generate date tick marks across the timeline
  const tickMarks = useMemo(() => {
    const ticks: Array<{ label: string; percent: number }> = [];
    const stepCount = 5;
    for (let i = 0; i <= stepCount; i++) {
      const timeAtStep = timelineStartMs + (totalTimelineDurationMs * i) / stepCount;
      ticks.push({
        label: new Date(timeAtStep).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        percent: (i / stepCount) * 100,
      });
    }
    return ticks;
  }, [timelineStartMs, totalTimelineDurationMs]);

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Timeline & Schedule Drift
              </h2>
              {drift.hasDrift ? (
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>+{drift.driftDays}d Drift</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>On Schedule</span>
                </span>
              )}
              {Boolean(drift.cascadingTasksCount && drift.cascadingTasksCount > 0) && (
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  <Link2 className="w-3 h-3 text-amber-700 shrink-0" />
                  <span>{drift.cascadingTasksCount} Cascading Delay{drift.cascadingTasksCount > 1 ? 's' : ''}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilterMode('delayed_only')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                filterMode === 'delayed_only'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Delayed ({tasks.filter((t) => (t.total_delay_days || 0) > 0 || (t.total_delay_hours || 0) > 0).length})</span>
            </button>
            <button
              onClick={() => setFilterMode('active_only')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterMode === 'active_only'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Active ({tasks.filter((t) => t.status !== 'completed').length})
            </button>
          </div>
        </div>

        {/* Milestone Comparison Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Target Deadline
            </span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">
              {formatDate(drift.baselineEnd)}
            </span>
            <span className="text-[11px] text-slate-500">
              {project.duration_days} working days planned
            </span>
          </div>

          <div
            className={`rounded-xl p-3 border ${
              drift.hasDrift
                ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                : 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
            }`}
          >
            <span className="text-[11px] font-semibold block opacity-75">
              Projected Finish
            </span>
            <span className="text-sm font-bold mt-0.5 block">
              {formatDate(drift.projectedEnd)}
            </span>
            <span className="text-[11px]">
              {drift.hasDrift
                ? `+${drift.driftDays}d delay (${drift.driftHours}h)`
                : 'Matches target'}
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Task Delays
            </span>
            <span className="text-sm font-bold text-amber-700 mt-0.5 block">
              {drift.totalTaskDelayDays > 0
                ? `+${drift.totalTaskDelayDays}d (${drift.totalTaskDelayHours}h)`
                : `+${drift.totalTaskDelayHours}h`}
            </span>
            <span className="text-[11px] text-slate-500">
              {extensions.length} extension(s)
            </span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Status
            </span>
            <span className="text-sm font-bold text-slate-900 mt-0.5 block">
              {drift.statusText}
            </span>
            <span className="text-[11px] text-slate-500">
              {drift.percentage}% elapsed
            </span>
          </div>
        </div>
      </div>

      {/* Visual Gantt Chart Area */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-5 overflow-hidden">
        {/* Timeline Chart Legend */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100 text-xs">
          <span className="font-semibold text-slate-700">
            Schedule View
          </span>

          <div className="flex items-center space-x-4 flex-wrap gap-y-1.5 text-[11px] text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-indigo-600"></span>
              <span>Baseline Plan</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-amber-500"></span>
              <span>Schedule Drift / Delay</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500"></span>
              <span>Completed</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200"></span>
              <span>Today Marker</span>
            </div>
          </div>
        </div>

        {/* Master Project Milestone Track */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center space-x-1.5">
              <Flag className="w-4 h-4 text-indigo-600" />
              <span>Project Lifecycle: {project.title}</span>
            </span>
            <span className="text-[11px] text-slate-500">
              {formatDate(drift.baselineStart)} — {formatDate(drift.projectedEnd)}
            </span>
          </div>

          <div className="relative h-9 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
            {/* Baseline Planned Bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-indigo-600 flex items-center justify-between px-3 text-white text-[11px] font-bold"
              style={{ width: `${baselineEndPercentage}%` }}
              title={`Baseline Duration: ${formatDate(drift.baselineStart)} to ${formatDate(drift.baselineEnd)}`}
            >
              <span className="truncate">Planned Schedule ({project.duration_days} working days)</span>
              <span className="text-[10px] text-indigo-200 shrink-0 ml-1">{formatDate(drift.baselineEnd)}</span>
            </div>

            {/* Projected Drift Block (if applicable) */}
            {drift.hasDrift && (
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 to-amber-600 border-l border-amber-300 flex items-center px-2 text-white text-[11px] font-extrabold shadow-sm"
                style={{
                  left: `${baselineEndPercentage}%`,
                  width: `${Math.max(4, 100 - baselineEndPercentage)}%`,
                }}
                title={`Schedule Drift: +${drift.driftDays} days pushed past baseline target`}
              >
                <AlertTriangle className="w-3 h-3 mr-1 text-amber-200 shrink-0" />
                <span className="truncate">+{drift.driftDays}d Drift</span>
              </div>
            )}

            {/* Today Reference Line */}
            {todayPercentage >= 0 && todayPercentage <= 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 shadow-xs"
                style={{ left: `${todayPercentage}%` }}
              >
                <span className="absolute -top-1 -translate-x-1/2 bg-rose-600 text-white text-[9px] font-extrabold px-1 rounded uppercase tracking-wider">
                  Today
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Date Time Scale Axis */}
        <div className="relative h-6 border-b border-slate-200">
          {tickMarks.map((tick, idx) => (
            <div
              key={idx}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${tick.percent}%` }}
            >
              <span className="text-[10px] font-semibold text-slate-400">{tick.label}</span>
              <div className="w-px h-1.5 bg-slate-300 mt-0.5"></div>
            </div>
          ))}
        </div>

        {/* Task Rows List */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No tasks match this filter</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Try switching filter modes or assign new tasks</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const assignee = teamMembers.find((m) => m.id === task.assignee_id);
              const prereqTask = task.depends_on_task_id
                ? tasks.find((t) => t.id === task.depends_on_task_id)
                : null;
              const taskDelayDays = Number(task.total_delay_days) || 0;
              const taskDelayHours = Number(task.total_delay_hours) || 0;
              const hasTaskDelay = taskDelayDays > 0 || taskDelayHours > 0;

              // Calculate start and end percentages for this task
              const taskStartMs = new Date(task.created_at || project.start_date).getTime();
              const taskDueMs = task.due_date
                ? new Date(task.due_date).getTime()
                : taskStartMs + (task.duration_hours / 8) * 24 * 60 * 60 * 1000;

              // Baseline bar calculation
              const taskStartPercent = Math.min(
                95,
                Math.max(0, ((taskStartMs - timelineStartMs) / totalTimelineDurationMs) * 100)
              );
              const taskDuePercent = Math.min(
                100,
                Math.max(taskStartPercent + 2, ((taskDueMs - timelineStartMs) / totalTimelineDurationMs) * 100)
              );
              const taskBarWidth = Math.max(2, taskDuePercent - taskStartPercent);

              // Delay width calculation (if extended)
              const delayDurationMs = taskDelayDays > 0
                ? taskDelayDays * 24 * 60 * 60 * 1000
                : (taskDelayHours / 8) * 24 * 60 * 60 * 1000;
              const delayWidthPercent = Math.min(
                100 - taskDuePercent,
                Math.max(2, (delayDurationMs / totalTimelineDurationMs) * 100)
              );

              return (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-slate-300 transition-all space-y-2.5"
                >
                  {/* Task Meta Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      {/* Status Icon */}
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : task.status === 'in_progress' ? (
                        <PlayCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}

                      <span
                        className={`font-bold tracking-tight ${
                          task.status === 'completed'
                            ? 'text-slate-400 line-through'
                            : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Priority Tag */}
                      <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {task.priority}
                      </span>

                      {/* Prerequisite Link Tag */}
                      {prereqTask && (
                        <span
                          className="inline-flex items-center space-x-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                          title={`Prerequisite deliverable: ${prereqTask.title}`}
                        >
                          <Link2 className="w-2.5 h-2.5 text-indigo-500" />
                          <span className="truncate max-w-[130px]">After: {prereqTask.title}</span>
                        </span>
                      )}

                      {/* Delay Tag */}
                      {hasTaskDelay && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                          <span>
                            {taskDelayDays > 0 ? `+${taskDelayDays}d Delay` : `+${taskDelayHours}h Delay`}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Assignee & Dates */}
                    <div className="flex items-center space-x-3 text-slate-500 text-[11px] shrink-0">
                      {assignee && (
                        <div className="flex items-center space-x-1.5">
                          <div
                            className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                            style={{ backgroundColor: assignee.avatar_color || '#4F46E5' }}
                          >
                            {assignee.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-700">{assignee.name}</span>
                        </div>
                      )}

                      <span className="text-slate-400">
                        Due: {task.due_date ? formatDate(task.due_date) : `${task.duration_hours}h total`}
                      </span>
                    </div>
                  </div>

                  {/* Task Timeline Track */}
                  <div className="relative h-6 bg-slate-100/80 rounded-lg overflow-hidden border border-slate-200/60">
                    {/* Baseline Bar */}
                    <div
                      className={`absolute top-1 bottom-1 rounded-md transition-all flex items-center px-2 text-white text-[10px] font-bold ${
                        task.status === 'completed'
                          ? 'bg-emerald-500/90'
                          : task.status === 'in_progress'
                          ? 'bg-indigo-600'
                          : 'bg-slate-400'
                      }`}
                      style={{
                        left: `${taskStartPercent}%`,
                        width: `${taskBarWidth}%`,
                      }}
                      title={`${task.title}: Scheduled ${task.duration_hours}h`}
                    >
                      <span className="truncate text-[9px]">{task.duration_hours}h</span>
                    </div>

                    {/* Delay Extension Bar */}
                    {hasTaskDelay && (
                      <div
                        className="absolute top-1 bottom-1 rounded-md bg-amber-500 border border-amber-300 flex items-center px-1.5 text-white text-[9px] font-extrabold shadow-2xs"
                        style={{
                          left: `${taskDuePercent}%`,
                          width: `${delayWidthPercent}%`,
                        }}
                        title={`Extended: ${taskDelayDays > 0 ? `+${taskDelayDays} days` : `+${taskDelayHours} hours`}`}
                      >
                        <span className="truncate">
                          {taskDelayDays > 0 ? `+${taskDelayDays}d` : `+${taskDelayHours}h`}
                        </span>
                      </div>
                    )}

                    {/* Today reference line on task track */}
                    {todayPercentage >= 0 && todayPercentage <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-400/80 z-10"
                        style={{ left: `${todayPercentage}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
