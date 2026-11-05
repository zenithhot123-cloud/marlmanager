import React, { useState } from 'react';
import type { Task } from '../lib/types';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onConfirmDelete: (taskId: string) => Promise<void> | void;
}

export const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !task) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(task.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full border border-rose-200 shadow-2xl p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-3">
          <Trash2 className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-slate-900 mb-1">
          Delete Task?
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Are you sure you want to delete <strong className="text-slate-800">"{task.title}"</strong>? This action cannot be undone.
        </p>

        <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-left text-xs text-rose-800 flex items-start space-x-2 mb-5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="text-[11px] leading-relaxed">
            Deleting this task will permanently remove its schedule estimate, assigned history, and logged extensions.
          </span>
        </div>

        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
