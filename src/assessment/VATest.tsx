import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../profile/ProfileContext';
import { useViewingCalibration } from '../hooks/useViewingCalibration';
import { useSessionLogger } from '../hooks/useSessionLogger';
import { drawSloanLetter, SLOAN_LETTERS } from '../utils/canvasUtils';

const ROWS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1];
const START_INDEX = ROWS.indexOf(0.5);
const LETTERS_PER_ROW = 5;

function shuffledDeck(): string[] {
  const deck = [...SLOAN_LETTERS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const CLINICAL_CONTEXT = [
  { logMAR: '0.0', snellen: '20/20', note: 'normal' },
  { logMAR: '0.1', snellen: '20/25', note: 'mild reduction' },
  { logMAR: '0.3', snellen: '20/40', note: 'moderate' },
  { logMAR: '0.5', snellen: '20/60', note: 'significant' },
  { logMAR: '1.0', snellen: '20/200', note: 'legal blindness threshold' },
];

interface VATestProps {
  onComplete?: () => void;
}

export default function VATest({ onComplete }: VATestProps) {
  const { profile } = useProfile();
  const { degToPx, ppmm } = useViewingCalibration();
  const { logVA, logSession } = useSessionLogger();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAtRef = useRef(performance.now());

  // A shuffled deck drawn from without replacement, reshuffled only once
  // exhausted, so the same letters can't cluster on adjacent rows the way
  // independent per-row sampling from the full 10-letter pool did (making
  // rows easy to pattern-match against each other).
  const deckRef = useRef<string[]>([]);
  function drawLetters(n: number): string[] {
    const chosen: string[] = [];
    for (let i = 0; i < n; i++) {
      if (deckRef.current.length === 0) deckRef.current = shuffledDeck();
      chosen.push(deckRef.current.pop()!);
    }
    return chosen;
  }

  const [coverConfirmed, setCoverConfirmed] = useState(false);
  const [rowIndex, setRowIndex] = useState(START_INDEX);
  const [currentLetters, setCurrentLetters] = useState<string[]>(() =>
    drawLetters(LETTERS_PER_ROW),
  );
  const [input, setInput] = useState('');
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const [bestPassedIndex, setBestPassedIndex] = useState<number | null>(null);
  const [lettersCorrectPerRow, setLettersCorrectPerRow] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [finalLogMAR, setFinalLogMAR] = useState<number | null>(null);

  const strongEyeLabel = profile.weakEye === 'left' ? 'right eye' : 'left eye';

  useEffect(() => {
    if (!coverConfirmed || done) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const logMAR = ROWS[rowIndex];
    // 5 arcmin = 1 letter height at logMAR 0.0
    const heightPx = degToPx((Math.pow(10, logMAR) / 60) * 5);
    const spacing = canvas.width / (LETTERS_PER_ROW + 1);
    currentLetters.forEach((letter, i) => {
      drawSloanLetter(ctx, letter, {
        centerX: spacing * (i + 1),
        centerY: canvas.height / 2,
        // Only a floor against zero/negative sizes — a real floor here (the
        // old code clamped to 8px) silently made every row from 0.4 logMAR
        // down to -0.1 render at the exact same size on typical screen
        // densities, since their true physical size at 40cm viewing
        // distance is under 8px. That's over half the row range collapsing
        // to one size right where the test should be getting harder.
        sizePx: Math.max(1.5, heightPx),
        color: '#111111',
      });
    });
  }, [coverConfirmed, done, rowIndex, currentLetters, degToPx]);

  function finish(finalIndex: number, correctPerRow: Record<string, number>) {
    const logMAR = ROWS[Math.max(0, finalIndex)];
    logVA({ date: new Date().toISOString(), logMAR, lettersCorrectPerRow: correctPerRow, eye: 'weak', ppmm });
    logSession({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      module: 'assessment',
      exercise: 'VATest',
      weakEye: profile.weakEye,
      durationSeconds: Math.round((performance.now() - startedAtRef.current) / 1000),
      trials: Object.keys(correctPerRow).length,
      staircaseThreshold: logMAR,
      thresholdUnit: 'logMAR',
    });
    setFinalLogMAR(logMAR);
    setDone(true);
    // onComplete is deferred to the "Done" button below, not called here:
    // calling it immediately would have the parent unmount this component
    // in the same commit, so the results screen (score + clinical context)
    // would never actually be visible to the user.
  }

  function submitRow() {
    const guesses = input.toUpperCase().replace(/[^A-Z]/g, '').split('');
    let correct = 0;
    currentLetters.forEach((letter, i) => {
      if (guesses[i] === letter) correct++;
    });
    const key = ROWS[rowIndex].toFixed(1);
    const updatedCorrectPerRow = { ...lettersCorrectPerRow, [key]: correct };
    setLettersCorrectPerRow(updatedCorrectPerRow);

    if (correct >= 4) {
      setBestPassedIndex(rowIndex);
      setConsecutiveFails(0);
      const nextIndex = rowIndex + 1;
      if (nextIndex >= ROWS.length) {
        finish(rowIndex, updatedCorrectPerRow);
        return;
      }
      setRowIndex(nextIndex);
      setCurrentLetters(drawLetters(LETTERS_PER_ROW));
      setInput('');
      return;
    }

    if (correct <= 2) {
      const fails = consecutiveFails + 1;
      setConsecutiveFails(fails);
      if (fails >= 2) {
        finish(bestPassedIndex ?? Math.max(0, rowIndex - 1), updatedCorrectPerRow);
        return;
      }
      setRowIndex(Math.max(0, rowIndex - 1));
      setCurrentLetters(drawLetters(LETTERS_PER_ROW));
      setInput('');
      return;
    }

    // Exactly 3/5 — the spec only defines pass (4/5) and fail (2/5)
    // thresholds. Treat this borderline case as a retry at the same row
    // rather than silently picking a direction.
    setCurrentLetters(drawLetters(LETTERS_PER_ROW));
    setInput('');
  }

  if (!coverConfirmed) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Visual Acuity Test</h2>
        <p className="text-sm text-gray-600">
          Cover your {strongEyeLabel} completely before starting.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" onChange={(e) => setCoverConfirmed(e.target.checked)} />
          I've covered my {strongEyeLabel}
        </label>
      </div>
    );
  }

  if (done && finalLogMAR !== null) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Test complete</h2>
        <p className="text-sm text-gray-700">
          Score: <strong>{finalLogMAR.toFixed(1)} logMAR</strong>
        </p>
        <table className="w-full text-xs text-gray-500">
          <tbody>
            {CLINICAL_CONTEXT.map((r) => (
              <tr key={r.logMAR}>
                <td className="py-0.5 pr-3">{r.logMAR} logMAR</td>
                <td className="py-0.5 pr-3">{r.snellen}</td>
                <td className="py-0.5">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400">
          A 0.1 improvement = 1 line improvement on a clinical chart.
        </p>
        <button
          type="button"
          onClick={() => onComplete?.()}
          className="mt-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Visual Acuity Test — weak eye</h2>
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        className="w-full rounded border border-gray-200 bg-white"
      />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submitRow()}
        placeholder="Type the 5 letters you see"
        maxLength={5}
        className="rounded border border-gray-300 p-2 text-center text-lg uppercase tracking-widest"
        autoFocus
      />
      <button
        type="button"
        onClick={submitRow}
        className="rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
      >
        Submit
      </button>
      <div className="text-xs text-gray-400">Row: {ROWS[rowIndex].toFixed(1)} logMAR</div>
    </div>
  );
}
