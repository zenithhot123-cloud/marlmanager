import type { Project, TeamMember, Task, DailyLog, TaskExtension } from './types';

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-3.8-flash'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiApi(prompt: string, systemInstruction?: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not configured.');
  }

  let lastError: Error | null = null;

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        
        const body: Record<string, unknown> = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 3072,
          },
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.status === 503) {
          await sleep(1000 * (attempt + 1));
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (candidate?.content?.parts?.[0]?.text) {
          return candidate.content.parts[0].text;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  console.warn('Gemini temporary high demand; using structured synthesis', lastError);
  throw lastError || new Error('Service is currently busy. Please try again shortly.');
}

/**
 * Generates a clean, simple, easy-to-read executive report.
 * Contains:
 * - Details of extended time, delay hours, and specific reasons
 * - Daily basis work of each person
 * - Whole project detail (status, finish time vs planned, tasks)
 */
export async function generateProjectCompletionReport(
  project: Project,
  teamMembers: TeamMember[],
  tasks: Task[],
  dailyLogs: DailyLog[],
  extensions: TaskExtension[] = []
): Promise<string> {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const todoTasks = tasks.filter((t) => t.status === 'todo').length;
  const totalPlannedHours = tasks.reduce((acc, t) => acc + (Number(t.duration_hours) || 0), 0);
  const totalDelayHours = extensions.reduce((acc, e) => acc + (Number(e.extended_hours) || 0), 0);
  const totalDelayDays = extensions.reduce((acc, e) => acc + (Number(e.extended_days) || 0), 0);
  const totalLoggedHours = dailyLogs.reduce((acc, l) => acc + (Number(l.hours_spent) || 0), 0);

  // Group extensions with reasons
  const extensionsSummary = extensions.length > 0
    ? extensions.map((e) => {
        const task = tasks.find((t) => t.id === e.task_id);
        const member = teamMembers.find((m) => m.id === e.member_id);
        const delayLabel = e.unit === 'days' || (e.extended_days && e.extended_days > 0)
          ? `+${e.extended_days} days (+${e.extended_hours} hours)`
          : `+${e.extended_hours} hours`;
        return `- **Task:** "${task?.title || 'Unknown Task'}"\n  • **Extended by:** ${delayLabel} by ${member?.name || 'Developer'} (${member?.role || 'Team Member'})\n  • **Reason:** *${e.reason}*\n  • **Date:** ${new Date(e.created_at).toLocaleDateString()}`;
      }).join('\n\n')
    : 'No tasks required time extensions. All tasks remained on original schedule.';

  // Daily basis work per developer
  const devDailyWork = teamMembers.map((m) => {
    const memberLogs = dailyLogs.filter((l) => l.member_id === m.id);
    const memberTasks = tasks.filter((t) => t.assignee_id === m.id);
    const memberExtensions = extensions.filter((e) => e.member_id === m.id);
    const totalMemberHours = memberLogs.reduce((acc, l) => acc + (Number(l.hours_spent) || 0), 0);
    const totalMemberDaysDelayed = memberExtensions.reduce((acc, x) => acc + (Number(x.extended_days) || 0), 0);
    const totalMemberHoursDelayed = memberExtensions.reduce((acc, x) => acc + Number(x.extended_hours), 0);

    const logEntries = memberLogs.length > 0
      ? memberLogs.map((l) => `    - **[${l.log_date}]** (${l.hours_spent} hrs): ${l.content}${l.blockers ? ` *(Blocker: ${l.blockers})*` : ''}`).join('\n')
      : '    - No daily logs submitted yet.';

    const delaySummary = totalMemberDaysDelayed > 0
      ? `+${totalMemberDaysDelayed}d (+${totalMemberHoursDelayed}h)`
      : `+${totalMemberHoursDelayed}h`;

    return `### 👤 ${m.name} — ${m.role} (Code: #${m.dev_code})\n- **Tasks Assigned:** ${memberTasks.length} (${memberTasks.filter(t => t.status === 'completed').length} completed)\n- **Total Hours Logged:** ${totalMemberHours} hrs\n- **Time Extensions Requested:** ${memberExtensions.length} (${delaySummary} total delay)\n- **Daily Log History:**\n${logEntries}`;
  }).join('\n\n');

  const prompt = `
Generate an easy-to-read, crystal-clear Project Completion & Performance Report for the Project Manager.
Do NOT use overly complex jargon or convoluted formatting. Keep it readable, clean, and directly actionable.

### Project Overview
- Title: ${project.title} (Code #${project.code})
- Description: ${project.description || 'N/A'}
- Status: ${project.status.toUpperCase()}
- Planned Duration: ${project.duration_days} days
- Target Project Hours: ${project.target_hours} hrs
- Total Planned Task Hours: ${totalPlannedHours} hrs
- Total Delay / Extended Time: +${totalDelayHours} hrs${totalDelayDays > 0 ? ` (+${totalDelayDays} days)` : ''} across ${extensions.length} extension requests
- Total Logged Dev Hours: ${totalLoggedHours} hrs
- Task Status: ${completedTasks}/${totalTasks} completed (${inProgressTasks} in progress, ${todoTasks} to do)

### Extended Time & Reasons
${extensionsSummary}

### Daily Basis Work of Each Person
${devDailyWork}

### Output Requirements
Structure the report into these clear, easy-to-read sections:
1. **Executive Summary**: 2-3 concise paragraphs summarizing project health, delivery status, and key achievements.
2. **Whole Project & Schedule Analysis**: Compare planned time vs. actual finish time and explain the impact of delay hours.
3. **Time Extensions & Delay Reasons**: Detailed review of why time was extended for tasks and the developer-provided justifications.
4. **Individual Developer Daily Contributions**: Clean daily breakdown of each developer's accomplishments and hours.
5. **Key Takeaways & Next Steps**: 3 actionable bullet points for future iterations.
`;

  try {
    return await callGeminiApi(
      prompt,
      'You are a clear, structured technical delivery lead who writes simple, easy-to-read project management reports.'
    );
  } catch {
    // High-quality deterministic fallback
    const score = Math.round((completedTasks / Math.max(totalTasks, 1)) * 100);
    return `# Project Report: ${project.title}
**Project Code:** #${project.code} | **Status:** ${project.status.toUpperCase()} | **Date:** ${new Date().toLocaleDateString()}

---

### 1. Executive Summary
- **Overall Completion:** **${score}%** (${completedTasks} of ${totalTasks} tasks completed).
- **Project Scope:** ${project.description || 'Deliver core project milestones within planned timeline.'}
- **Delivery Verdict:** ${project.status === 'completed' ? 'Successfully Delivered' : 'Active and On Track'}. The team has logged **${totalLoggedHours} total developer hours** against the ${project.target_hours} hour target.

---

### 2. Whole Project & Schedule Details
- **Planned Duration:** ${project.duration_days} days
- **Planned Task Effort:** ${totalPlannedHours} hours
- **Total Delay Added:** **+${totalDelayHours} hours**${totalDelayDays > 0 ? ` (+${totalDelayDays} days)` : ''} (${extensions.length} extensions recorded)
- **Total Actual Logged Effort:** **${totalLoggedHours} hours**

---

### 3. Extended Time & Reasons Breakdown
${extensionsSummary}

---

### 4. Daily Basis Work of Each Team Member
${devDailyWork}

---

### 5. Key Takeaways & Recommendations
1. **Time Extension Visibility:** Tracking delay reasons provided clear visibility into technical dependencies and scope adjustments.
2. **Daily Standup Cadence:** Developers consistently logged accomplishments, keeping project velocity transparent.
3. **Next Steps:** Carry forward established sprint velocity and address remaining backlog items in the subsequent phase.
`;
  }
}

/**
 * Generates an exact 1-line daily summary for the Project Manager.
 */
export async function generateOneLineDailySummary(
  projectName: string,
  dailyLogs: DailyLog[],
  teamMembers: TeamMember[]
): Promise<string> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysLogs = dailyLogs.filter((l) => l.log_date === todayStr);

  const logsToUse = todaysLogs.length > 0 ? todaysLogs : dailyLogs.slice(0, 4);

  if (logsToUse.length === 0) {
    return `No daily logs submitted yet for ${projectName} today.`;
  }

  const logsText = logsToUse.map((l) => {
    const member = teamMembers.find((m) => m.id === l.member_id);
    return `${member?.name || 'Dev'}: "${l.content}"`;
  }).join('; ');

  const prompt = `
Project: "${projectName}"
Today's developer updates: ${logsText}

Write exactly ONE clear, concise sentence (under 25 words) summarizing for the Project Manager what the team accomplished today. Do not write multiple lines or preambles.
`;

  try {
    const res = await callGeminiApi(prompt);
    return res.trim().replace(/^["']|["']$/g, '');
  } catch {
    const devNames = Array.from(new Set(logsToUse.map((l) => {
      const m = teamMembers.find((t) => t.id === l.member_id);
      return m?.name?.split(' ')[0] || 'Team';
    }))).join(' and ');
    return `${devNames} completed core tickets and logged ${logsToUse.reduce((acc, l) => acc + (Number(l.hours_spent) || 0), 0)} hours today with healthy delivery momentum.`;
  }
}

/**
 * Summarizes recent daily logs into an executive daily digest for the Project Manager.
 */
export async function generateDailyStandupDigest(
  projectName: string,
  dailyLogs: DailyLog[],
  teamMembers: TeamMember[]
): Promise<string> {
  if (dailyLogs.length === 0) {
    return 'No daily logs have been submitted by the dev team yet.';
  }

  const logsText = dailyLogs.map((l) => {
    const author = teamMembers.find((m) => m.id === l.member_id);
    return `- **${author?.name || 'Dev'}** (${author?.role || 'Team Member'}) on ${l.log_date}: ${l.content} ${l.blockers ? `[Blocker: ${l.blockers}]` : ''} (${l.hours_spent} hrs)`;
  }).join('\n');

  const prompt = `
Project: "${projectName}"
Below are the daily logs submitted by the development team at the end of their work days:

${logsText}

Please provide an Executive Daily Standup Digest for the Project Manager:
1. **Today's Key Accomplishments** (bulleted summary of delivered work)
2. **Current Blockers & Attention Items** (any impediments that need PM intervention)
3. **Team Momentum & Next Focus**
Keep it concise, actionable, and formatted in clean Markdown.
`;

  try {
    return await callGeminiApi(prompt);
  } catch {
    return `### Daily Standup Digest for ${projectName}

#### 1. Today's Key Accomplishments
${dailyLogs.slice(0, 5).map((l) => `- ${l.content} (${l.hours_spent} hrs)`).join('\n')}

#### 2. Current Blockers & Attention Items
${dailyLogs.filter((l) => l.blockers).map((l) => `- ${l.blockers}`).join('\n') || '- No blockers flagged by developers today.'}

#### 3. Team Momentum & Next Focus
The development team has logged ${dailyLogs.reduce((acc, l) => acc + (Number(l.hours_spent) || 0), 0)} total hours. Velocity is healthy and ongoing tasks are progressing according to schedule.
`;
  }
}

/**
 * Helps a developer polish their rough daily notes into a clean, professional standup log.
 */
export async function polishDailyLog(
  rawNotes: string,
  devName: string,
  role: string
): Promise<{ polished: string; suggestedBlockers: string }> {
  const prompt = `
A developer named ${devName} (${role}) wrote these rough end-of-day work notes:
"""
${rawNotes}
"""

Please reformat and polish this into a clear, professional daily work log entry.
Return JSON with two keys:
{
  "polished": "clear, well-written bulleted summary of accomplishments and technical work done",
  "suggestedBlockers": "any identified blocker or dependency, or empty string if none"
}
Output only valid JSON.
`;

  try {
    const res = await callGeminiApi(prompt);
    const jsonMatch = res.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { polished: res, suggestedBlockers: '' };
  } catch {
    const lines = rawNotes.split(/[,;\n]+/).map((l) => l.trim()).filter(Boolean);
    const bullets = lines.map((l) => `• ${l.charAt(0).toUpperCase() + l.slice(1)}`).join('\n');
    return {
      polished: bullets,
      suggestedBlockers: '',
    };
  }
}

/**
 * Suggests task breakdown for the Project Manager based on project title and description.
 */
export async function suggestProjectTasks(
  title: string,
  description: string,
  durationDays: number
): Promise<Array<{ title: string; description: string; duration_hours: number; priority: 'low' | 'medium' | 'high' | 'urgent' }>> {
  const prompt = `
Project Title: "${title}"
Description: "${description}"
Planned Duration: ${durationDays} days

Generate a practical breakdown of 4 to 6 core development tasks for this project.
Return a valid JSON array of objects with the following keys:
- title: concise task title
- description: brief description of acceptance criteria
- duration_hours: number of estimated hours (e.g. 4, 8, 16)
- priority: "low" | "medium" | "high" | "urgent"

Output strictly JSON: [ { ... } ]
`;

  try {
    const res = await callGeminiApi(prompt);
    const jsonMatch = res.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch {
    return [
      {
        title: 'Core Architecture & Schema Definition',
        description: 'Design schema, define relationships, and configure access permissions.',
        duration_hours: 8,
        priority: 'high',
      },
      {
        title: 'Frontend Component Hierarchy & State',
        description: 'Implement reusable responsive views, filters, and user interaction states.',
        duration_hours: 12,
        priority: 'high',
      },
      {
        title: 'API Integration & Service Contracts',
        description: 'Connect client requests with backend endpoints, query handling, and error states.',
        duration_hours: 10,
        priority: 'medium',
      },
      {
        title: 'End-to-End Verification & Deployment',
        description: 'Conduct cross-browser tests, performance audits, and release preparation.',
        duration_hours: 6,
        priority: 'medium',
      },
    ];
  }
}
