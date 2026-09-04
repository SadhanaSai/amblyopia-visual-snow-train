import { useState } from 'react';
import type { Diagnosis, LensType, WeakEye, WeakEyeChannel } from '../types/profile';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import CalibrationWizard from '../calibration/CalibrationWizard';
import { useProfile } from './ProfileContext';

const DIAGNOSIS_LABELS: Record<Diagnosis, string> = {
  anisometropic: 'Anisometropic amblyopia',
  strabismic: 'Strabismic amblyopia',
  combined: 'Combined mechanism',
  unspecified: 'Diagnosed but type not specified',
};

export default function ProfileSettings() {
  const { profile, updateProfile } = useProfile();
  const { calibration, daysSinceCalibration, needsRecalibration } = useViewingCalibration();
  const [recalibrating, setRecalibrating] = useState(false);

  if (recalibrating) {
    return <CalibrationWizard onComplete={() => setRecalibrating(false)} />;
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Weak eye</h3>
        <div className="flex gap-2">
          {(['left', 'right'] as WeakEye[]).map((eye) => (
            <button
              key={eye}
              type="button"
              onClick={() => updateProfile({ weakEye: eye })}
              className={`flex-1 rounded-lg border py-2 text-sm capitalize ${
                profile.weakEye === eye
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700'
              }`}
            >
              {eye}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Weak eye lens</h3>
        <div className="flex gap-2">
          {(['red', 'other'] as WeakEyeChannel[]).map((wc) => (
            <button
              key={wc}
              type="button"
              onClick={() => updateProfile({ weakEyeChannel: wc })}
              className={`flex-1 rounded-lg border py-2 text-sm ${
                (profile.weakEyeChannel ?? 'red') === wc
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700'
              }`}
            >
              {wc === 'red' ? 'Red' : 'The other color'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Which lens sits over your weak eye. Molded glasses can't be reoriented to put a chosen
          color over a chosen eye, so instead of asking you to flip them, the app renders your
          weak eye's content in whichever color your weak eye actually looks through.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Lens type</h3>
        <div className="flex gap-2">
          {(['red-cyan', 'red-green'] as LensType[]).map((lt) => (
            <button
              key={lt}
              type="button"
              onClick={() => updateProfile({ lensType: lt })}
              className={`flex-1 rounded-lg border py-2 text-sm ${
                (profile.lensType ?? 'red-cyan') === lt
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700'
              }`}
            >
              {lt === 'red-cyan' ? 'Red / Cyan' : 'Red / Green'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Match this to your physical anaglyph glasses — every dichoptic exercise renders its
          non-red channel in this color, so a mismatch makes it look washed out or leaky no
          matter what's on screen. Not sure which you have? The Dichoptic Reading glasses-check
          screen shows both colors side by side to help you tell.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Diagnosis</h3>
        <div className="flex flex-col gap-2">
          {(Object.keys(DIAGNOSIS_LABELS) as Diagnosis[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => updateProfile({ diagnosis: d })}
              className={`rounded-lg border p-2.5 text-left text-sm ${
                profile.diagnosis === d
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700'
              }`}
            >
              {DIAGNOSIS_LABELS[d]}
            </button>
          ))}
        </div>
        {(profile.diagnosis === 'anisometropic' || profile.diagnosis === 'unspecified') && (
          <p className="mt-2 text-xs text-gray-400">
            Fixation Stability training is only offered for strabismic or combined-mechanism
            amblyopia.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Screen calibration</h3>
        {calibration ? (
          <p className="text-xs text-gray-500">
            Last calibrated {daysSinceCalibration} day{daysSinceCalibration === 1 ? '' : 's'} ago
            {needsRecalibration && (
              <span className="ml-1 font-medium text-amber-600">— recalibration recommended</span>
            )}
          </p>
        ) : (
          <p className="text-xs text-gray-500">Not calibrated yet.</p>
        )}
        <button
          type="button"
          onClick={() => setRecalibrating(true)}
          className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
        >
          Re-run calibration
        </button>
      </section>
    </div>
  );
}
