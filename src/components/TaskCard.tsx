import React, { useState } from 'react';
import type { Task, TeamMember, TaskStatus } from '../lib/types';
import { formatDate } from '../lib/utils';
import {
  Clock,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  PlayCircle,
  Trash2,
  Edit2,
  AlertTriangle,
  PlusCircle,
  GripVertical,
  Link2,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  teamMembers: TeamMember[];
  allTasks?: Task[];
  isDevView?: boolean;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onOpenExtendModal?: (task: Task) => void;
  onDropOnTask?: (sourceTaskId: string, targetTask: Task, insertPosition: 'before' | 'after') => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  teamMembers,
  allTasks = [],
  isDevView = false,
  onUpdateStatus,
  onEditTask,
  onDeleteTask,
  onOpenExtendModal,
  onDropOnTask,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | null>(null);
  const assignee = teamMembers.find((m) => m.id === task.assignee_id);
  const prerequisiteTask = task.depends_on_task_id
    ? allTasks.find((t) => t.id === task.depends_on_task_id)
    : null;

  const handleCardDragOver = (e: React.DragEvent) => {
    if (!onDropOnTask) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    if (offsetY < rect.height / 2) {
      if (dropIndicator !== 'top') setDropIndicator('top');
    } else {
      if (dropIndicator !== 'bottom') setDropIndicator('bottom');
    }
  };

  const handleCardDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

  const handleCardDrop = (e: React.DragEvent) => {
    if (!onDropOnTask) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceTaskId = e.dataTransfer.getData('text/plain');
    const targetIndicator = dropIndicator || 'bottom';
    setDropIndicator(null);
    if (sourceTaskId && sourceTaskId !== task.id) {
      onDropOnTask(sourceTaskId, task, targetIndicator === 'top' ? 'before' : 'after');
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'high':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const isDueSoon = task.due_date && new Date(task.due_date).getTime() < Date.now() + 24 * 60 * 60 * 1000;
  const hasDelay = (task.total_delay_hours || 0) > 0 || (task.total_delay_days || 0) > 0;

  return (
    <div className="relative">
      {dropIndicator === 'top' && (
        <div className="h-1.5 w-full bg-indigo-500 rounded-full mb-1.5 animate-pulse shadow-sm" />
      )}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, status: task.status }));
          e.dataTransfer.effectAllowed = 'move';
          setIsDragging(true);
        }}
        onDragEnd={() => setIsDragging(false)}
        onDragOver={handleCardDragOver}
        onDragLeave={handleCardDragLeave}
        onDrop={handleCardDrop}
        className={`group/card bg-white rounded-xl border transition-all duration-200 p-4 shadow-2xs hover:shadow-sm flex flex-col justify-between cursor-grab active:cursor-grabbing ${
          isDragging
            ? 'opacity-40 scale-[0.98] border-indigo-400 border-dashed ring-2 ring-indigo-200'
            : task.status === 'completed'
            ? 'border-emerald-200/80 bg-emerald-50/10'
            : hasDelay
            ? 'border-amber-200 bg-amber-50/5'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
      <div>
        {/* Priority, Duration & Delay Header */}
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            <span
              className="text-slate-300 group-hover/card:text-slate-400 transition cursor-grab"
              title="Drag task card to move between columns"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>

            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${getPriorityBadge(
                task.priority
              )}`}
            >
              {task.priority}
            </span>

            <span className="text-[11px] text-slate-400 font-medium">
              {task.duration_hours}h
            </span>

            {/* Delay Time Badge (Days or Hours) */}
            {hasDelay && (
              <span
                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-800"
                title={`Extended by ${task.total_delay_days ? `+${task.total_delay_days}d (${task.total_delay_hours}h)` : `+${task.total_delay_hours}h`}`}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                <span>
                  {task.total_delay_days && task.total_delay_days > 0
                    ? `+${task.total_delay_days}d`
                    : `+${task.total_delay_hours}h`}
                </span>
              </span>
            )}
          </div>

          {/* Status Quick Cycle Button & Actions */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                const nextStatus: TaskStatus =
                  task.status === 'todo'
                    ? 'in_progress'
                    : task.status === 'in_progress'
                    ? 'completed'
                    : 'todo';
                onUpdateStatus(task.id, nextStatus);
              }}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                task.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : task.status === 'in_progress'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Click to advance status"
            >
              {task.status === 'completed' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Done</span>
                </>
              ) : task.status === 'in_progress' ? (
                <>
                  <PlayCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span>In Progress</span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5 text-slate-400" />
                  <span>To Do</span>
                </>
              )}
            </button>

            {!isDevView && (
              <div className="flex items-center">
                <button
                  onClick={() => onEditTask && onEditTask(task)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="Edit Task"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {onDeleteTask && (
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task Title */}
        <h4
          className={`text-sm font-bold tracking-tight mb-1 ${
            task.status === 'completed'
              ? 'text-slate-400 line-through'
              : 'text-slate-900'
          }`}
        >
          {task.title}
        </h4>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2">
            {task.description}
          </p>
        )}

        {/* Prerequisite Task Link */}
        {prerequisiteTask && (
          <div className="mb-2">
            <span
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                prerequisiteTask.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title={`Depends on: ${prerequisiteTask.title} (${prerequisiteTask.status})`}
            >
              <Link2 className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
              <span className="truncate max-w-[150px]">After: {prerequisiteTask.title}</span>
              {prerequisiteTask.status !== 'completed' && (
                <span className="text-amber-600 font-semibold">• waiting</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Task Footer: Assignee, Scheduling, and Extend Action */}
      <div className="pt-3 mt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          {/* Assignee Avatar & Name */}
          <div className="flex items-center space-x-2">
            {assignee ? (
              <div className="flex items-center space-x-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-2xs"
                  style={{ backgroundColor: assignee.avatar_color || '#4F46E5' }}
                >
                  {assignee.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-700 truncate max-w-[100px]">
                  {assignee.name}
                </span>
                {assignee.dev_code && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    #{assignee.dev_code}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 italic text-[11px] flex items-center gap-1">
                <User className="w-3 h-3" /> Unassigned
              </span>
            )}
          </div>

          {/* Schedule Due Date */}
          {task.due_date ? (
            <div
              className={`flex items-center space-x-1 ${
                isDueSoon && task.status !== 'completed'
                  ? 'text-rose-600 font-bold'
                  : 'text-slate-400'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span className="text-[11px]">{formatDate(task.due_date)}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-slate-400">
              <Clock className="w-3 h-3" />
              <span className="text-[11px]">
                {(Number(task.duration_hours) || 0) + (Number(task.total_delay_hours) || 0)}h total
              </span>
            </div>
          )}
        </div>

        {/* Extend Time Button */}
        {onOpenExtendModal && task.status !== 'completed' && (
          <button
            type="button"
            onClick={() => onOpenExtendModal(task)}
            className="w-full flex items-center justify-center space-x-1.5 py-1 px-2 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 text-slate-600 hover:text-amber-800 text-[11px] font-semibold transition"
          >
            <PlusCircle className="w-3 h-3 text-amber-500" />
            <span>Extend Time</span>
          </button>
        )}
      </div>
    </div>
    {dropIndicator === 'bottom' && (
      <div className="h-1.5 w-full bg-indigo-500 rounded-full mt-1.5 animate-pulse shadow-sm" />
    )}
  </div>
  );
};
