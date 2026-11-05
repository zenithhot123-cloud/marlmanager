import React, { useState } from 'react';
import type { Project } from '../lib/types';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onConfirmDelete: (projectId: string) => Promise<void>;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirmDelete(project.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project';
      setError(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-rose-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
            <Trash2 className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Delete Project Permanently?
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            You are about to delete <strong className="text-slate-800 font-semibold">{project.title}</strong> (PIN #{project.code}).
          </p>

          <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/80 text-left text-xs text-rose-800 space-y-1 mb-6">
            <div className="flex items-center space-x-1.5 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Irreversible Action</span>
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              This will permanently delete this project and all its assigned tasks, developer memberships,
              daily work logs, and generated reports.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-2.5 bg-rose-100 rounded-lg text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Project</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
