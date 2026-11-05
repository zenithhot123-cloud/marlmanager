import React, { useState, useEffect } from 'react';
import { generate4DigitCode, formatDate, addBusinessDays, countBusinessDays, getLocalDateString } from '../lib/utils';
import { suggestProjectTasks } from '../lib/gemini';
import {
  X,
  RefreshCw,
  Sparkles,
  Calendar,
  Clock,
  Layers,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (projectData: {
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    duration_days: number;
    target_hours: number;
    code: string;
    initialTasks?: Array<{
      title: string;
      description: string;
      duration_hours: number;
      priority: 'low' | 'medium' | 'high' | 'urgent';
    }>;
  }) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const getTodayStr = () => getLocalDateString();
  const getDefaultEndStr = (start: string, workingDays = 10) =>
    getLocalDateString(addBusinessDays(start, workingDays));

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getDefaultEndStr(getTodayStr(), 10));
  const [durationDays, setDurationDays] = useState(10);
  const [targetHours, setTargetHours] = useState(80);
  const [code, setCode] = useState(generate4DigitCode());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gemini AI task generator state
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<
    Array<{
      title: string;
      description: string;
      duration_hours: number;
      priority: 'low' | 'medium' | 'high' | 'urgent';
    }>
  >([]);

  // Automatically calculate scheduled Monday-to-Friday working days
  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (newStart && endDate) {
      const workingDays = Math.max(1, countBusinessDays(newStart, endDate));
      setDurationDays(workingDays);
      setTargetHours(workingDays * 8);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd);
    if (startDate && newEnd) {
      const workingDays = Math.max(1, countBusinessDays(startDate, newEnd));
      setDurationDays(workingDays);
      setTargetHours(workingDays * 8);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const today = getTodayStr();
      const defaultEnd = getDefaultEndStr(today, 10);
      setCode(generate4DigitCode());
      setStartDate(today);
      setEndDate(defaultEnd);
      setDurationDays(10);
      setTargetHours(80);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRerollCode = () => {
    setCode(generate4DigitCode());
  };

  const handleAiSuggestTasks = async () => {
    if (!title.trim()) {
      setError('Please enter a project name first.');
      return;
    }
    setError(null);
    setIsGeneratingTasks(true);
    try {
      const tasks = await suggestProjectTasks(title, description, durationDays);
      setSuggestedTasks(tasks);
    } catch (err: unknown) {
      console.error(err);
      setError('Could not generate task suggestions at this moment.');
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }
    if (!code || code.length !== 4) {
      setError('4-digit code must be exactly 4 digits.');
      return;
    }
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      setError('Target End Date must be on or after Start Date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        duration_days: Number(durationDays) || 14,
        target_hours: Number(targetHours) || 80,
        code: code.trim(),
        initialTasks: suggestedTasks.length > 0 ? suggestedTasks : undefined,
      });
      // Reset
      setTitle('');
      setDescription('');
      setSuggestedTasks([]);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create New Project</h2>
              <p className="text-xs text-slate-500">
                Set timeline, duration, and team PIN
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Maritime Navigation App, Logistics Portal v2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Milestones, goals, or specifications..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Start Date & End Date Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs font-semibold text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                Target End Date *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs font-semibold text-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Auto-Calculated Scheduled Days Highlight Box */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">
                  Working Duration (Mon – Fri)
                </span>
                <span className="text-sm font-black text-slate-900">
                  {durationDays} Working Days
                </span>
                <span className="text-[11px] text-indigo-700 font-medium block">
                  Monday to Friday • weekends excluded
                </span>
                <span className="text-[11px] text-slate-500">
                  ({formatDate(startDate)} <ArrowRight className="w-3 h-3 inline text-slate-400" /> {formatDate(endDate)})
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Target Hours
              </span>
              <input
                type="number"
                min={1}
                max={10000}
                value={targetHours}
                onChange={(e) => setTargetHours(Number(e.target.value))}
                className="w-20 text-center font-bold text-xs px-2 py-1 bg-white border border-indigo-200 rounded-lg text-indigo-950 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">@ 8h / day</span>
            </div>
          </div>

          {/* Generated 4-Digit Code Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Team Join PIN (4 Digits)
              </span>
              <button
                type="button"
                onClick={handleRerollCode}
                className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                <span>New PIN</span>
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-32 text-center font-mono font-extrabold text-2xl tracking-[0.3em] px-3 py-2 bg-white rounded-lg border border-slate-300 text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
              <p className="text-xs text-slate-500 leading-relaxed">
                Developers will use this code to join the project.
              </p>
            </div>
          </div>

          {/* Task Suggestions */}
          <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-slate-800">
                  Task Suggestions
                </span>
              </div>
              <button
                type="button"
                disabled={isGeneratingTasks || !title.trim()}
                onClick={handleAiSuggestTasks}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
              >
                {isGeneratingTasks ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-slate-600" />
                    <span>Suggesting...</span>
                  </>
                ) : (
                  <span>Suggest Tasks</span>
                )}
              </button>
            </div>

            {suggestedTasks.length > 0 && (
              <div className="mt-2.5 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                <p className="text-[11px] font-semibold text-slate-700 mb-1">
                  {suggestedTasks.length} suggested tasks:
                </p>
                {suggestedTasks.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100"
                  >
                    <span className="font-medium text-slate-800 truncate max-w-[260px]">
                      {t.title}
                    </span>
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      {t.duration_hours}h • {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit & Cancel */}
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
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
