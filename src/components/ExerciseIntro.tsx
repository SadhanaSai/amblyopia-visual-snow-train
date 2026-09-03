import type { ExerciseInfo } from '../data/exerciseInfo';

interface ExerciseIntroProps {
  info: ExerciseInfo;
  onStart: () => void;
  onBack: () => void;
}

export default function ExerciseIntro({ info, onStart, onBack }: ExerciseIntroProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <button type="button" onClick={onBack} className="self-start text-xs text-blue-600">
        &larr; Back
      </button>
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
