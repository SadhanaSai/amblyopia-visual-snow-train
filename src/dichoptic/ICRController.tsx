import { useState } from 'react';
import { useAdaptiveICR } from '../hooks/useAdaptiveICR';

const TREND_ARROWS: Record<string, string> = {
  improving: '↑',
  stable: '→',
  regressing: '↓',
};

export default function ICRController() {
  const { currentICR, balanceLevel, trend, setManualICR } = useAdaptiveICR();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Balance level
          </div>
          <div className="text-2xl font-semibold text-gray-900">
            {balanceLevel}
            <span className="ml-1 text-sm font-normal text-gray-400">/10</span>
          </div>
        </div>
        <div
          className={`text-lg ${
            trend === 'improving'
              ? 'text-green-600'
              : trend === 'regressing'
                ? 'text-amber-600'
                : 'text-gray-400'
          }`}
          title={trend}
        >
          {TREND_ARROWS[trend]}
        </div>
      </div>

      {trend === 'regressing' && (
        <p className="mt-2 text-xs text-amber-700">
          Recent thresholds have dropped — consider a shorter session or checking for fatigue.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-3 text-xs font-medium text-blue-600"
      >
        {showAdvanced ? 'Hide advanced' : 'Advanced: set manually'}
      </button>

      {showAdvanced && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={currentICR}
            onChange={(e) => setManualICR(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500">ICR: {currentICR.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
