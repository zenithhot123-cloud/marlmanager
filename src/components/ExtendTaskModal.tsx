import React, { useState } from 'react';
import type { Task } from '../lib/types';
import { X, Clock, AlertTriangle, CheckCircle2, History, Calendar, ArrowRight, Briefcase } from 'lucide-react';
import { formatDateWithWeekday, addBusinessDays, formatDate, isWeekend } from '../lib/utils';

interface ExtendTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onExtend: (
    taskId: string,
    hours: number,
    days: number,
    unit: 'hours' | 'days',
    reason: string,
    calculatedNewDueDate?: string | null
  ) => Promise<void>;
}

export const ExtendTaskModal: React.FC<ExtendTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onExtend,
}) => {
  const [unit, setUnit] = useState<'days' | 'hours'>('days');
  const [extendedDays, setExtendedDays] = useState(1);
  const [extendedHours, setExtendedHours] = useState(8);
  const [useBusinessDays, setUseBusinessDays] = useState(true);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickDays = [1, 2, 3, 5, 7];
  const quickHours = [1, 2, 4, 8, 16];

  const handleUnitChange = (newUnit: 'days' | 'hours') => {
    setUnit(newUnit);
    if (newUnit === 'days') {
      const d = Math.max(1, Math.round(extendedHours / 8) || 1);
      setExtendedDays(d);
      setExtendedHours(d * 8);
    } else {
      const h = Math.max(1, extendedDays * 8);
      setExtendedHours(h);
    }
  };

  const handleDaysChange = (val: number) => {
    const d = Math.max(0.5, val);
    setExtendedDays(d);
    setExtendedHours(Math.round(d * 8 * 10) / 10);
  };

  const handleHoursChange = (val: number) => {
    const h = Math.max(0.5, val);
    setExtendedHours(h);
    setExtendedDays(Math.round((h / 8) * 10) / 10);
  };

  const calculateNewDueDate = () => {
    if (!task.due_date) return null;
    if (unit === 'days') {
      if (useBusinessDays) {
        return addBusinessDays(task.due_date, extendedDays).toISOString();
      } else {
        const currentMs = new Date(task.due_date).getTime();
        return new Date(currentMs + extendedDays * 24 * 60 * 60 * 1000).toISOString();
      }
    } else {
      if (useBusinessDays) {
        // 8 hours per working day (Monday - Friday)
        const workingDaysToAdd = Math.floor(extendedHours / 8);
        const remHours = extendedHours % 8;
        let target = addBusinessDays(task.due_date, workingDaysToAdd);
        if (remHours > 0) {
          target = new Date(target.getTime() + remHours * 60 * 60 * 1000);
          while (isWeekend(target)) {
            target.setDate(target.getDate() + 1);
          }
        }
        return target.toISOString();
      } else {
        const currentMs = new Date(task.due_date).getTime();
        return new Date(currentMs + extendedHours * 60 * 60 * 1000).toISOString();
      }
    }
  };

  const newDueDate = calculateNewDueDate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for extending the assigned time.');
      return;
    }
    if (unit === 'days' && extendedDays <= 0) {
      setError('Please enter a valid number of days.');
      return;
    }
    if (unit === 'hours' && extendedHours <= 0) {
      setError('Please enter a valid number of hours.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const finalHours = unit === 'days' ? extendedDays * 8 : extendedHours;
      const finalDays = unit === 'days' ? extendedDays : Math.round((extendedHours / 8) * 10) / 10;

      await onExtend(task.id, finalHours, finalDays, unit, reason.trim(), newDueDate);
      setReason('');
      setExtendedDays(1);
      setExtendedHours(8);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extend task time';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Extend Task Schedule</h2>
              <p className="text-xs text-slate-500">
                Adjust deadline by days or hours with reason
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Task Details Banner */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Target Task
            </span>
            <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
            <div className="flex items-center space-x-3 text-slate-500 pt-1 flex-wrap gap-y-1">
              <span>Original Duration: <strong>{task.duration_hours}h</strong></span>
              <span>•</span>
              <span className="text-amber-700 font-semibold">
                Current Delay: <strong>+{task.total_delay_days ? `${task.total_delay_days}d (${task.total_delay_hours}h)` : `${task.total_delay_hours || 0}h`}</strong> ({task.delay_count || 0} recorded)
              </span>
            </div>
          </div>

          {/* Unit Toggle: Days vs Hours */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Extension Unit
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => handleUnitChange('days')}
                className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition ${unit === 'days'
                  ? 'bg-white text-amber-900 shadow-xs border border-amber-200/60'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Extend by Days</span>
              </button>
              <button
                type="button"
                onClick={() => handleUnitChange('hours')}
                className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-bold transition ${unit === 'hours'
                  ? 'bg-white text-amber-900 shadow-xs border border-amber-200/60'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Extend by Hours</span>
              </button>
            </div>

            {/* Working Days vs Calendar Days Toggle */}
            <div className="mt-2.5 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                Working Days Only (Monday – Friday, skip weekends)
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBusinessDays}
                  onChange={(e) => setUseBusinessDays(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Days Input Mode */}
          {unit === 'days' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Additional Days Needed *
                </label>
                <span className="text-[11px] font-semibold text-amber-700">
                  Equivalent to +{extendedDays * 8} Working Hours
                </span>
              </div>

              {/* Quick Days Pills */}
              <div className="flex space-x-1.5 mb-2 flex-wrap gap-y-1">
                {quickDays.map((qd) => (
                  <button
                    type="button"
                    key={qd}
                    onClick={() => handleDaysChange(qd)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${extendedDays === qd
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    +{qd} {qd === 1 ? 'Day' : 'Days'}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min={0.5}
                step={0.5}
                max={60}
                required
                value={extendedDays}
                onChange={(e) => handleDaysChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold text-slate-900"
              />
            </div>
          ) : (
            /* Hours Input Mode */
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Additional Hours Needed *
                </label>
                <span className="text-[11px] font-semibold text-amber-700">
                  Equivalent to ~{Math.round((extendedHours / 8) * 10) / 10} Days
                </span>
              </div>

              {/* Quick Hours Pills */}
              <div className="flex space-x-1.5 mb-2 flex-wrap gap-y-1">
                {quickHours.map((qh) => (
                  <button
                    type="button"
                    key={qh}
                    onClick={() => handleHoursChange(qh)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${extendedHours === qh
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    +{qh}h
                  </button>
                ))}
              </div>

              <input
                type="number"
                min={0.5}
                step={0.5}
                max={200}
                required
                value={extendedHours}
                onChange={(e) => handleHoursChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold text-slate-900"
              />
            </div>
          )}

          {/* Projected Schedule Shift Display */}
          {task.due_date && newDueDate && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <span className="text-slate-500">Scheduled Deadline:</span>
              <div className="flex items-center space-x-1.5 font-bold">
                <span className="text-slate-400 line-through">{formatDateWithWeekday(task.due_date)}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-amber-900">{formatDateWithWeekday(newDueDate)}</span>
              </div>
            </div>
          )}

          {/* Reason for extension */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Extended Time *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Unforeseen dependency on third-party API rate limits; required architectural refactor and additional integration tests..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm text-slate-900 placeholder:text-slate-400 resize-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Recorded in the project history and summary report.
            </p>
          </div>

          {/* Past Extensions History if any */}
          {task.extensions && task.extensions.length > 0 && (
            <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-2">
                <History className="w-3.5 h-3.5" /> Previous Extensions ({task.extensions.length})
              </span>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 text-xs">
                {task.extensions.map((ext, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700">
                    <div className="flex justify-between font-bold text-amber-700 text-[11px]">
                      <span>
                        {ext.unit === 'days' || ext.extended_days
                          ? `+${ext.extended_days} days (+${ext.extended_hours}h)`
                          : `+${ext.extended_hours} hours`}
                      </span>
                      <span className="text-slate-400 font-normal">{formatDate(ext.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{ext.reason}</p>
                  </div>
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
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : `Extend (+${unit === 'days' ? `${extendedDays}d` : `${extendedHours}h`})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
