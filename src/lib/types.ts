export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  code: string; // 4-digit project code e.g. "4829"
  title: string;
  description: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string | null;
  duration_days: number;
  target_hours: number;
  created_at: string;
  completed_at: string | null;
  manager_name: string;
  ai_report: string | null;
  ai_report_generated_at: string | null;
  daily_one_liner: string | null;
  daily_one_liner_date: string | null;
}

export interface TeamMember {
  id: string;
  project_id: string;
  dev_code: string; // Unique 2-digit code e.g. "10", "42"
  name: string;
  role: string;
  email: string | null;
  joined_at: string;
  avatar_color: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskExtension {
  id: string;
  task_id: string;
  project_id: string;
  member_id: string | null;
  unit: 'hours' | 'days';
  extended_hours: number;
  extended_days: number;
  reason: string;
  created_at: string;
  member?: TeamMember;
}

export interface Task {
  id: string;
  project_id: string;
  assignee_id: string | null;
  depends_on_task_id?: string | null;
  depends_on_task_title?: string | null;
  position?: number;
  title: string;
  description: string;
  duration_hours: number;
  total_delay_hours: number;
  total_delay_days: number;
  delay_count: number;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  assignee?: TeamMember;
  extensions?: TaskExtension[];
}

export interface DailyLog {
  id: string;
  project_id: string;
  member_id: string;
  log_date: string;
  content: string;
  blockers: string | null;
  hours_spent: number;
  tasks_completed_summary: string | null;
  created_at: string;
  member?: TeamMember;
}

export interface ProjectReport {
  id: string;
  project_id: string;
  report_type: 'completion' | 'interim' | 'standup_summary';
  content: string;
  model_used: string;
  generated_at: string;
}

export type UserRole = 'admin' | 'dev';

export interface JoinedSession {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  devCode: string; // Personal 2-digit code
}

export interface AdminSession {
  email: string;
  name: string;
  role: string;
  loggedInAt: string;
}
