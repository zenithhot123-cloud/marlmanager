import React, { useState, useEffect } from 'react';
import type { Task, TeamMember, TaskPriority, TaskStatus } from '../lib/types';
import { X, Clock, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { isWeekend } from '../lib/utils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  teamMembers: TeamMember[];
  availableTasks?: Task[];
  initialAssigneeId?: string;
  onSave: (taskData: {
    id?: string;
    title: string;
    description: string;
    assignee_id: string | null;
    depends_on_task_id?: string | null;
    duration_hours: number;
    due_date: string | null;
    priority: TaskPriority;
    status: TaskStatus;
  }) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  teamMembers,
  availableTasks = [],
  initialAssigneeId,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dependsOnTaskId, setDependsOnTaskId] = useState<string>('');
  const [durationHours, setDurationHours] = useState(4);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setAssigneeId(taskToEdit.assignee_id || '');
      setDependsOnTaskId(taskToEdit.depends_on_task_id || '');
      setDurationHours(taskToEdit.duration_hours || 4);
      setDueDate(taskToEdit.due_date ? taskToEdit.due_date.slice(0, 10) : '');
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
    } else {
      setTitle('');
      setDescription('');
      setAssigneeId(initialAssigneeId || (teamMembers.length > 0 ? teamMembers[0].id : ''));
      setDependsOnTaskId('');
      setDurationHours(4);
      setDueDate('');
      setPriority('medium');
      setStatus('todo');
    }
  }, [taskToEdit, isOpen, teamMembers, initialAssigneeId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        id: taskToEdit ? taskToEdit.id : undefined,
        title: title.trim(),
        description: description.trim(),
        assignee_id: assigneeId || null,
        depends_on_task_id: dependsOnTaskId || null,
        duration_hours: Number(durationHours) || 1,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority,
        status,
      });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save task';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {taskToEdit ? 'Edit Task' : 'New Task'}
              </h2>
              <p className="text-xs text-slate-500">
                Set task details, assignee, and deadline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Implement authentication flow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Task details and acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 resize-none"
            />
          </div>

          {/* Assignee & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs font-medium text-slate-900 bg-white"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs font-medium text-slate-900 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Duration & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Duration
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ~{(durationHours / 8).toFixed(1)} work day(s)
                </span>
              </label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                max={200}
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Due Date (Mon – Fri)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-sm text-slate-900 ${
                  dueDate && isWeekend(dueDate)
                    ? 'border-amber-300 bg-amber-50/50 focus:border-amber-500 focus:ring-amber-200'
                    : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-600'
                }`}
              />
              {Boolean(dueDate && isWeekend(dueDate)) && (
                <p className="text-[10px] text-amber-700 font-medium mt-1">
                  Weekend selected. Working days are Monday to Friday.
                </p>
              )}
            </div>
          </div>

          {/* Prerequisite / Dependency Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Prerequisite Task (Optional)</span>
              <span className="text-[10px] text-slate-400 font-normal">Cascades delay if blocked</span>
            </label>
            <select
              value={dependsOnTaskId}
              onChange={(e) => setDependsOnTaskId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs font-medium text-slate-900 bg-white"
            >
              <option value="">None (Independent task)</option>
              {availableTasks
                .filter((t) => !taskToEdit || t.id !== taskToEdit.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Depends on: {t.title} {t.due_date ? `(Due ${new Date(t.due_date).toLocaleDateString()})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Status (if editing) */}
          {taskToEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Status
              </label>
              <div className="flex items-center space-x-2">
                {(['todo', 'in_progress', 'completed'] as TaskStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                      status === st
                        ? st === 'completed'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : st === 'in_progress'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-slate-100 border-slate-300 text-slate-800'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'todo' && 'To Do'}
                    {st === 'in_progress' && 'In Progress'}
                    {st === 'completed' && 'Completed'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{taskToEdit ? 'Save Changes' : 'Assign Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
