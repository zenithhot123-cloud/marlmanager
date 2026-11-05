import React, { useState } from 'react';
import type { Project, Task, TeamMember } from '../lib/types';
import { ProjectCard } from '../components/ProjectCard';
import {
  Plus,
  Search,
  Layers,
} from 'lucide-react';

interface AdminDashboardProps {
  projects: Project[];
  tasks: Task[];
  teamMembers: TeamMember[];
  onOpenCreateModal: () => void;
  onOpenProject: (project: Project) => void;
  onOpenAiReport: (project: Project) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  projects,
  tasks,
  teamMembers,
  onOpenCreateModal,
  onOpenProject,
  onOpenAiReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.includes(searchQuery) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ? true : p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Global KPIs
  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const completedProjectsCount = projects.filter((p) => p.status === 'completed').length;
  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasksCount > 0
    ? Math.round((completedTasksCount / totalTasksCount) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Projects
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of project delivery timelines and developer assignments.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Projects */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Projects</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl font-bold text-slate-900">{projects.length}</span>
            <span className="text-xs text-slate-500">({activeProjectsCount} active)</span>
          </div>
        </div>

        {/* Completed Projects */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">Delivered</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl font-bold text-emerald-600">{completedProjectsCount}</span>
            <span className="text-xs text-slate-500">completed</span>
          </div>
        </div>

        {/* Task Velocity */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">Tasks Done</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl font-bold text-slate-900">{completionRate}%</span>
            <span className="text-xs text-slate-500">({completedTasksCount}/{totalTasksCount})</span>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1">Team</span>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xl font-bold text-slate-900">{teamMembers.length}</span>
            <span className="text-xs text-slate-500">developers</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-xs font-medium text-slate-900 bg-white placeholder:text-slate-400"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto text-xs">
          {(['all', 'active', 'completed'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-semibold capitalize transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              tasks={tasks}
              teamMembers={teamMembers}
              onOpenProject={onOpenProject}
              onOpenAiReport={onOpenAiReport}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {searchQuery ? 'No matching projects found' : 'No projects yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            {searchQuery
              ? 'Try adjusting your search criteria or filter.'
              : 'Create your first project to automatically get a 4-digit code for your dev team to join.'}
          </p>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Project</span>
          </button>
        </div>
      )}
    </div>
  );
};
