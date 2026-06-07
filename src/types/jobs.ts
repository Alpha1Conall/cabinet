export interface JobPostAction {
  action: "git_commit" | "update_page" | "notify";
  message?: string;
  path?: string;
  channel?: string;
}

export interface JobConfig {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  provider: string;
  adapterType?: string;
  adapterConfig?: Record<string, unknown>;
  ownerAgent?: string;
  agentSlug?: string;
  workdir?: string;
  timeout?: number;
  prompt: string;
  on_complete?: JobPostAction[];
  on_failure?: JobPostAction[];
  cabinetPath?: string;
  createdAt: string;
  updatedAt: string;
  /** One-shot job: auto-disable after first successful fire. */
  oneShot?: boolean;
  /** ISO datetime this job was created to run at. Canonical instant for a
   *  one-off (the cron expression is just the trigger). */
  runAfter?: string;
  /** Per-occurrence exceptions (iCalendar EXDATE): ISO instants of recurring
   *  occurrences that have been moved/suppressed. The calendar hides these and
   *  the run handler skips them server-side. */
  exceptions?: string[];
  /** Conversation id that dispatched this job via an agent action. */
  ownerTaskId?: string;
}

export interface JobRun {
  id: string;
  jobId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  output: string;
}
