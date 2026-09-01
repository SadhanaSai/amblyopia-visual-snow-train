export interface ContraindicationAnswers {
  noPhotosensitiveEpilepsy: boolean;
  noRecentStrabismusSurgery: boolean;
  willStopIfSymptoms: boolean;
  understandsNotClinicalReplacement: boolean;
}

export const EMPTY_CONTRAINDICATIONS: ContraindicationAnswers = {
  noPhotosensitiveEpilepsy: false,
  noRecentStrabismusSurgery: false,
  willStopIfSymptoms: false,
  understandsNotClinicalReplacement: false,
};

interface ItemDef {
  key: keyof ContraindicationAnswers;
  label: string;
  // The photosensitive-epilepsy item is deliberately non-blocking: the spec
  // both requires all four checked to proceed AND says this item "locks the
  // photopsia module if unchecked" — those can't both be true for someone
  // who actually has photosensitive epilepsy. We resolve it by letting this
  // one item stay unchecked and continue (locking that one exercise later),
  // while the other three remain hard safety gates.
  blocking: boolean;
  helper?: string;
}

const ITEMS: ItemDef[] = [
  {
    key: 'noPhotosensitiveEpilepsy',
    label: 'I do not have photosensitive epilepsy',
    blocking: false,
    helper:
      'Leave unchecked if this applies to you — you can still continue. The photopsia desensitization exercise will be locked; everything else stays available.',
  },
  {
    key: 'noRecentStrabismusSurgery',
    label: 'I have not had strabismus surgery in the past 6 months',
    blocking: true,
  },
  {
    key: 'willStopIfSymptoms',
    label: 'I will stop immediately if I experience double vision, headache, or nausea',
    blocking: true,
  },
  {
    key: 'understandsNotClinicalReplacement',
    label: 'I understand this app does not replace clinical care',
    blocking: true,
  },
];

export function allRequiredChecked(answers: ContraindicationAnswers): boolean {
  return ITEMS.filter((item) => item.blocking).every((item) => answers[item.key]);
}

interface ContraindicationCheckProps {
  answers: ContraindicationAnswers;
  onChange: (answers: ContraindicationAnswers) => void;
}

export default function ContraindicationCheck({ answers, onChange }: ContraindicationCheckProps) {
  function toggle(key: keyof ContraindicationAnswers) {
    onChange({ ...answers, [key]: !answers[key] });
  }

  return (
    <div className="flex flex-col gap-3">
      {ITEMS.map((item) => (
        <div key={item.key}>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={answers[item.key]}
              onChange={() => toggle(item.key)}
              className="mt-1"
            />
            {item.label}
          </label>
          {item.helper && !answers[item.key] && (
            <p className="ml-6 mt-1 text-xs text-gray-400">{item.helper}</p>
          )}
        </div>
      ))}
      {!allRequiredChecked(answers) && (
        <p className="text-xs text-gray-400">The three safety items above must be checked to proceed.</p>
      )}
    </div>
  );
}
