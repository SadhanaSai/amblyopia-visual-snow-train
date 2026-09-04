import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { ProfileProvider, useProfile } from './profile/ProfileContext';
import ProfileSettings from './profile/ProfileSettings';
import OnboardingWizard from './onboarding/OnboardingWizard';
import CalibrationWizard from './calibration/CalibrationWizard';
import { loadProfile } from './utils/profileUtils';
import { useSessionLogger } from './hooks/useSessionLogger';
import { useViewingCalibration } from './hooks/useViewingCalibration';
import type { Module } from './types/exercise';
import type { WeakEye } from './types/profile';

import ICRController from './dichoptic/ICRController';
import GratingFusion from './dichoptic/GratingFusion';
import LetterDiscrimination from './dichoptic/LetterDiscrimination';
import RivalryProbe from './dichoptic/RivalryProbe';
import MotionCoherence from './dichoptic/MotionCoherence';
import DichopticReading from './dichoptic/DichopticReading';
import FixationStability from './dichoptic/FixationStability';

import NoiseAdaptation from './nopt/NoiseAdaptation';
import SaccadicTraining from './nopt/SaccadicTraining';
import VergenceTraining from './nopt/VergenceTraining';
import EntopticDesensitization from './nopt/EntopticDesensitization';
import ChromaticSimulator from './nopt/ChromaticSimulator';

import VATest from './assessment/VATest';
import CSFTest from './assessment/CSFTest';
import StereoTest from './assessment/StereoTest';
import AssessmentRouter from './assessment/AssessmentRouter';

import ProgressDashboard from './progress/ProgressDashboard';
import ExerciseIntro from './components/ExerciseIntro';
import { EXERCISE_INFO } from './data/exerciseInfo';

const CLINICAL_DISCLAIMER = `These exercises and measurements are based on published peer-reviewed research in vision science and neuro-optometry (2020-2025). They are not a substitute for clinical diagnosis or treatment by a licensed optometrist or ophthalmologist.

Screen-based measurements are validated for trend monitoring, not clinical diagnosis. A clinician-measured baseline is recommended every 3-6 months.

Stop any exercise immediately if you experience: double vision, headache, nausea, or worsening symptoms.`;

function ClinicalDisclaimer({ variant }: { variant: 'header' | 'footer' }) {
  return (
    <div
      className={`whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ${
        variant === 'header' ? 'mb-4' : 'mt-6'
      }`}
    >
      {CLINICAL_DISCLAIMER}
    </div>
  );
}

// Measures real wall-clock time spent on an exercise/assessment and
// guarantees a Session gets logged even if the user leaves via the "Back"
// button instead of letting the activity run to its own completion (which
// already logs a detailed Session itself, via `onComplete`). Without this,
// an abandoned attempt left no trace at all.
//
// A few exercises (FixationStability's runs, NoiseAdaptation's rounds,
// CSFTest's per-eye passes, SaccadicTraining's Pursuit) log a Session after
// each of several internal rounds while staying mounted for the rest.
// Bailing out mid-way through a later round would otherwise double-count:
// the fallback below would span the whole mount-to-unmount time, which
// overlaps whatever earlier rounds already logged accurately. Skipping the
// fallback whenever the shared session log has grown at all during this
// mount (`sessions.length` moved past its value at mount) avoids that at
// the cost of not logging the final, abandoned partial round by itself —
// a better trade than inflating the day's total.
function TrackedExercise({
  module,
  exercise,
  weakEye,
  onComplete,
  children,
}: {
  module: Module;
  exercise: string;
  weakEye: WeakEye;
  onComplete?: () => void;
  children: (onComplete: () => void) => ReactNode;
}) {
  const { logSession, sessions } = useSessionLogger();
  const mountedAtRef = useRef(performance.now());
  const completedRef = useRef(false);
  const sessionCountAtMountRef = useRef(sessions.length);
  const latestSessionCountRef = useRef(sessions.length);
  latestSessionCountRef.current = sessions.length;

  useEffect(() => {
    return () => {
      if (completedRef.current) return;
      if (latestSessionCountRef.current > sessionCountAtMountRef.current) return;
      const durationSeconds = Math.round((performance.now() - mountedAtRef.current) / 1000);
      if (durationSeconds < 1) return;
      logSession({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        module,
        exercise,
        weakEye,
        durationSeconds,
        trials: 0,
        notes: 'incomplete — exited before finishing',
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleComplete() {
    completedRef.current = true;
    onComplete?.();
  }

  return <>{children(handleComplete)}</>;
}

type ExerciseComponent = ComponentType<{ onComplete?: () => void }>;

const DICHOPTIC_EXERCISES: { key: string; label: string; Component: ExerciseComponent }[] = [
  { key: 'grating-fusion', label: 'Contrast-Defined Grating Fusion', Component: GratingFusion },
  { key: 'letter-discrimination', label: 'Letter / Optotype Discrimination', Component: LetterDiscrimination },
  { key: 'rivalry-probe', label: 'Binocular Rivalry Suppression Probe', Component: RivalryProbe },
  { key: 'motion-coherence', label: 'Dichoptic Global Motion Coherence', Component: MotionCoherence },
  { key: 'dichoptic-reading', label: 'Dichoptic Reading', Component: DichopticReading },
  { key: 'fixation-stability', label: 'Fixation Stability Training', Component: FixationStability },
];

const NOPT_EXERCISES: { key: string; label: string; Component: ExerciseComponent }[] = [
  { key: 'noise-adaptation', label: 'Visual Noise Adaptation', Component: NoiseAdaptation },
  { key: 'saccadic-training', label: 'Saccadic Training', Component: SaccadicTraining },
  { key: 'vergence-training', label: 'Vergence + Accommodation Training', Component: VergenceTraining },
  { key: 'entoptic-desensitization', label: 'Entoptic Desensitization', Component: EntopticDesensitization },
  { key: 'chromatic-simulator', label: 'Chromatic Simulator', Component: ChromaticSimulator },
];

type Tab = 'train' | 'assess' | 'progress' | 'guide' | 'settings';
const TABS: { key: Tab; label: string }[] = [
  { key: 'train', label: 'Train' },
  { key: 'assess', label: 'Assess' },
  { key: 'progress', label: 'Progress' },
  { key: 'guide', label: 'Guide' },
  { key: 'settings', label: 'Settings' },
];

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState(
    () => loadProfile()?.onboardingComplete ?? false,
  );

  if (!onboardingDone) {
    return <OnboardingWizard onComplete={() => setOnboardingDone(true)} />;
  }

  return (
    <ProfileProvider>
      <MainApp />
    </ProfileProvider>
  );
}

function ZoomWarningBanner({ onRecalibrate }: { onRecalibrate: () => void }) {
  return (
    <div className="mx-4 mt-4 flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
      <p>
        Your browser zoom has changed since you calibrated — stimulus sizes and any on-screen
        measurements will be wrong until you recalibrate.
      </p>
      <button
        type="button"
        onClick={onRecalibrate}
        className="self-start rounded-full bg-red-600 px-3 py-1.5 font-medium text-white"
      >
        Recalibrate now
      </button>
    </div>
  );
}

function MainApp() {
  const [tab, setTab] = useState<Tab>('train');
  const { zoomChanged } = useViewingCalibration();
  const [recalibrating, setRecalibrating] = useState(false);

  if (recalibrating) {
    return <CalibrationWizard onComplete={() => setRecalibrating(false)} />;
  }

  return (
    <div className="flex min-h-screen flex-col pb-16">
      <div className="flex-1 overflow-y-auto">
        {zoomChanged && <ZoomWarningBanner onRecalibrate={() => setRecalibrating(true)} />}
        {tab === 'train' && <TrainTab />}
        {tab === 'assess' && <AssessTab />}
        {tab === 'progress' && <ProgressDashboard />}
        {tab === 'guide' && <GuideTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-gray-200 bg-white">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-center text-xs font-medium ${
              tab === t.key ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// --- Train tab -------------------------------------------------------------

type DisplayModeChoice = 'anaglyph' | 'side_by_side' | 'screen_only';

function TrainTab() {
  const { profile } = useProfile();
  const [module, setModule] = useState<'dichoptic' | 'nopt'>('dichoptic');
  const [displayMode, setDisplayMode] = useState<DisplayModeChoice>('anaglyph');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [introSeen, setIntroSeen] = useState(false);

  const exercises = module === 'dichoptic' ? DICHOPTIC_EXERCISES : NOPT_EXERCISES;
  const active = exercises.find((e) => e.key === activeKey);

  function openExercise(key: string) {
    setActiveKey(key);
    setIntroSeen(false);
  }

  function closeExercise() {
    setActiveKey(null);
    setIntroSeen(false);
  }

  if (active) {
    const info = EXERCISE_INFO[active.key];
    if (!introSeen && info) {
      return <ExerciseIntro info={info} onStart={() => setIntroSeen(true)} onBack={closeExercise} />;
    }
    const ActiveComponent = active.Component;
    return (
      <div className="flex flex-col gap-4 p-4">
        <button type="button" onClick={closeExercise} className="self-start text-xs text-blue-600">
          &larr; Back
        </button>
        <TrackedExercise
          module={module}
          exercise={active.key}
          weakEye={profile.weakEye}
          onComplete={closeExercise}
        >
          {(onComplete) => <ActiveComponent onComplete={onComplete} />}
        </TrackedExercise>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-2">
        {(['dichoptic', 'nopt'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModule(m)}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
              module === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
            }`}
          >
            {m === 'dichoptic' ? 'Dichoptic' : 'NOPT'}
          </button>
        ))}
      </div>

      {module === 'dichoptic' && (
        <>
          <ICRController />
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Display mode</div>
            <div className="flex gap-2">
              {(['anaglyph', 'side_by_side', 'screen_only'] as DisplayModeChoice[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={m !== 'anaglyph'}
                  onClick={() => setDisplayMode(m)}
                  title={m !== 'anaglyph' ? 'Not yet implemented — anaglyph only for now' : undefined}
                  className={`rounded-full border px-3 py-1.5 text-xs disabled:opacity-30 ${
                    displayMode === m ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                  }`}
                >
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        {exercises.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => openExercise(e.key)}
            className="rounded-lg border border-gray-200 p-3 text-left text-sm font-medium text-gray-800"
          >
            {e.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400">Weak eye: {profile.weakEye}</p>
    </div>
  );
}

// --- Assess tab --------------------------------------------------------

function AssessTab() {
  const { profile } = useProfile();
  const { vaResults, csfResults, stereoResults, suppressionResults } = useSessionLogger();
  const [activeTest, setActiveTest] = useState<'va' | 'csf' | 'stereo' | 'suppression' | null>(null);
  const [introSeen, setIntroSeen] = useState(false);
  const remindersEnabled = localStorage.getItem('assessment_reminders_enabled') !== 'false';

  function openTest(test: 'va' | 'csf' | 'stereo' | 'suppression') {
    setActiveTest(test);
    setIntroSeen(false);
  }

  function closeTest() {
    setActiveTest(null);
    setIntroSeen(false);
  }

  if (activeTest) {
    const info = EXERCISE_INFO[activeTest];
    if (!introSeen && info) {
      return <ExerciseIntro info={info} onStart={() => setIntroSeen(true)} onBack={closeTest} />;
    }
    return (
      <div className="flex flex-col gap-4 p-4">
        <button type="button" onClick={closeTest} className="self-start text-xs text-blue-600">
          &larr; Back
        </button>
        <TrackedExercise
          module="assessment"
          exercise={activeTest}
          weakEye={profile.weakEye}
          onComplete={closeTest}
        >
          {(onComplete) => (
            <>
              {activeTest === 'va' && <VATest onComplete={onComplete} />}
              {activeTest === 'csf' && <CSFTest onComplete={onComplete} />}
              {activeTest === 'stereo' && <StereoTest onComplete={onComplete} />}
              {activeTest === 'suppression' && <RivalryProbe mode="assessment" onComplete={onComplete} />}
            </>
          )}
        </TrackedExercise>
      </div>
    );
  }

  const lastVA = vaResults[vaResults.length - 1];
  const lastCSF = csfResults[csfResults.length - 1];
  const lastStereo = stereoResults[stereoResults.length - 1];
  const lastSuppression = suppressionResults[suppressionResults.length - 1];

  return (
    <div className="flex flex-col gap-4 p-4">
      {remindersEnabled && <AssessmentRouter onRunNow={() => {}} />}

      <AssessCard
        label="Visual Acuity"
        lastDate={lastVA?.date}
        lastValue={lastVA ? `${lastVA.logMAR.toFixed(1)} logMAR` : undefined}
        onRun={() => openTest('va')}
      />
      <AssessCard
        label="Contrast Sensitivity"
        lastDate={lastCSF?.date}
        lastValue={lastCSF ? `AULCSF ${lastCSF.AULCSF.toFixed(2)}` : undefined}
        onRun={() => openTest('csf')}
      />
      <AssessCard
        label="Stereoacuity"
        lastDate={lastStereo?.date}
        lastValue={lastStereo ? `${lastStereo.thresholdArcsec.toFixed(0)} arc-sec` : undefined}
        onRun={() => openTest('stereo')}
      />
      <AssessCard
        label="Suppression"
        lastDate={lastSuppression?.date}
        lastValue={lastSuppression ? `${lastSuppression.thresholdContrastPct.toFixed(1)}%` : undefined}
        onRun={() => openTest('suppression')}
      />

      <ClinicalDisclaimer variant="footer" />
    </div>
  );
}

function AssessCard({
  label,
  lastDate,
  lastValue,
  onRun,
}: {
  label: string;
  lastDate?: string;
  lastValue?: string;
  onRun: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-400">
          {lastDate ? `Last: ${new Date(lastDate).toLocaleDateString()} — ${lastValue}` : 'Not yet run'}
        </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
      >
        Run
      </button>
    </div>
  );
}

// --- Guide tab -----------------------------------------------------------

function GuideTab() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <ClinicalDisclaimer variant="header" />
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">How dichoptic training works</h3>
        <p className="text-sm text-gray-600">
          Dichoptic training presents different content to each eye at the same time, usually
          through red/cyan or red/green anaglyph glasses. By giving the weak eye full-strength content and the
          strong eye a reduced-contrast (ICR) version, the brain is pushed to combine input from
          both eyes instead of suppressing the weaker one — the core mechanism behind the
          contrast-rebalancing approach validated in Hess, Mansouri & Thompson (2010) and later
          RCTs like CureSight.
        </p>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">How NOPT exercises work</h3>
        <p className="text-sm text-gray-600">
          Visual Snow Syndrome exercises target specific mechanisms reported in the literature:
          noise adaptation exploits perceptual averaging between external and internal noise,
          saccadic and vergence training address the oculomotor deficits found in a majority of
          VSS patients (Ciuffreda & Rutner, 2025), and entoptic desensitization uses graded
          exposure to reduce the attentional salience of floaters and phosphenes.
        </p>
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-gray-800">Recommended protocol</h3>
        <p className="text-sm text-gray-600">
          Dichoptic training: 5 days/week, starting at 5 minutes/session. NOPT modules can be
          layered in as tolerated — start with one module per session and build up.
        </p>
      </section>
    </div>
  );
}

// --- Settings tab --------------------------------------------------------

const EXPORT_KEYS = [
  'profile',
  'calibration',
  'sessions',
  'va_results',
  'csf_results',
  'stereo_results',
  'suppression_results',
  'adaptive_icr',
  'reading_history',
  'has_anaglyph_glasses',
  'assessment_snooze',
  'blue_field_duration_s',
  'floater_overlay_contrast_pct',
];

function SettingsTab() {
  const { calibration } = useViewingCalibration();
  const [remindersEnabled, setRemindersEnabled] = useState(
    () => localStorage.getItem('assessment_reminders_enabled') !== 'false',
  );

  function toggleReminders() {
    const next = !remindersEnabled;
    localStorage.setItem('assessment_reminders_enabled', String(next));
    setRemindersEnabled(next);
  }

  function exportData() {
    const data: Record<string, unknown> = {};
    for (const key of EXPORT_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dichoptic-nopt-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAllData() {
    if (!window.confirm('This deletes all profile, calibration, and session data on this device. Continue?')) {
      return;
    }
    for (const key of EXPORT_KEYS) localStorage.removeItem(key);
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <ProfileSettings />

      <section className="border-t pt-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Assessment reminders</h3>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={remindersEnabled} onChange={toggleReminders} />
          Show overdue assessment banners
        </label>
      </section>

      <section className="border-t pt-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Data</h3>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={exportData}
            className="rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
          >
            Export session data (JSON)
          </button>
          <button
            type="button"
            onClick={resetAllData}
            className="rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600"
          >
            Reset all data
          </button>
        </div>
      </section>

      {!calibration && (
        <section className="border-t pt-4">
          <p className="mb-2 text-xs text-gray-500">
            No calibration on record — run it before your next session.
          </p>
          <RecalibratePrompt />
        </section>
      )}
    </div>
  );
}

function RecalibratePrompt() {
  const [recalibrating, setRecalibrating] = useState(false);
  if (recalibrating) return <CalibrationWizard onComplete={() => setRecalibrating(false)} />;
  return (
    <button
      type="button"
      onClick={() => setRecalibrating(true)}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
    >
      Run calibration
    </button>
  );
}
