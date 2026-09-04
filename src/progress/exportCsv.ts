import type { Session } from '../types/session';
import type { CSFResult, StereoResult, SuppressionResult, VAResult } from '../types/assessment';

function csvEscape(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCSV(columns: string[], rows: unknown[][]): string {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return lines.join('\n');
}

const SESSION_COLUMNS = [
  'date',
  'timestamp',
  'module',
  'exercise',
  'paradigm',
  'displayMode',
  'weakEye',
  'durationSeconds',
  'trials',
  'accuracy',
  'staircaseThreshold',
  'thresholdUnit',
  'icrUsed',
  'selfRating_pre',
  'selfRating_post',
  'adaptationReliefDuration',
  'notes',
];

export function sessionsToCSV(sessions: Session[]): string {
  const rows = sessions.map((s) => [
    s.timestamp.slice(0, 10),
    s.timestamp,
    s.module,
    s.exercise,
    s.paradigm,
    s.displayMode,
    s.weakEye,
    s.durationSeconds,
    s.trials,
    s.accuracy,
    s.staircaseThreshold,
    s.thresholdUnit,
    s.icrUsed,
    s.selfRating?.pre,
    s.selfRating?.post,
    s.adaptationReliefDuration,
    s.notes,
  ]);
  return toCSV(SESSION_COLUMNS, rows);
}

const ASSESSMENT_COLUMNS = [
  'test_type',
  'date',
  'eye',
  'logMAR',
  'AULCSF',
  'sf_1cpd',
  'sf_2cpd',
  'sf_4cpd',
  'sf_8cpd',
  'sf_16cpd',
  'thresholdArcsec',
  'logThreshold',
  'noMeasurableStereopsis',
  'lapseRate',
  'thresholdContrastPct',
];

export function assessmentsToCSV(data: {
  vaResults: VAResult[];
  csfResults: CSFResult[];
  stereoResults: StereoResult[];
  suppressionResults: SuppressionResult[];
}): string {
  const rows: unknown[][] = [];
  for (const r of data.vaResults) {
    rows.push(['VA', r.date, r.eye, r.logMAR, '', '', '', '', '', '', '', '', '', '', '']);
  }
  for (const r of data.csfResults) {
    rows.push([
      'CSF',
      r.date,
      r.eye,
      '',
      r.AULCSF,
      r.sf_1cpd,
      r.sf_2cpd,
      r.sf_4cpd,
      r.sf_8cpd,
      r.sf_16cpd,
      '',
      '',
      '',
      '',
      '',
    ]);
  }
  for (const r of data.stereoResults) {
    rows.push([
      'Stereo',
      r.date,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      r.thresholdArcsec,
      r.logThreshold,
      r.noMeasurableStereopsis ?? false,
      r.lapseRate,
      '',
    ]);
  }
  for (const r of data.suppressionResults) {
    rows.push(['Suppression', r.date, '', '', '', '', '', '', '', '', '', '', '', '', r.thresholdContrastPct]);
  }
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  return toCSV(ASSESSMENT_COLUMNS, rows);
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
