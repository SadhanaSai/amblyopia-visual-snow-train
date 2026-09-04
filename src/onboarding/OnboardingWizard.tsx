import { useState } from 'react';
import type { Diagnosis, WeakEye } from '../types/profile';
import { createDefaultProfile, loadProfile, saveProfile } from '../utils/profileUtils';
import CalibrationWizard from '../calibration/CalibrationWizard';
import ContraindicationCheck, {
  allRequiredChecked,
  EMPTY_CONTRAINDICATIONS,
  type ContraindicationAnswers,
} from './ContraindicationCheck';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const DIAGNOSIS_OPTIONS: { value: Diagnosis; label: string; note?: string }[] = [
  {
    value: 'anisometropic',
    label: 'Anisometropic amblyopia',
    note: 'Different prescriptions between eyes',
  },
  { value: 'strabismic', label: 'Strabismic amblyopia', note: 'Eye turn / misalignment' },
  { value: 'combined', label: 'Combined mechanism' },
  { value: 'unspecified', label: 'Diagnosed but type not specified' },
];

type Screen = 1 | 2 | 3 | 4 | 'calibration';

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [screen, setScreen] = useState<Screen>(1);
  const [weakEye, setWeakEye] = useState<WeakEye | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [contraindications, setContraindications] =
    useState<ContraindicationAnswers>(EMPTY_CONTRAINDICATIONS);

  function persistAndGoToCalibration() {
    const existing = loadProfile() ?? createDefaultProfile();
    saveProfile({
      ...existing,
      weakEye: weakEye!,
      diagnosis: diagnosis!,
      photosensitiveEpilepsy: !contraindications.noPhotosensitiveEpilepsy,
      strabismusSurgeryRecent: !contraindications.noRecentStrabismusSurgery,
    });
    setScreen('calibration');
  }

  function finishCalibration() {
    const existing = loadProfile() ?? createDefaultProfile();
    saveProfile({ ...existing, onboardingComplete: true });
    onComplete();
  }

  if (screen === 'calibration') {
    return <CalibrationWizard onComplete={finishCalibration} />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        Welcome — step {screen} of 4
      </div>

      {screen === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Which eye is weaker?</h2>
          <div className="flex justify-center gap-10 py-4">
            {(['left', 'right'] as WeakEye[]).map((eye) => (
              <button
                key={eye}
                type="button"
                onClick={() => setWeakEye(eye)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${
                  weakEye === eye ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <FaceDiagram highlighted={eye} />
                <span className="text-sm font-medium capitalize">{eye} eye is weaker</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!weakEye}
            onClick={() => setScreen(2)}
            className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Continue
          </button>
        </section>
      )}

      {screen === 2 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Diagnosis type</h2>
          <div className="flex flex-col gap-2">
            {DIAGNOSIS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDiagnosis(opt.value)}
                className={`rounded-lg border p-3 text-left ${
                  diagnosis === opt.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                {opt.note && <div className="text-xs text-gray-500">{opt.note}</div>}
              </button>
            ))}
          </div>
          {diagnosis && (
            <p className="text-xs text-gray-500">
              {diagnosis === 'strabismic' || diagnosis === 'combined'
                ? 'Fixation Stability training will be available for you.'
                : diagnosis === 'anisometropic'
                  ? 'Fixation Stability training is not applicable for anisometropic-only amblyopia.'
                  : null}
            </p>
          )}
          <button
            type="button"
            disabled={!diagnosis}
            onClick={() => setScreen(3)}
            className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Continue
          </button>
        </section>
      )}

      {screen === 3 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Before you start</h2>
          <ContraindicationCheck answers={contraindications} onChange={setContraindications} />
          <button
            type="button"
            disabled={!allRequiredChecked(contraindications)}
            onClick={() => setScreen(4)}
            className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Continue
          </button>
        </section>
      )}

      {screen === 4 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">How this works</h2>
          <p className="text-sm text-gray-600">
            Dichoptic training shows different content to each eye at the same time — typically
            through red/cyan or red/green anaglyph glasses — so the brain is encouraged to combine input from
            both eyes instead of suppressing the weaker one.
          </p>
          <p className="text-sm text-gray-600">
            Recommended schedule: <strong>5 days/week</strong>, starting at{' '}
            <strong>5 minutes/session</strong>.
          </p>
          <p className="text-xs text-gray-400">See the Guide tab for the full explanation.</p>
          <button
            type="button"
            onClick={persistAndGoToCalibration}
            className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
          >
            Start calibration
          </button>
        </section>
      )}
    </div>
  );
}

function FaceDiagram({ highlighted }: { highlighted: WeakEye }) {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="32" fill="#F3F4F6" stroke="#D1D5DB" />
      <circle cx="24" cy="30" r="6" fill={highlighted === 'left' ? '#2563EB' : '#9CA3AF'} />
      <circle cx="48" cy="30" r="6" fill={highlighted === 'right' ? '#2563EB' : '#9CA3AF'} />
      <path d="M24 50 Q36 58 48 50" stroke="#9CA3AF" strokeWidth="2" fill="none" />
    </svg>
  );
}
