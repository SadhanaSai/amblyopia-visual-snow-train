import { useMemo, useState } from 'react';
import { useViewingCalibration } from '../hooks/useViewingCalibration';

type ReferenceObjectKey = 'usd' | 'inr' | 'eur' | 'gbp' | 'a4' | 'usLetter';

const REFERENCE_LABELS: Record<ReferenceObjectKey, string> = {
  usd: 'US Dollar',
  inr: 'Indian Rupee',
  eur: 'Euro',
  gbp: 'UK Pound',
  a4: 'A4 Paper',
  usLetter: 'US Letter',
};

const REFERENCE_WIDTHS_MM: Record<Exclude<ReferenceObjectKey, 'inr'>, number> = {
  usd: 156.1,
  eur: 120.0,
  gbp: 125.0,
  a4: 210.0,
  usLetter: 215.9,
};

const INR_DENOMINATIONS = [
  { value: 10, widthMm: 123 },
  { value: 20, widthMm: 129 },
  { value: 50, widthMm: 135 },
  { value: 100, widthMm: 142 },
  { value: 200, widthMm: 146 },
  { value: 500, widthMm: 150 },
  { value: 2000, widthMm: 166 }, // withdrawn May 2023 but still legal tender
] as const;

const SLIDER_MIN = 300;
const SLIDER_MAX = 2000;
const PPI_SANE_MIN = 60;
const PPI_SANE_MAX = 350;

interface CalibrationWizardProps {
  onComplete: () => void;
}

export default function CalibrationWizard({ onComplete }: CalibrationWizardProps) {
  const { saveCalibration } = useViewingCalibration();
  const [step, setStep] = useState(1);
  const [referenceObject, setReferenceObject] = useState<ReferenceObjectKey | null>(null);
  const [inrDenomination, setInrDenomination] = useState<number | null>(null);
  const [sliderPx, setSliderPx] = useState(800);
  const [distanceConfirmed, setDistanceConfirmed] = useState(false);

  const referenceWidthMm = useMemo(() => {
    if (referenceObject === 'inr') {
      return INR_DENOMINATIONS.find((d) => d.value === inrDenomination)?.widthMm ?? null;
    }
    if (referenceObject) return REFERENCE_WIDTHS_MM[referenceObject];
    return null;
  }, [referenceObject, inrDenomination]);

  const ppmm = referenceWidthMm ? sliderPx / referenceWidthMm : 0;
  const ppi = ppmm * 25.4;
  const ppiOutOfRange = ppi < PPI_SANE_MIN || ppi > PPI_SANE_MAX;

  const canAdvanceFromStep1 = referenceObject !== null && (referenceObject !== 'inr' || inrDenomination !== null);

  const referenceNoun =
    referenceObject === 'a4' || referenceObject === 'usLetter' ? 'paper' : 'note';

  function handleConfirm() {
    saveCalibration({
      ppmm,
      referenceObject: referenceObject === 'inr' ? 'inr' : (referenceObject as string),
      inrDenomination: referenceObject === 'inr' ? (inrDenomination ?? undefined) : undefined,
    });
    onComplete();
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <div className="mx-auto w-full max-w-md text-xs font-medium uppercase tracking-wide text-gray-400">
        Screen calibration — step {step} of 4
      </div>

      {step === 1 && (
        <section className="mx-auto flex w-full max-w-md flex-col gap-4">
          <h2 className="text-lg font-semibold">Select a reference object</h2>
          <p className="text-sm text-gray-600">
            Pick something you have on hand with a known, fixed physical width.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REFERENCE_LABELS) as ReferenceObjectKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setReferenceObject(key);
                  if (key !== 'inr') setInrDenomination(null);
                }}
                className={`rounded-full border px-4 py-2 text-sm ${
                  referenceObject === key
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {REFERENCE_LABELS[key]}
              </button>
            ))}
          </div>

          {referenceObject === 'inr' && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {INR_DENOMINATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setInrDenomination(d.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    inrDenomination === d.value
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  ₹{d.value}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={!canAdvanceFromStep1}
            onClick={() => setStep(2)}
            className="mt-4 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Continue
          </button>
        </section>
      )}

      {step === 2 && referenceWidthMm !== null && (
        <section className="flex w-full flex-col items-center gap-4">
          <div className="mx-auto w-full max-w-md">
            <h2 className="text-lg font-semibold">Match the on-screen rectangle</h2>
            <p className="text-sm text-gray-600">
              Place your {referenceNoun} flat against the screen, long edge horizontal. Adjust the
              slider until the rectangle below matches its size exactly.
            </p>
          </div>
          {/* Deliberately unconstrained by the max-w-md text column above — the
              slider goes up to 2000px and the rectangle needs to actually reach
              that width on screen to be matchable against a physical object.
              overflow-x-auto lets it scroll rather than silently clip on narrow
              viewports instead of capping it with maxWidth. */}
          <div className="w-full overflow-x-auto">
            <div className="flex justify-center">
              <div
                className="shrink-0 rounded border-2 border-dashed border-blue-500 bg-blue-50"
                style={{ width: `${sliderPx}px`, height: '90px' }}
              />
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
            <input
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={1}
              value={sliderPx}
              onChange={(e) => setSliderPx(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500">{sliderPx}px wide</div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mx-auto flex w-full max-w-md flex-col gap-4">
          <h2 className="text-lg font-semibold">Confirm</h2>
          <p className="text-sm text-gray-700">
            Your screen is approximately <strong>{ppi.toFixed(0)} PPI</strong>.
          </p>
          <p className="text-xs text-gray-500">
            Typical laptop: 96–227 PPI · 4K monitor: 163–220 PPI
          </p>
          {ppiOutOfRange && (
            <p className="rounded bg-amber-50 p-3 text-xs text-amber-800">
              That's outside the expected 60–350 PPI range — the rectangle probably isn't matched
              to your object yet. Consider redoing the alignment.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
            >
              Redo
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
            >
              Confirm
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="flex w-full flex-col items-center gap-4">
          <div className="mx-auto w-full max-w-md">
            <h2 className="text-lg font-semibold">Viewing distance</h2>
            <p className="text-sm text-gray-600">Sit so your eyes are 40cm from the screen.</p>
          </div>
          <div className="w-full overflow-x-auto">
            <div className="flex justify-center">
              <div
                className="flex shrink-0 items-center justify-center rounded border border-gray-300 bg-gray-50 text-xs text-gray-500"
                style={{ width: `${400 * ppmm}px`, height: '32px' }}
              >
                40cm guide — print at 100% scale to check
              </div>
            </div>
          </div>
          <div className="mx-auto w-full max-w-md">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={distanceConfirmed}
                onChange={(e) => setDistanceConfirmed(e.target.checked)}
                className="mt-1"
              />
              I'm sitting approximately 40cm from the screen.
            </label>
            <button
              type="button"
              disabled={!distanceConfirmed}
              onClick={handleConfirm}
              className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Finish calibration
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
