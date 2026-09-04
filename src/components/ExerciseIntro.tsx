import { useInstructionTextScale } from '../hooks/useInstructionTextScale';
import type { ExerciseInfo } from '../data/exerciseInfo';

interface ExerciseIntroProps {
  info: ExerciseInfo;
  onStart: () => void;
  onBack: () => void;
}

export default function ExerciseIntro({ info, onStart, onBack }: ExerciseIntroProps) {
  const { scale, increase, decrease, canIncrease, canDecrease } = useInstructionTextScale();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-blue-600">
          &larr; Back
        </button>
        <div className="flex items-center gap-1 text-gray-500">
          <span className="text-xs">Text size</span>
          <button
            type="button"
            onClick={decrease}
            disabled={!canDecrease}
            aria-label="Decrease text size"
            className="h-6 w-6 rounded border border-gray-300 text-xs font-semibold disabled:opacity-30"
          >
            A&#8211;
          </button>
          <button
            type="button"
            onClick={increase}
            disabled={!canIncrease}
            aria-label="Increase text size"
            className="h-6 w-6 rounded border border-gray-300 text-sm font-semibold disabled:opacity-30"
          >
            A+
          </button>
        </div>
      </div>

      {/* `zoom` scales this instruction text only — it never wraps a canvas, so
          it can't touch calibrated stimulus sizing the way browser zoom does. */}
      <div className="flex flex-col gap-4" style={{ zoom: scale }}>
        <h2 className="text-lg font-semibold">{info.title}</h2>
        <p className="text-sm text-gray-600">{info.summary}</p>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            How to use it
          </div>
          <ul className="flex flex-col gap-2">
            {info.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>

        {info.duration && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Typical length: {info.duration}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
      >
        Got it — continue
      </button>
    </div>
  );
}
