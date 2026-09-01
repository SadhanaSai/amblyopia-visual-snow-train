import { useState } from 'react';
import { hslaFromControls } from '../utils/colorUtils';

// NOT_IMPLEMENTED: Intuitive Colorimeter precision tint matching
//   Requires clinical hardware (IC device, ~$15,000)
//   Reference: Rutner & Ciuffreda 2023, Vis. Dev. Rehab.
// NOT_IMPLEMENTED: FL-41 / BPI-Omega tint prescription
//   Requires optometrist assessment and fitting

const ZONES = [
  { start: 240, end: 280, label: 'Blue-violet', note: 'May worsen symptoms', tone: 'warn' as const },
  { start: 30, end: 60, label: 'Orange-yellow (FL-41 range)', note: 'May reduce symptoms', tone: 'good' as const },
  { start: 170, end: 200, label: 'Turquoise-blue', note: 'May reduce symptoms', tone: 'good' as const },
];

export default function ChromaticSimulator() {
  const [hue, setHue] = useState(45);
  const [saturation, setSaturation] = useState(50);
  const [opacity, setOpacity] = useState(30);

  const overlayColor = hslaFromControls(hue, saturation, opacity);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold">Chromatic Simulator</h2>
      <p className="text-xs text-gray-500">
        Educational and exploratory only — this tool does not generate a prescription.
      </p>

      <div className="relative overflow-hidden rounded-lg border border-gray-200">
        <div className="grid grid-cols-6 gap-0 p-4" style={{ backgroundColor: '#F5F5F5' }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="h-8 border border-gray-300 bg-white" />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: overlayColor }} />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>Hue</span>
          <span>{hue}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={hue}
          onChange={(e) => setHue(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-400">
          {ZONES.map((z) => (
            <span
              key={z.label}
              className={z.tone === 'warn' ? 'text-amber-600' : 'text-emerald-600'}
            >
              {z.start}-{z.end}°: {z.label} — {z.note}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>Saturation</span>
          <span>{saturation}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={saturation}
          onChange={(e) => setSaturation(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>Opacity</span>
          <span>{opacity}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={60}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        <p>Tint selection requires an optometrist with an Intuitive Colorimeter.</p>
        <p className="mt-1">This tool is for education and exploration only.</p>
        <p className="mt-1">No prescription or recommendation is generated here.</p>
      </div>
    </div>
  );
}
