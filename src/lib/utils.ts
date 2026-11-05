import confetti from 'canvas-confetti';

/**
 * Generates a random 4-digit project code (1000-9999).
 */
export function generate4DigitCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Generates a unique 2-digit code (10-99) for a developer in a project.
 * Uses pseudo-random distribution with fallback sequential probing for collision resistance.
 */
export function generate2DigitCode(existingCodes: string[] = []): string {
  const existingSet = new Set(existingCodes.map((c) => String(c).trim()));
  const available: string[] = [];
  
  for (let i = 10; i <= 99; i++) {
    const code = i.toString();
    if (!existingSet.has(code)) {
      available.push(code);
    }
  }

  if (available.length === 0) return '99';

  // Pick random from available slots
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

/**
 * Standard observed statutory/public holidays (MM-DD) or exact dates (YYYY-MM-DD).
 */
export const DEFAULT_OBSERVED_HOLIDAYS: string[] = [
  '01-01', // New Year's Day
  '07-04', // Independence Day
  '12-25', // Christmas Day
  '12-26', // Boxing Day
];

/**
 * Checks if a given date is an observed statutory or company holiday.
 */
export function isHoliday(date: Date | string, customHolidays: string[] = []): boolean {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mmdd = `${mm}-${dd}`;
  const yyyymmdd = `${yyyy}-${mm}-${dd}`;

  const allHolidays = [...DEFAULT_OBSERVED_HOLIDAYS, ...customHolidays];
  return allHolidays.includes(mmdd) || allHolidays.includes(yyyymmdd);
}

/**
 * Checks if a given date falls on a weekend (Saturday or Sunday).
 * Working days are strictly Monday through Friday.
 */
export function isWeekend(date: Date | string): boolean {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Checks if a given date falls on a working day (Monday to Friday, excluding observed holidays).
 */
export function isWorkingDay(date: Date | string, customHolidays: string[] = []): boolean {
  return !isWeekend(date) && !isHoliday(date, customHolidays);
}

/**
 * Adds business / working days (Monday to Friday only, skipping Saturday, Sunday, and holidays).
 */
export function addBusinessDays(
  startDate: Date | string,
  businessDays: number,
  customHolidays: string[] = []
): Date {
  const current = new Date(startDate);
  if (businessDays <= 0) return current;

  // If start date is on a weekend or holiday, advance to next valid working day first
  while (!isWorkingDay(current, customHolidays)) {
    current.setDate(current.getDate() + 1);
  }

  let added = 0;
  while (added < businessDays) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current, customHolidays)) {
      added++;
    }
  }
  return current;
}

/**
 * Counts business / working days between two dates (Monday to Friday only, excluding weekends and holidays).
 */
export function countBusinessDays(
  startDate: Date | string,
  endDate: Date | string,
  customHolidays: string[] = []
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (isWorkingDay(cur, customHolidays)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Formats a date including the day of the week (e.g. "Thu, Nov 13, 2026").
 */
export function formatDateWithWeekday(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Returns the current or given date formatted as YYYY-MM-DD in the user's LOCAL timezone
 * (preventing UTC rollover bugs where evening logs get dated tomorrow).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Unified task metadata parsing: extracts <!--dep:UUID--> and <!--pos:NUMBER--> without mutating text.
 */
export function extractTaskMetadata(description?: string | null): {
  cleanDescription: string;
  dependsOnTaskId: string | null;
  position: number | null;
} {
  if (!description) return { cleanDescription: '', dependsOnTaskId: null, position: null };

  const depMatch = description.match(/<!--dep:([a-zA-Z0-9_-]+)-->/);
  const dependsOnTaskId = depMatch ? depMatch[1] : null;

  const posMatch = description.match(/<!--pos:(-?\d+(?:\.\d+)?)-->/);
  const position = posMatch ? parseFloat(posMatch[1]) : null;

  const cleanDescription = description
    .replace(/\s*<!--dep:[a-zA-Z0-9_-]+-->\s*/g, '')
    .replace(/\s*<!--pos:-?\d+(?:\.\d+)?-->\s*/g, '')
    .trim();

  return { cleanDescription, dependsOnTaskId, position };
}

/**
 * Attaches <!--dep:UUID--> and <!--pos:NUMBER--> tags to description for zero-migration persistence.
 */
export function attachTaskMetadata(
  description: string,
  dependsOnTaskId?: string | null,
  position?: number | null
): string {
  const clean = description
    .replace(/\s*<!--dep:[a-zA-Z0-9_-]+-->\s*/g, '')
    .replace(/\s*<!--pos:-?\d+(?:\.\d+)?-->\s*/g, '')
    .trim();

  const tags: string[] = [];
  if (dependsOnTaskId) tags.push(`<!--dep:${dependsOnTaskId}-->`);
  if (position !== undefined && position !== null && !isNaN(position)) {
    tags.push(`<!--pos:${position}-->`);
  }

  if (tags.length === 0) return clean;
  return clean ? `${clean}\n${tags.join(' ')}` : tags.join(' ');
}

/**
 * Backward compatibility wrapper for dependency tag parsing.
 */
export function extractTaskDependency(description?: string | null): {
  cleanDescription: string;
  dependsOnTaskId: string | null;
} {
  const { cleanDescription, dependsOnTaskId } = extractTaskMetadata(description);
  return { cleanDescription, dependsOnTaskId };
}

/**
 * Backward compatibility wrapper for attaching dependency tag.
 */
export function attachTaskDependency(description: string, dependsOnTaskId?: string | null): string {
  return attachTaskMetadata(description, dependsOnTaskId, null);
}

/**
 * Multi-Project Developer Session Switcher interfaces and local persistence helpers.
 */
export interface SavedDevSession {
  projectId: string;
  projectCode: string;
  projectTitle: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  devCode: string;
  lastActive: string;
}

const DEV_SESSIONS_STORAGE_KEY = 'marlinetodo_dev_sessions';

export function getSavedDevSessions(): SavedDevSession[] {
  try {
    const raw = localStorage.getItem(DEV_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const list: SavedDevSession[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
  } catch (e) {
    console.error('Failed to parse saved dev sessions', e);
    return [];
  }
}

export function saveDevSession(
  session: Omit<SavedDevSession, 'lastActive'> & { lastActive?: string; memberRole?: string }
): void {
  try {
    const current = getSavedDevSessions();
    const updated: SavedDevSession = {
      ...session,
      memberRole: session.memberRole || 'Developer',
      lastActive: new Date().toISOString(),
    };
    const filtered = current.filter((s) => s.projectId !== session.projectId);
    filtered.unshift(updated);
    localStorage.setItem(DEV_SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to save dev session', e);
  }
}

export function removeSavedDevSession(projectId: string): void {
  try {
    const current = getSavedDevSessions();
    const filtered = current.filter((s) => s.projectId !== projectId);
    localStorage.setItem(DEV_SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to remove dev session', e);
  }
}

/**
 * Trigger file download directly in the browser (e.g. Markdown or Text report).
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Calculates remaining days or status description using Monday to Friday working days.
 */
export function calculateFinishTime(startDateStr: string, endDateStr: string | null, durationDays: number, status: string): {
  text: string;
  isOverdue: boolean;
  isCompleted: boolean;
  percentage: number;
} {
  if (status === 'completed') {
    return { text: 'Completed', isOverdue: false, isCompleted: true, percentage: 100 };
  }

  const start = new Date(startDateStr).getTime();
  const end = endDateStr
    ? new Date(endDateStr).getTime()
    : addBusinessDays(startDateStr, durationDays).getTime();
  const now = Date.now();

  const totalDuration = Math.max(end - start, 1000);
  const elapsed = now - start;
  const remaining = end - now;

  const percentage = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

  if (remaining < 0) {
    const overdueDays = countBusinessDays(new Date(end), new Date(now));
    return {
      text: overdueDays > 0 ? `${overdueDays} working day${overdueDays > 1 ? 's' : ''} overdue` : 'Due today',
      isOverdue: true,
      isCompleted: false,
      percentage: 100,
    };
  }

  const remainingDays = countBusinessDays(new Date(now), new Date(end));
  if (remainingDays === 0) {
    const remainingHours = Math.ceil(remaining / (60 * 60 * 1000));
    return {
      text: `${remainingHours} hour${remainingHours > 1 ? 's' : ''} left`,
      isOverdue: false,
      isCompleted: false,
      percentage,
    };
  }

  return {
    text: `${remainingDays} working day${remainingDays > 1 ? 's' : ''} left`,
    isOverdue: false,
    isCompleted: false,
    percentage,
  };
}

export interface ProjectScheduleDrift {
  baselineStart: string;
  baselineEnd: string;
  projectedEnd: string;
  driftDays: number;
  driftHours: number;
  hasDrift: boolean;
  statusText: string;
  isOverdue: boolean;
  isCompleted: boolean;
  percentage: number;
  totalTaskDelayDays: number;
  totalTaskDelayHours: number;
  cascadingTasksCount: number;
}

/**
 * Propagate task delays and critical-path dependency chains to calculate Project Schedule Drift
 * based strictly on Monday through Friday working days.
 */
export function calculateProjectScheduleDrift(
  project: { start_date: string; end_date: string | null; duration_days: number; status: string },
  tasks: Array<{
    id?: string;
    due_date: string | null;
    total_delay_days?: number;
    total_delay_hours?: number;
    duration_hours?: number;
    status: string;
    depends_on_task_id?: string | null;
  }> = []
): ProjectScheduleDrift {
  const startMs = new Date(project.start_date).getTime();
  const baselineEndMs = project.end_date
    ? new Date(project.end_date).getTime()
    : addBusinessDays(project.start_date, project.duration_days).getTime();

  const totalTaskDelayDays = tasks.reduce((acc, t) => acc + (Number(t.total_delay_days) || 0), 0);
  const totalTaskDelayHours = tasks.reduce((acc, t) => acc + (Number(t.total_delay_hours) || 0), 0);

  if (project.status === 'completed') {
    return {
      baselineStart: project.start_date,
      baselineEnd: new Date(baselineEndMs).toISOString(),
      projectedEnd: new Date(baselineEndMs).toISOString(),
      driftDays: 0,
      driftHours: 0,
      hasDrift: false,
      statusText: 'Delivered',
      isOverdue: false,
      isCompleted: true,
      percentage: 100,
      totalTaskDelayDays,
      totalTaskDelayHours,
      cascadingTasksCount: 0,
    };
  }

  // Build task map for dependency traversal
  const taskMap = new Map<string, typeof tasks[0]>();
  tasks.forEach((t) => {
    if (t.id) taskMap.set(t.id, t);
  });

  // Calculate effective end date per task considering dependency chains
  let cascadingTasksCount = 0;

  const getEffectiveEndMs = (t: typeof tasks[0], visited = new Set<string>()): number => {
    if (t.id && visited.has(t.id)) return t.due_date ? new Date(t.due_date).getTime() : baselineEndMs;
    if (t.id) visited.add(t.id);

    const baseDueMs = t.due_date ? new Date(t.due_date).getTime() : baselineEndMs;
    const taskWorkingDays = Math.max(1, Math.ceil((Number(t.duration_hours) || 8) / 8));

    if (t.depends_on_task_id && taskMap.has(t.depends_on_task_id)) {
      const parentTask = taskMap.get(t.depends_on_task_id)!;
      const parentEndMs = getEffectiveEndMs(parentTask, visited);
      const minStartFromParent = parentEndMs;
      const requiredFinish = addBusinessDays(new Date(minStartFromParent), taskWorkingDays).getTime();

      if (requiredFinish > baseDueMs) {
        cascadingTasksCount++;
        return requiredFinish;
      }
    }

    return baseDueMs;
  };

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  let maxTaskDueMs = 0;

  for (const t of activeTasks) {
    const effectiveEndMs = getEffectiveEndMs(t);
    if (effectiveEndMs > maxTaskDueMs) {
      maxTaskDueMs = effectiveEndMs;
    }
  }

  // Maximum delay requested on any single task
  const maxSingleTaskDelayDays = tasks.reduce((max, t) => {
    const d = Number(t.total_delay_days) || (Number(t.total_delay_hours) || 0) / 8;
    return d > max ? d : max;
  }, 0);

  let projectedEndMs = baselineEndMs;

  if (maxTaskDueMs > baselineEndMs) {
    projectedEndMs = maxTaskDueMs;
  } else if (maxSingleTaskDelayDays > 0) {
    projectedEndMs = addBusinessDays(new Date(baselineEndMs), maxSingleTaskDelayDays).getTime();
  }

  // Drift in Monday-to-Friday working days
  const driftDays = countBusinessDays(new Date(baselineEndMs), new Date(projectedEndMs));
  const driftHours = driftDays * 8;

  const now = Date.now();
  const totalDuration = Math.max(projectedEndMs - startMs, 1000);
  const elapsed = Math.max(0, now - startMs);
  const percentage = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

  const remaining = projectedEndMs - now;
  const isOverdue = remaining < 0;

  let statusText = '';
  if (isOverdue) {
    const overdueDays = countBusinessDays(new Date(projectedEndMs), new Date(now));
    statusText = overdueDays > 0 ? `${overdueDays} working day${overdueDays > 1 ? 's' : ''} overdue` : 'Due today';
  } else {
    const remainingDays = countBusinessDays(new Date(now), new Date(projectedEndMs));
    statusText = `${remainingDays} working day${remainingDays > 1 ? 's' : ''} left`;
  }

  return {
    baselineStart: project.start_date,
    baselineEnd: new Date(baselineEndMs).toISOString(),
    projectedEnd: new Date(projectedEndMs).toISOString(),
    driftDays,
    driftHours,
    hasDrift: driftDays > 0,
    statusText,
    isOverdue,
    isCompleted: false,
    percentage,
    totalTaskDelayDays,
    totalTaskDelayHours,
    cascadingTasksCount,
  };
}

/**
 * Consistent avatar background color based on string input.
 */
const AVATAR_COLORS = [
  '#2563EB', // Blue
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#DB2777', // Pink
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

/**
 * Trigger celebratory confetti.
 */
export function triggerCelebration() {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
    colors: ['#3b82f6', '#10b981', '#6366f1', '#f59e0b'],
  });
}

/**
 * Format date nicely.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
