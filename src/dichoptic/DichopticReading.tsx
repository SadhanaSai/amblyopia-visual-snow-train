import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { useAdaptiveICR } from '../hooks/useAdaptiveICR';
import { compositeAnaglyph, renderDichopticText } from '../utils/canvasUtils';
import { strongEyeBaseColor } from '../utils/colorUtils';
import { READING_CORPUS, type ReadingPassage } from '../data/readingCorpus';

const HISTORY_KEY = 'reading_history';
const NO_REPEAT_DAYS = 7;
const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 420;
const MAX_LINE_WIDTH = 680;
const FONT_SIZE = 20;
const LINE_HEIGHT = 36;
// spec named 0.2 as the reading floor (vs training's 0.1), but that number
// was tuned for blending toward a *white* backdrop, where it worked out to
// only ~6% perceived luminance contrast against the page — essentially
// invisible, worse once real anaglyph glasses (imperfect channel
// separation, real light loss) dim it further. Text now renders on black
// (see the effect below), where contrast reduction means "dimmer" rather
// than "paler," but the floor still needs to be well above the letter of
// the old number to stay legible through actual glasses rather than a
// theoretical perfect filter.
const MIN_READING_ICR = 0.5;

/** Scales a color's brightness toward black by `icr` (1 = full brightness). */
function blendTowardBlack([r, g, b]: [number, number, number], icr: number): string {
  const clamped = Math.min(1, Math.max(0, icr));
  const scale = (c: number) => Math.round(c * clamped);
  return `rgb(${scale(r)}, ${scale(g)}, ${scale(b)})`;
}

type AlternationMode = 'word' | 'line' | 'phrase';

const MODE_LABELS: Record<AlternationMode, string> = {
  line: 'Line alternation (easiest)',
  word: 'Word alternation (default)',
  phrase: 'Phrase alternation (advanced)',
};

function loadHistory(): Record<string, string> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function pickPassage(): ReadingPassage {
  const history = loadHistory();
  const now = Date.now();
  const eligible = READING_CORPUS.filter((p) => {
    const last = history[p.id];
    if (!last) return true;
    return (now - new Date(last).getTime()) / 86_400_000 >= NO_REPEAT_DAYS;
  });
  const pool = eligible.length > 0 ? eligible : READING_CORPUS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function markShown(id: string): void {
  const history = loadHistory();
  history[id] = new Date().toISOString();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

type Phase = 'calib-check' | 'help' | 'mode-select' | 'reading' | 'comprehension' | 'session-done';

interface DichopticReadingProps {
  onComplete?: () => void;
}

export default function DichopticReading({ onComplete }: DichopticReadingProps) {
  const { profile, updateProfile } = useProfile();
  const { logSession } = useSessionLogger();
  const lensType = profile.lensType ?? 'red-cyan';
  const adaptiveICR = useAdaptiveICR();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>('calib-check');
  const [mode, setMode] = useState<AlternationMode>('word');
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [passagesCompleted, setPassagesCompleted] = useState(0);

  const readingIcr = Math.max(MIN_READING_ICR, adaptiveICR.currentICR);

  useEffect(() => {
    if (phase !== 'reading' || !passage) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Render each eye's words onto its own transparent offscreen canvas,
    // then combine with compositeAnaglyph() onto a black backdrop — the
    // same technique GratingFusion/LetterDiscrimination/FixationStability
    // use. Drawing straight onto a white canvas (the old approach) meant a
    // "blocked" word never truly disappeared through the wrong lens (it
    // showed as a dark shape on the lens-tinted white page) and the
    // "passed" word's contrast was crushed by blending toward that same
    // white. Both eyes' passes share identical layout options (only
    // `onlyEye` differs) so word positions line up pixel-for-pixel.
    const weak = document.createElement('canvas');
    weak.width = canvas.width;
    weak.height = canvas.height;
    const strong = document.createElement('canvas');
    strong.width = canvas.width;
    strong.height = canvas.height;

    const textOpts = {
      mode,
      weakEyeColor: '#FF0000',
      strongEyeColor: blendTowardBlack(strongEyeBaseColor(lensType), readingIcr),
      canvasWidth: MAX_LINE_WIDTH,
      lineHeight: LINE_HEIGHT,
      fontSize: FONT_SIZE,
      fontFamily: 'Georgia, serif',
    };
    renderDichopticText(weak.getContext('2d')!, passage.text, { ...textOpts, onlyEye: 'weak' });
    renderDichopticText(strong.getContext('2d')!, passage.text, { ...textOpts, onlyEye: 'strong' });
    compositeAnaglyph(weak, strong, ctx);
  }, [phase, passage, mode, readingIcr, lensType]);

  function startPassage() {
    const next = pickPassage();
    setPassage(next);
    setStartTime(performance.now());
    setPhase('reading');
  }

  function finishReading() {
    if (!passage) return;
    const elapsedMinutes = (performance.now() - startTime) / 60_000;
    const wordCount = passage.text.split(/\s+/).filter(Boolean).length;
    setWpm(Math.round(wordCount / Math.max(elapsedMinutes, 1 / 60)));
    setAnswers(new Array(passage.questions.length).fill(-1));
    setPhase('comprehension');
  }

  function submitComprehension() {
    if (!passage) return;
    const correct = answers.filter((a, i) => a === passage.questions[i].correctIndex).length;
    const accuracy = correct / passage.questions.length;
    markShown(passage.id);
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'dichoptic',
      exercise: 'DichopticReading',
      paradigm: mode,
      displayMode: 'anaglyph',
      weakEye: profile.weakEye,
      durationSeconds: Math.round((performance.now() - startTime) / 1000),
      trials: 1,
      accuracy,
      icrUsed: readingIcr,
      notes: `passageId=${passage.id} wpm=${wpm}`,
    });
    setPassagesCompleted((c) => c + 1);
    setPhase('session-done');
  }

  if (phase === 'calib-check') {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Dichoptic Reading — glasses check</h2>
        {/* Black backdrop, not white: on white, a lens's blocked color still
            shows as a dark shape against the lens-tinted page instead of
            truly disappearing, and the passed color's contrast gets crushed
            toward the same white. Black is what makes each channel either
            fully vanish or read at full brightness through the matching
            lens — the same reason the actual passage below renders through
            compositeAnaglyph() instead of drawing straight onto white. */}
        <div className="flex h-40 overflow-hidden rounded border border-gray-200 bg-black">
          <div className="flex flex-1 items-center justify-center text-xl font-bold text-[#FF0000]">
            RED
          </div>
          <div className="flex flex-1 items-center justify-center text-xl font-bold text-[#00FF00]">
            GREEN
          </div>
          <div className="flex flex-1 items-center justify-center text-xl font-bold text-[#00FFFF]">
            CYAN
          </div>
        </div>
        <p className="text-sm text-gray-600">
          With glasses on — can you see RED but not GREEN or CYAN with your weak eye, and only one
          of GREEN/CYAN (not RED) with your other eye?
        </p>
        <p className="text-xs text-gray-500">
          Anaglyph glasses come in two standards: <strong>red/cyan</strong> and{' '}
          <strong>red/green</strong>. Whichever one of GREEN or CYAN comes through clearly with
          your non-weak eye tells you which lens you have — set it below so the app renders the
          matching color instead of one that leaks through your actual lens.
        </p>
        <div className="flex gap-2">
          {(['red-cyan', 'red-green'] as const).map((lt) => (
            <button
              key={lt}
              type="button"
              onClick={() => updateProfile({ lensType: lt })}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                lensType === lt
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              {lt === 'red-cyan' ? 'Red / Cyan' : 'Red / Green'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPhase('mode-select')}
            className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
          >
            Yes, ready
          </button>
          <button
            type="button"
            onClick={() => setPhase('help')}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
          >
            Something looks wrong
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'help') {
    const weakLens = 'red';
    const strongLens = lensType === 'red-green' ? 'green' : 'cyan';
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Glasses orientation</h2>
        <p className="text-sm text-gray-600">
          Your <strong>{profile.weakEye}</strong> eye is your weak eye and should look through the{' '}
          <strong>{weakLens}</strong> lens. Your other eye should look through the{' '}
          <strong>{strongLens}</strong> lens. If you can see both RED and {strongLens.toUpperCase()}{' '}
          with the same eye, try flipping the glasses around.
        </p>
        <button
          type="button"
          onClick={() => setPhase('calib-check')}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Back
        </button>
      </div>
    );
  }

  if (phase === 'mode-select') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Choose alternation mode</h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(MODE_LABELS) as AlternationMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg border p-3 text-left text-sm ${
                mode === m ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={startPassage}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Start reading
        </button>
      </div>
    );
  }

  if (phase === 'reading' && passage) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="mx-auto w-full max-w-2xl rounded border border-gray-200 bg-black"
          onClick={finishReading}
        />
        <button
          type="button"
          onClick={finishReading}
          className="mx-auto rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white"
        >
          Next
        </button>
      </div>
    );
  }

  if (phase === 'comprehension' && passage) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Quick check</h2>
        {passage.questions.map((q, qi) => (
          <div key={qi} className="flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-800">{q.question}</div>
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                type="button"
                onClick={() =>
                  setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
                }
                className={`rounded-lg border p-2 text-left text-sm ${
                  answers[qi] === oi ? 'border-blue-600 bg-blue-50' : 'border-gray-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        ))}
        <button
          type="button"
          disabled={answers.some((a) => a === -1)}
          onClick={submitComprehension}
          className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Nice reading</h2>
      <p className="text-sm text-gray-700">Reading speed: ~{wpm} words/minute</p>
      <p className="text-sm text-gray-700">Passages this session: {passagesCompleted}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={startPassage}
          className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700"
        >
          Read another
        </button>
        <button
          type="button"
          onClick={() => onComplete?.()}
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Finish
        </button>
      </div>
    </div>
  );
}
