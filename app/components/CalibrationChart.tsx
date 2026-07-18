import type { CalibBin } from "@/lib/record";

// Reliability diagram: predicted probability (x) vs observed frequency (y), one dot
// per bin, dashed identity line = perfect calibration. Server-rendered static SVG.
// Series green #3da95c is palette-validated against the dark panel surface.
const W = 460, H = 400, PAD = { t: 18, r: 16, b: 44, l: 48 };
const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b;
const SERIES = "#3da95c";

const sx = (v: number) => PAD.l + v * PW;
const sy = (v: number) => PAD.t + (1 - v) * PH;

export function CalibrationChart({ bins, caption }: { bins: CalibBin[]; caption: string }) {
  const dots = bins.filter((b) => b.n > 0);
  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Calibration chart: ${caption}`}
        style={{ width: "100%", maxWidth: 560, height: "auto", display: "block" }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={sx(0)} x2={sx(1)} y1={sy(t)} y2={sy(t)} stroke="var(--rule)" strokeWidth="1" />
            <text x={sx(0) - 8} y={sy(t) + 3.5} textAnchor="end" className="axis-label">{Math.round(t * 100)}%</text>
            <text x={sx(t)} y={H - PAD.b + 18} textAnchor="middle" className="axis-label">{Math.round(t * 100)}%</text>
          </g>
        ))}
        <line x1={sx(0)} x2={sx(1)} y1={sy(0)} y2={sy(1)} stroke="var(--faint)" strokeWidth="1.5" strokeDasharray="5 5" />
        <text
          x={sx(0.56)} y={sy(0.56) - 9}
          transform={`rotate(${-Math.atan2(PH, PW) * 180 / Math.PI}, ${sx(0.56)}, ${sy(0.56) - 9})`}
          className="axis-label"
        >
          perfect calibration
        </text>
        <polyline
          fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" opacity=".55"
          points={dots.map((b) => `${sx(b.avgPred)},${sy(b.obsFreq)}`).join(" ")}
        />
        {dots.map((b) => (
          <circle key={b.range[0]} cx={sx(b.avgPred)} cy={sy(b.obsFreq)} r="5"
            fill={SERIES} stroke="var(--panel)" strokeWidth="2">
            <title>
              {`Predicted ${(b.avgPred * 100).toFixed(1)}% → happened ${(b.obsFreq * 100).toFixed(1)}% (${b.n.toLocaleString("en-US")} outcomes)`}
            </title>
          </circle>
        ))}
        <text x={PAD.l} y={H - 6} className="axis-label">Predicted probability</text>
        <text x={14} y={PAD.t - 4} className="axis-label">Observed frequency</text>
      </svg>
      <figcaption className="foot-src">{caption}</figcaption>
      <details style={{ marginTop: 8 }}>
        <summary className="foot-src" style={{ cursor: "pointer" }}>View as table</summary>
        <table className="data" style={{ marginTop: 8, maxWidth: 460 }}>
          <thead><tr><th>Bin</th><th className="r">Outcomes</th><th className="r">Avg predicted</th><th className="r">Observed</th></tr></thead>
          <tbody>
            {dots.map((b) => (
              <tr key={b.range[0]}>
                <td className="num">{Math.round(b.range[0] * 100)}–{Math.round(b.range[1] * 100)}%</td>
                <td className="num r">{b.n.toLocaleString("en-US")}</td>
                <td className="num r">{(b.avgPred * 100).toFixed(1)}%</td>
                <td className="num r">{(b.obsFreq * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
