import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Project, TeamMember, Task, DailyLog, TaskExtension } from '../lib/types';
import { generateProjectCompletionReport } from '../lib/gemini';
import { formatDate, downloadFile } from '../lib/utils';
import {
  X,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface AiReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  teamMembers: TeamMember[];
  tasks: Task[];
  dailyLogs: DailyLog[];
  extensions?: TaskExtension[];
  onSaveReport: (reportContent: string) => Promise<void>;
}

export const AiReportModal: React.FC<AiReportModalProps> = ({
  isOpen,
  onClose,
  project,
  teamMembers,
  tasks,
  dailyLogs,
  extensions = [],
  onSaveReport,
}) => {
  const [report, setReport] = useState<string>(project.ai_report || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await generateProjectCompletionReport(
        project,
        teamMembers,
        tasks,
        dailyLogs,
        extensions
      );
      setReport(generated);
      await onSaveReport(generated);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to generate report';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    const filename = `${project.title.replace(/\s+/g, '_')}_Report_${project.code}.md`;
    downloadFile(filename, report);
  };

  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const loggedHours = dailyLogs.reduce((acc, l) => acc + (Number(l.hours_spent) || 0), 0);
  const totalDelayHours = extensions.reduce((acc, e) => acc + (Number(e.extended_hours) || 0), 0);
  const totalDelayDays = extensions.reduce((acc, e) => acc + (Number(e.extended_days) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Project Summary Report
              </h2>
              <p className="text-xs text-slate-500">
                Summary of task deliverables, extensions, reasons, and team contributions.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {report && (
              <>
                <button
                  onClick={handleDownloadReport}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition"
                  title="Download Markdown Report"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  title="Copy to Clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Project KPI Summary Ribbon */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Planned Duration</span>
              <span className="font-semibold text-slate-800">{project.duration_days} Days</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tasks Delivered</span>
              <span className="font-semibold text-slate-800">
                {completedTasks.length} / {tasks.length}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Logged Effort</span>
              <span className="font-semibold text-slate-800">{loggedHours} Hours</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Schedule Delay Added</span>
              <span className="font-semibold text-amber-700">
                {totalDelayDays > 0 ? `+${totalDelayDays}d (+${totalDelayHours}h)` : `+${totalDelayHours}h`} ({extensions.length} extensions)
              </span>
            </div>
          </div>
        </div>

        {/* Report Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              {error}
            </div>
          )}

          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Generating Report...
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Synthesizing completed tasks, delay reasons, daily logs, and velocity.
              </p>
            </div>
          ) : report ? (
            <div className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-xl prose-h2:text-base prose-h3:text-sm prose-p:text-xs prose-p:leading-relaxed prose-li:text-xs prose-strong:text-slate-900">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 mb-6 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Report generated for <strong className="text-indigo-600">{project.title}</strong>
                </span>
                <span className="text-slate-400">
                  {project.ai_report_generated_at ? formatDate(project.ai_report_generated_at) : 'Just now'}
                </span>
              </div>
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          ) : (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                No Report Generated
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mb-5">
                Generate an easy-to-read summary covering task schedules, extensions, reasons, and team daily logs.
              </p>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Generate Report</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {report && !isGenerating && (
          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500">
              Saved to project records.
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleDownloadReport}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .md</span>
              </button>
              <button
                onClick={handleGenerate}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
