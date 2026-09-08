/** 维度得分条：颜色按得分比例区分 */
export function ScoreBar({
  name,
  score,
  maxScore,
  weight,
}: {
  name: string;
  score: number;
  maxScore: number;
  weight?: number;
}) {
  const ratio = maxScore > 0 ? Math.min(1, Math.max(0, score / maxScore)) : 0;
  const color = ratio >= 0.8 ? 'bg-green-500' : ratio >= 0.5 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-700">
          {name}
          {typeof weight === 'number' ? (
            <span className="ml-1 text-xs text-slate-400">权重 {Math.round(weight * 100)}%</span>
          ) : null}
        </span>
        <span className="tabular-nums text-slate-600">
          {score} / {maxScore}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
        <div className={`h-full rounded ${color}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
