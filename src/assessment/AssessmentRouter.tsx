import { useState } from 'react';
import { useSessionLogger } from '../hooks/useSessionLogger';

const SNOOZE_KEY = 'assessment_snooze';
const SNOOZE_HOURS = 24;
const MAX_SNOOZES = 2;

interface SnoozeState {
  until: string;
  count: number;
}

function loadSnooze(): SnoozeState {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    return raw ? (JSON.parse(raw) as SnoozeState) : { until: '', count: 0 };
  } catch {
    return { until: '', count: 0 };
  }
}

function daysSince(dateIso: string | undefined): number | null {
  if (!dateIso) return null;
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86_400_000);
}

interface AssessmentRouterProps {
  onRunNow: () => void;
}

export default function AssessmentRouter({ onRunNow }: AssessmentRouterProps) {
  const { vaResults, csfResults, stereoResults, suppressionResults } = useSessionLogger();
  const [snooze, setSnooze] = useState<SnoozeState>(() => loadSnooze());
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  const vaDays = daysSince(vaResults[vaResults.length - 1]?.date);
  const csfDays = daysSince(csfResults[csfResults.length - 1]?.date);
  const stereoDays = daysSince(stereoResults[stereoResults.length - 1]?.date);
  const suppressionDays = daysSince(suppressionResults[suppressionResults.length - 1]?.date);

  const overdue =
    vaDays === null ||
    vaDays >= 7 ||
    csfDays === null ||
    csfDays >= 14 ||
    stereoDays === null ||
    stereoDays >= 14 ||
    suppressionDays === null ||
    suppressionDays >= 7;

  const snoozedActive = snooze.until !== '' && new Date(snooze.until).getTime() > Date.now();
  const mustShow = snooze.count >= MAX_SNOOZES;

  if (!overdue || dismissedThisSession) return null;
  if (snoozedActive && !mustShow) return null;

  function handleRemindLater() {
    const next: SnoozeState = {
      until: new Date(Date.now() + SNOOZE_HOURS * 3_600_000).toISOString(),
      count: snooze.count + 1,
    };
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(next));
    setSnooze(next);
    setDismissedThisSession(true);
  }

  function handleRunNow() {
    localStorage.removeItem(SNOOZE_KEY);
    setSnooze({ until: '', count: 0 });
    onRunNow();
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
      <span>Time for your weekly vision check — takes 4 minutes</span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleRunNow}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
        >
          Run now
        </button>
        {!mustShow && (
          <button
            type="button"
            onClick={handleRemindLater}
            className="rounded border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700"
          >
            Remind me later
          </button>
        )}
      </div>
    </div>
  );
}
