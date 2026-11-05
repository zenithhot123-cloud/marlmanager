import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import type {
  Project,
  Task,
  TeamMember,
  DailyLog,
  TaskExtension,
  UserRole,
  JoinedSession,
  AdminSession,
  TaskStatus,
  TaskPriority,
} from './lib/types';
import { Navbar } from './components/Navbar';
import { AdminLoginView } from './views/AdminLoginView';
import { AdminDashboard } from './views/AdminDashboard';
import { AdminProjectDetail } from './views/AdminProjectDetail';
import { DevJoinModal } from './components/DevJoinModal';
import { DevDashboard } from './views/DevDashboard';
import { CreateProjectModal } from './components/CreateProjectModal';
import { TaskModal } from './components/TaskModal';
import { ExtendTaskModal } from './components/ExtendTaskModal';
import { DeleteProjectModal } from './components/DeleteProjectModal';
import { AiReportModal } from './components/AiReportModal';
import {
  extractTaskMetadata,
  attachTaskMetadata,
  addBusinessDays,
  getLocalDateString,
  saveDevSession,
  removeSavedDevSession,
} from './lib/utils';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [devSession, setDevSession] = useState<JoinedSession | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [extensions, setExtensions] = useState<TaskExtension[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin selected project navigation
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Modals state
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [preselectedMemberId, setPreselectedMemberId] = useState<string | undefined>(undefined);
  const [taskToExtend, setTaskToExtend] = useState<Task | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [aiReportProject, setAiReportProject] = useState<Project | null>(null);

  // 1. Load sessions from localStorage
  useEffect(() => {
    try {
      const savedAdmin = localStorage.getItem('marlinetodo_admin_session');
      if (savedAdmin) {
        setAdminSession(JSON.parse(savedAdmin));
      }
    } catch (e) {
      console.error('Failed to parse admin session', e);
    }

    try {
      const savedDev = localStorage.getItem('marlinetodo_dev_session');
      if (savedDev) {
        setDevSession(JSON.parse(savedDev));
      }
    } catch (e) {
      console.error('Failed to parse dev session', e);
    }
  }, []);

  // Helper: deserialize task metadata (extracting prerequisite dependency and rank position from description)
  const deserializeTask = useCallback((raw: Record<string, unknown>): Task => {
    const rawDesc = typeof raw.description === 'string' ? raw.description : '';
    const { cleanDescription, dependsOnTaskId, position } = extractTaskMetadata(rawDesc);
    return {
      ...(raw as unknown as Task),
      description: cleanDescription,
      depends_on_task_id: dependsOnTaskId,
      position: position !== null && position !== undefined ? position : undefined,
    };
  }, []);

  // 2. Fetch all data from Supabase (with bounded limits to prevent unconstrained memory growth)
  const fetchData = useCallback(async () => {
    try {
      const [
        { data: pData, error: pErr },
        { data: tData, error: tErr },
        { data: mData, error: mErr },
        { data: lData, error: lErr },
        { data: eData, error: eErr },
      ] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('team_members').select('*').order('joined_at', { ascending: false }).limit(500),
        supabase.from('daily_logs').select('*').order('log_date', { ascending: false }).limit(1000),
        supabase.from('task_extensions').select('*').order('created_at', { ascending: false }).limit(1000),
      ]);

      if (pErr) throw pErr;
      if (tErr) throw tErr;
      if (mErr) throw mErr;
      if (lErr) throw lErr;
      if (eErr && eErr.code !== '42P01') throw eErr;

      setProjects(pData || []);
      setTasks((tData || []).map(deserializeTask));
      setTeamMembers(mData || []);
      setDailyLogs(lData || []);
      setExtensions(eData || []);
    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, [deserializeTask]);

  useEffect(() => {
    fetchData();

    // Setup Supabase Realtime channel with high-efficiency in-memory delta updates
    const channel = supabase
      .channel('marlinetodo_realtime_v3')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = deserializeTask(payload.new as Record<string, unknown>);
            setTasks((prev) => {
              if (prev.some((t) => t.id === newTask.id)) {
                return prev.map((t) => (t.id === newTask.id ? newTask : t));
              }
              return [newTask, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = deserializeTask(payload.new as Record<string, unknown>);
            setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) {
              setTasks((prev) => prev.filter((t) => t.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProj = payload.new as Project;
            setProjects((prev) => {
              if (prev.some((p) => p.id === newProj.id)) {
                return prev.map((p) => (p.id === newProj.id ? newProj : p));
              }
              return [newProj, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedProj = payload.new as Project;
            setProjects((prev) => prev.map((p) => (p.id === updatedProj.id ? updatedProj : p)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) {
              setProjects((prev) => prev.filter((p) => p.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMember = payload.new as TeamMember;
            setTeamMembers((prev) => {
              if (prev.some((m) => m.id === newMember.id)) {
                return prev.map((m) => (m.id === newMember.id ? newMember : m));
              }
              return [newMember, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedMember = payload.new as TeamMember;
            setTeamMembers((prev) =>
              prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
            );
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) {
              setTeamMembers((prev) => prev.filter((m) => m.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLog = payload.new as DailyLog;
            setDailyLogs((prev) => {
              if (prev.some((l) => l.id === newLog.id)) {
                return prev.map((l) => (l.id === newLog.id ? newLog : l));
              }
              return [newLog, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedLog = payload.new as DailyLog;
            setDailyLogs((prev) => prev.map((l) => (l.id === updatedLog.id ? updatedLog : l)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) {
              setDailyLogs((prev) => prev.filter((l) => l.id !== oldId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_extensions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newExt = payload.new as TaskExtension;
            setExtensions((prev) => {
              if (prev.some((e) => e.id === newExt.id)) {
                return prev.map((e) => (e.id === newExt.id ? newExt : e));
              }
              return [newExt, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedExt = payload.new as TaskExtension;
            setExtensions((prev) => prev.map((e) => (e.id === updatedExt.id ? updatedExt : e)));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) {
              setExtensions((prev) => prev.filter((e) => e.id !== oldId));
            }
          }
        }
      )
      .subscribe();

    // Reconnect and wake-up resynchronization listener (e.g. laptop wake-up in morning, Wi-Fi reconnect)
    const handleWakeSync = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    window.addEventListener('online', handleWakeSync);
    window.addEventListener('focus', handleWakeSync);
    document.addEventListener('visibilitychange', handleWakeSync);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleWakeSync);
      window.removeEventListener('focus', handleWakeSync);
      document.removeEventListener('visibilitychange', handleWakeSync);
    };
  }, [fetchData, deserializeTask]);

  // Handler: Create Project with explicit Start & End Dates
  const handleCreateProject = async (projectData: {
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
      priority: TaskPriority;
    }>;
  }) => {
    const { data: newProjects, error: pErr } = await supabase
      .from('projects')
      .insert({
        title: projectData.title,
        description: projectData.description,
        duration_days: projectData.duration_days,
        target_hours: projectData.target_hours,
        code: projectData.code,
        start_date: projectData.start_date,
        end_date: projectData.end_date,
        status: 'active',
        manager_name: adminSession?.name || 'Project Manager',
      })
      .select();

    if (pErr) throw pErr;

    const newProject = newProjects[0];

    // If initial tasks suggested by Gemini exist, insert them
    if (projectData.initialTasks && projectData.initialTasks.length > 0) {
      const taskInserts = projectData.initialTasks.map((t) => ({
        project_id: newProject.id,
        title: t.title,
        description: t.description,
        duration_hours: t.duration_hours,
        priority: t.priority,
        status: 'todo',
      }));

      await supabase.from('tasks').insert(taskInserts);
    }

    await fetchData();
    setSelectedProjectId(newProject.id);
  };

  // Handler: Save Task (Create or Edit)
  const handleSaveTask = async (taskData: {
    id?: string;
    title: string;
    description: string;
    assignee_id: string | null;
    duration_hours: number;
    due_date: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    depends_on_task_id?: string | null;
  }) => {
    if (!selectedProjectId) return;

    // Preserve existing task position if editing
    const existingPosition = taskData.id
      ? tasks.find((t) => t.id === taskData.id)?.position ?? null
      : null;

    // Attach dependency and rank position metadata into description
    const serializedDescription = attachTaskMetadata(
      taskData.description,
      taskData.depends_on_task_id,
      existingPosition
    );

    if (taskData.id) {
      // Edit
      const { error } = await supabase
        .from('tasks')
        .update({
          title: taskData.title,
          description: serializedDescription,
          assignee_id: taskData.assignee_id,
          duration_hours: taskData.duration_hours,
          due_date: taskData.due_date,
          priority: taskData.priority,
          status: taskData.status,
          completed_at: taskData.status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskData.id);

      if (error) throw error;
    } else {
      // Create new
      const { error } = await supabase.from('tasks').insert({
        project_id: selectedProjectId,
        title: taskData.title,
        description: serializedDescription,
        assignee_id: taskData.assignee_id,
        duration_hours: taskData.duration_hours,
        due_date: taskData.due_date,
        priority: taskData.priority,
        status: taskData.status,
      });

      if (error) throw error;
    }

    await fetchData();
  };

  // Handler: Extend Task Time (Supports Days or Hours with Business Days & Cascading Delays)
  const handleExtendTask = async (
    taskId: string,
    hours: number,
    days: number,
    unit: 'hours' | 'days',
    reason: string,
    calculatedNewDueDate?: string | null
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const memberId =
      currentRole === 'dev' && devSession && devSession.projectId === task.project_id
        ? devSession.memberId
        : (task.assignee_id || null);

    // 1. Insert record into task_extensions
    const { error: extErr } = await supabase.from('task_extensions').insert({
      task_id: taskId,
      project_id: task.project_id,
      member_id: memberId,
      unit: unit,
      extended_hours: hours,
      extended_days: days,
      reason: reason,
    });

    if (extErr) throw extErr;

    // 2. Update tasks total_delay_hours, total_delay_days, delay_count and shift deadline
    const currentDelayHours = Number(task.total_delay_hours) || 0;
    const currentDelayDays = Number(task.total_delay_days) || 0;
    const currentCount = Number(task.delay_count) || 0;

    let targetDueDate: string | null = null;
    if (calculatedNewDueDate) {
      targetDueDate = calculatedNewDueDate;
    } else if (task.due_date) {
      const addedMs = unit === 'days'
        ? days * 24 * 60 * 60 * 1000
        : hours * 60 * 60 * 1000;
      targetDueDate = new Date(new Date(task.due_date).getTime() + addedMs).toISOString();
    }

    const updatePayload: Record<string, unknown> = {
      total_delay_hours: currentDelayHours + hours,
      total_delay_days: currentDelayDays + days,
      delay_count: currentCount + 1,
      updated_at: new Date().toISOString(),
    };

    if (targetDueDate) {
      updatePayload.due_date = targetDueDate;
    }

    const { error: taskErr } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId);

    if (taskErr) throw taskErr;

    // 3. Multi-tier transitive cascading: propagate downstream using BFS queue with cycle safety
    if (targetDueDate) {
      interface CascadeQueueItem {
        upstreamTaskId: string;
        upstreamDueDateStr: string;
      }

      const queue: CascadeQueueItem[] = [
        { upstreamTaskId: taskId, upstreamDueDateStr: targetDueDate },
      ];
      const visited = new Set<string>([taskId]);

      while (queue.length > 0) {
        const { upstreamTaskId, upstreamDueDateStr } = queue.shift()!;
        const parentDueMs = new Date(upstreamDueDateStr).getTime();

        const directChildren = tasks.filter(
          (t) =>
            t.project_id === task.project_id &&
            t.depends_on_task_id === upstreamTaskId &&
            t.status !== 'completed' &&
            !visited.has(t.id)
        );

        for (const child of directChildren) {
          visited.add(child.id);
          const childCurrentDueMs = child.due_date ? new Date(child.due_date).getTime() : 0;

          if (childCurrentDueMs <= parentDueMs) {
            const childWorkDays = Math.max(1, Math.ceil((Number(child.duration_hours) || 8) / 8));
            const childNewDueDateObj = addBusinessDays(upstreamDueDateStr, childWorkDays);
            const childNewDueDateStr = childNewDueDateObj.toISOString();

            const childDelayDays = Number(child.total_delay_days) || 0;
            const childCount = Number(child.delay_count) || 0;

            await supabase
              .from('tasks')
              .update({
                due_date: childNewDueDateStr,
                total_delay_days: childDelayDays + Math.max(1, days),
                delay_count: childCount + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', child.id);

            // Enqueue this child so its downstream dependents cascade as well
            queue.push({
              upstreamTaskId: child.id,
              upstreamDueDateStr: childNewDueDateStr,
            });
          }
        }
      }
    }

    await fetchData();
  };

  // Handler: Update Task Status
  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
            }
          : t
      )
    );

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) {
      console.error('Failed to update task status:', error);
      fetchData();
    }
  };

  // Handler: Reorder Task (In-Column Rank Ordering & Cross-Column Drag with Metadata Persistence)
  const handleReorderTask = async (
    taskId: string,
    newStatus: TaskStatus,
    newPosition: number
  ) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              position: newPosition,
              completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
            }
          : t
      )
    );

    const targetTask = tasks.find((t) => t.id === taskId);
    const desc = targetTask?.description || '';
    const depId = targetTask?.depends_on_task_id || null;
    const serializedDescription = attachTaskMetadata(desc, depId, newPosition);

    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        description: serializedDescription,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) {
      console.error('Failed to reorder task:', error);
      fetchData();
    }
  };

  // Handler: Delete Task
  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      console.error('Failed to delete task:', error);
      fetchData();
    }
  };

  // Handler: Toggle Project Complete
  const handleToggleProjectComplete = async (project: Project) => {
    const isCurrentlyComplete = project.status === 'completed';
    const nextStatus = isCurrentlyComplete ? 'active' : 'completed';
    const completedAt = isCurrentlyComplete ? null : new Date().toISOString();

    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? { ...p, status: nextStatus, completed_at: completedAt } : p
      )
    );

    const { error } = await supabase
      .from('projects')
      .update({
        status: nextStatus,
        completed_at: completedAt,
      })
      .eq('id', project.id);

    if (error) {
      console.error('Failed to update project status:', error);
      fetchData();
    }
  };

  // Handler: Delete Project permanently with programmatic cascading multi-table cleanup
  const handleDeleteProject = async (projectId: string) => {
    // 1. Gather all tasks belonging to this project
    const projectTaskIds = tasks.filter((t) => t.project_id === projectId).map((t) => t.id);

    // 2. Cascade cleanup task_extensions
    if (projectTaskIds.length > 0) {
      await supabase.from('task_extensions').delete().in('task_id', projectTaskIds);
    }
    await supabase.from('task_extensions').delete().eq('project_id', projectId);

    // 3. Cascade cleanup daily_logs
    await supabase.from('daily_logs').delete().eq('project_id', projectId);

    // 4. Cascade cleanup tasks
    await supabase.from('tasks').delete().eq('project_id', projectId);

    // 5. Cascade cleanup team_members
    await supabase.from('team_members').delete().eq('project_id', projectId);

    // 6. Cascade cleanup project_reports
    await supabase.from('project_reports').delete().eq('project_id', projectId);

    // 7. Delete project itself
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;

    // 8. Clean up saved developer sessions
    removeSavedDevSession(projectId);

    // Reset views
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
    }
    if (devSession?.projectId === projectId) {
      localStorage.removeItem('marlinetodo_dev_session');
      setDevSession(null);
    }
    await fetchData();
  };

  // Handler: Save 1-Line Daily Summary
  const handleSaveOneLiner = async (projectId: string, oneLiner: string) => {
    const today = getLocalDateString();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, daily_one_liner: oneLiner, daily_one_liner_date: today } : p
      )
    );

    await supabase
      .from('projects')
      .update({
        daily_one_liner: oneLiner,
        daily_one_liner_date: today,
      })
      .eq('id', projectId);
  };

  // Handler: Save Gemini AI Report
  const handleSaveReport = async (reportContent: string) => {
    if (!aiReportProject) return;

    const timestamp = new Date().toISOString();

    setProjects((prev) =>
      prev.map((p) =>
        p.id === aiReportProject.id
          ? { ...p, ai_report: reportContent, ai_report_generated_at: timestamp }
          : p
      )
    );

    await supabase
      .from('projects')
      .update({
        ai_report: reportContent,
        ai_report_generated_at: timestamp,
      })
      .eq('id', aiReportProject.id);

    await supabase.from('project_reports').insert({
        project_id: aiReportProject.id,
        report_type: 'completion',
        content: reportContent,
        model_used: 'gemini-3.1-flash-lite',
      });
  };

  // Handler: Submit Daily Log (Upserts by member_id + log_date to prevent duplicate double-counting)
  const handleSubmitDailyLog = async (logData: {
    log_date: string;
    content: string;
    blockers: string | null;
    hours_spent: number;
    tasks_completed_summary: string | null;
  }) => {
    if (!devSession) return;

    // Check if a log already exists for this developer on this date
    const existingLog = dailyLogs.find(
      (l) =>
        l.project_id === devSession.projectId &&
        l.member_id === devSession.memberId &&
        l.log_date === logData.log_date
    );

    if (existingLog) {
      const { error } = await supabase
        .from('daily_logs')
        .update({
          content: logData.content,
          blockers: logData.blockers,
          hours_spent: logData.hours_spent,
          tasks_completed_summary: logData.tasks_completed_summary,
        })
        .eq('id', existingLog.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from('daily_logs').insert({
        project_id: devSession.projectId,
        member_id: devSession.memberId,
        log_date: logData.log_date,
        content: logData.content,
        blockers: logData.blockers,
        hours_spent: logData.hours_spent,
        tasks_completed_summary: logData.tasks_completed_summary,
      });

      if (error) throw error;
    }

    await fetchData();
  };

  // Handler: Dev joins project
  const handleDevJoinSuccess = (session: JoinedSession) => {
    localStorage.setItem('marlinetodo_dev_session', JSON.stringify(session));
    saveDevSession(session);
    setDevSession(session);
    setCurrentRole('dev');
    fetchData();
  };

  // Handler: Dev switches workspace / project in 1-click
  const handleDevSwitchProject = (session: JoinedSession) => {
    localStorage.setItem('marlinetodo_dev_session', JSON.stringify(session));
    saveDevSession(session);
    setDevSession(session);
    setCurrentRole('dev');
    fetchData();
  };

  // Handler: Dev leaves/switches project
  const handleDevLeaveProject = () => {
    localStorage.removeItem('marlinetodo_dev_session');
    setDevSession(null);
  };

  // Handler: Admin Sign Out
  const handleAdminSignOut = () => {
    localStorage.removeItem('marlinetodo_admin_session');
    setAdminSession(null);
    setSelectedProjectId(null);
  };

  // Build task list with attached extensions & resolved dependency titles
  const enrichedTasks = tasks.map((t) => ({
    ...t,
    extensions: extensions.filter((e) => e.task_id === t.id),
    depends_on_task_title: t.depends_on_task_id
      ? tasks.find((other) => other.id === t.depends_on_task_id)?.title
      : null,
  }));

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const devProject = devSession
    ? projects.find((p) => p.id === devSession.projectId) || null
    : null;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={(role) => setCurrentRole(role)}
        adminSession={adminSession}
        onAdminSignOut={handleAdminSignOut}
        devSession={devSession}
        onDevLeaveProject={handleDevLeaveProject}
        onDevSwitchProject={handleDevSwitchProject}
        activeProjectTitle={
          currentRole === 'admin'
            ? selectedProject?.title
            : devProject?.title
        }
        onNavigateHome={() => setSelectedProjectId(null)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
              Connecting to Supabase...
            </p>
          </div>
        ) : currentRole === 'admin' ? (
          /* ================= ADMIN INTERFACE ================= */
          !adminSession ? (
            /* Protected Admin Login Gate */
            <AdminLoginView
              onLoginSuccess={(session) => setAdminSession(session)}
              onSwitchToDev={() => setCurrentRole('dev')}
            />
          ) : selectedProject ? (
            /* Project Workspace */
            <AdminProjectDetail
              project={selectedProject}
              tasks={enrichedTasks}
              teamMembers={teamMembers}
              dailyLogs={dailyLogs}
              extensions={extensions}
              onBack={() => setSelectedProjectId(null)}
              onOpenTaskModal={(task, memberId) => {
                setTaskToEdit(task || null);
                setPreselectedMemberId(memberId);
                setIsTaskModalOpen(true);
              }}
              onOpenAiReport={(proj) => setAiReportProject(proj)}
              onOpenExtendModal={(task) => setTaskToExtend(task)}
              onOpenDeleteModal={(proj) => setProjectToDelete(proj)}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onReorderTask={handleReorderTask}
              onDeleteTask={handleDeleteTask}
              onToggleProjectComplete={handleToggleProjectComplete}
              onSaveOneLiner={handleSaveOneLiner}
            />
          ) : (
            /* Admin Projects Dashboard */
            <AdminDashboard
              projects={projects}
              tasks={enrichedTasks}
              teamMembers={teamMembers}
              onOpenCreateModal={() => setIsCreateProjectOpen(true)}
              onOpenProject={(proj) => setSelectedProjectId(proj.id)}
              onOpenAiReport={(proj) => setAiReportProject(proj)}
            />
          )
        ) : (
          /* ================= DEVELOPER INTERFACE ================= */
          devSession && devProject ? (
            <DevDashboard
              session={devSession}
              project={devProject}
              tasks={enrichedTasks.filter((t) => t.project_id === devProject.id)}
              teamMembers={teamMembers.filter((m) => m.project_id === devProject.id)}
              dailyLogs={dailyLogs.filter((l) => l.project_id === devProject.id)}
              extensions={extensions.filter((e) => e.project_id === devProject.id)}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onOpenExtendModal={(task) => setTaskToExtend(task)}
              onSubmitDailyLog={handleSubmitDailyLog}
              onLeaveProject={handleDevLeaveProject}
              onSwitchProject={handleDevSwitchProject}
            />
          ) : (
            <DevJoinModal
              onJoinSuccess={handleDevJoinSuccess}
              availableProjects={projects.filter((p) => p.status === 'active')}
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-5 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-slate-600">MarlineTodo</span>
          <span>Simple project scheduling & daily team updates</span>
        </div>
      </footer>

      {/* Global Modals */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
          setPreselectedMemberId(undefined);
        }}
        taskToEdit={taskToEdit}
        initialAssigneeId={preselectedMemberId}
        teamMembers={
          selectedProject
            ? teamMembers.filter((m) => m.project_id === selectedProject.id)
            : []
        }
        availableTasks={
          selectedProject
            ? tasks.filter((t) => t.project_id === selectedProject.id)
            : []
        }
        onSave={handleSaveTask}
      />

      {taskToExtend && (
        <ExtendTaskModal
          isOpen={!!taskToExtend}
          onClose={() => setTaskToExtend(null)}
          task={taskToExtend}
          onExtend={handleExtendTask}
        />
      )}

      {projectToDelete && (
        <DeleteProjectModal
          isOpen={!!projectToDelete}
          onClose={() => setProjectToDelete(null)}
          project={projectToDelete}
          onConfirmDelete={handleDeleteProject}
        />
      )}

      {aiReportProject && (
        <AiReportModal
          isOpen={!!aiReportProject}
          onClose={() => setAiReportProject(null)}
          project={aiReportProject}
          teamMembers={teamMembers.filter((m) => m.project_id === aiReportProject.id)}
          tasks={enrichedTasks.filter((t) => t.project_id === aiReportProject.id)}
          dailyLogs={dailyLogs.filter((l) => l.project_id === aiReportProject.id)}
          extensions={extensions.filter((e) => e.project_id === aiReportProject.id)}
          onSaveReport={handleSaveReport}
        />
      )}
    </div>
  );
};

export default App;
