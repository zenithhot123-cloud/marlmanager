import React, { useState, useEffect } from 'react';
import type { TeamMember, Task, DailyLog } from '../lib/types';
import { polishDailyLog } from '../lib/gemini';
import { triggerCelebration, getLocalDateString } from '../lib/utils';
import {
  X,
  Sparkles,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';

interface DailyLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentMember: TeamMember;
  myTasks: Task[];
  existingLog?: DailyLog | null;
  onSubmitLog: (logData: {
    log_date: string;
    content: string;
    blockers: string | null;
    hours_spent: number;
    tasks_completed_summary: string | null;
  }) => Promise<void>;
}

export const DailyLogModal: React.FC<DailyLogModalProps> = ({
  isOpen,
  onClose,
  currentMember,
  myTasks,
  existingLog,
  onSubmitLog,
}) => {
  const [logDate, setLogDate] = useState(getLocalDateString());
  const [content, setContent] = useState('');
  const [blockers, setBlockers] = useState('');
  const [hoursSpent, setHoursSpent] = useState(8);
  const [selectedTasksSummary, setSelectedTasksSummary] = useState<string[]>([]);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingLog) {
      setLogDate(existingLog.log_date);
      setContent(existingLog.content);
      setBlockers(existingLog.blockers || '');
      setHoursSpent(Number(existingLog.hours_spent) || 8);
      if (existingLog.tasks_completed_summary) {
        setSelectedTasksSummary(existingLog.tasks_completed_summary.split('; ').filter(Boolean));
      }
    } else {
      setLogDate(getLocalDateString());
      setContent('');
      setBlockers('');
      setHoursSpent(8);
      setSelectedTasksSummary([]);
    }
  }, [existingLog, isOpen]);

  if (!isOpen) return null;

  const handleToggleTaskCheck = (taskTitle: string) => {
    setSelectedTasksSummary((prev) =>
      prev.includes(taskTitle) ? prev.filter((t) => t !== taskTitle) : [...prev, taskTitle]
    );
  };

  const handleGeminiPolish = async () => {
    if (!content.trim()) {
      setError('Please write a quick summary of what you did first to format it.');
      return;
    }
    setError(null);
    setIsPolishing(true);
    try {
      const result = await polishDailyLog(content, currentMember.name, currentMember.role);
      setContent(result.polished);
      if (result.suggestedBlockers && !blockers) {
        setBlockers(result.suggestedBlockers);
      }
    } catch (err) {
      console.error(err);
      setError('Could not format the log at this moment.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please describe what you did today.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmitLog({
        log_date: logDate,
        content: content.trim(),
        blockers: blockers.trim() || null,
        hours_spent: Number(hoursSpent) || 8,
        tasks_completed_summary:
          selectedTasksSummary.length > 0
            ? selectedTasksSummary.join('; ')
            : null,
      });
      triggerCelebration();
      // Reset
      setContent('');
      setBlockers('');
      setHoursSpent(8);
      setSelectedTasksSummary([]);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit daily log';
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
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Daily Work Log</h2>
              <p className="text-xs text-slate-500">
                Logged by <strong className="text-slate-800">{currentMember.name}</strong> ({currentMember.role})
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
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Date & Hours Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Log Date
              </label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Hours Spent Today
              </label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                max={24}
                value={hoursSpent}
                onChange={(e) => setHoursSpent(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900"
              />
            </div>
          </div>

          {/* Quick Tasks Reference Checkbox */}
          {myTasks.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tasks Worked On Today (Optional)
              </label>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {myTasks.map((task) => (
                  <label
                    key={task.id}
                    className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                      selectedTasksSummary.includes(task.title)
                        ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900'
                        : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTasksSummary.includes(task.title)}
                      onChange={() => handleToggleTaskCheck(task.title)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate">{task.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* What did you do today */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                What Did You Accomplish Today? *
              </label>
              <button
                type="button"
                onClick={handleGeminiPolish}
                disabled={isPolishing || !content.trim()}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 transition"
              >
                {isPolishing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                    <span>Formatting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Auto-format</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              required
              rows={4}
              placeholder="e.g. Completed frontend authentication flow, fixed token refresh bug, created unit tests for API endpoints..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Blockers */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Roadblocks / Impediments (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Waiting on API credentials for Stripe, need UX clarification on checkout flow"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

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
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Daily Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
