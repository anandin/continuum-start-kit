import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type ClassifierPayload = Record<string, unknown>;

interface SafetyEvent {
  id: string;
  sessionId: string | null;
  engagementId: string | null;
  userId: string | null;
  stage: string;
  decision: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  reason: string | null;
  classifierLabels: ClassifierPayload | null;
  inputSnippet: string | null;
  outputSnippet: string | null;
  templateUsed: string | null;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-stone-100 text-stone-700",
  low: "bg-emerald-50 text-emerald-800",
  medium: "bg-amber-50 text-amber-800",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-rose-100 text-rose-900",
};

const DECISION_COLORS: Record<string, string> = {
  allow: "bg-emerald-50 text-emerald-800",
  soften: "bg-amber-50 text-amber-800",
  block_with_template: "bg-orange-100 text-orange-900",
  escalate: "bg-rose-100 text-rose-900",
};

export default function AuditLog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const engagementId = searchParams.get("engagementId");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");

  const endpoint = engagementId
    ? `/api/clients/${engagementId}/safety-events`
    : "/api/twin/safety-events";

  const eventsQ = useQuery<SafetyEvent[]>({
    queryKey: [endpoint],
    queryFn: async () => (await apiRequest("GET", endpoint)).json(),
  });

  function clearEngagementFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete("engagementId");
    setSearchParams(next);
  }

  const filtered = (eventsQ.data || []).filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (decisionFilter !== "all" && e.decision !== decisionFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Safety Audit Log</h1>
            <p className="text-stone-600 text-sm">Every safety decision the twin has made. Critical events are escalations to crisis resources.</p>
          </div>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-stone-600 hover:text-stone-900">← Back to dashboard</button>
        </div>

        <div className="bg-white rounded-lg p-3 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
          <label className="text-sm text-stone-700 flex items-center gap-2">
            Severity:
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="border border-stone-300 rounded px-2 py-1 text-sm">
              <option value="all">All</option>
              <option value="info">info</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label className="text-sm text-stone-700 flex items-center gap-2">
            Decision:
            <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className="border border-stone-300 rounded px-2 py-1 text-sm">
              <option value="all">All</option>
              <option value="allow">allow</option>
              <option value="soften">soften</option>
              <option value="block_with_template">block_with_template</option>
              <option value="escalate">escalate</option>
            </select>
          </label>
          {engagementId && (
            <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-900 flex items-center gap-1">
              client: {engagementId.slice(0, 8)}…
              <button
                type="button"
                onClick={clearEngagementFilter}
                className="ml-1 text-amber-700 hover:text-amber-900"
                aria-label="Clear client filter"
              >
                ×
              </button>
            </span>
          )}
          <span className="text-xs text-stone-500 ml-auto">{filtered.length} events</span>
        </div>

        <div className="space-y-2">
          {filtered.map((e) => (
            <div key={e.id} className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[e.severity] || ""}`}>{e.severity}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${DECISION_COLORS[e.decision] || ""}`}>{e.decision}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600">{e.stage}</span>
                <span className="text-xs text-stone-400 ml-auto">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              {e.reason && <p className="text-sm text-stone-800">{e.reason}</p>}
              {e.inputSnippet && (
                <details className="mt-2">
                  <summary className="text-xs text-stone-500 cursor-pointer">Input snippet</summary>
                  <p className="text-xs text-stone-700 mt-1 italic">{e.inputSnippet}</p>
                </details>
              )}
              {e.outputSnippet && (
                <details className="mt-1">
                  <summary className="text-xs text-stone-500 cursor-pointer">Output snippet</summary>
                  <p className="text-xs text-stone-700 mt-1 italic">{e.outputSnippet}</p>
                </details>
              )}
              <ClassifierLabels labels={e.classifierLabels} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="bg-white rounded-lg p-8 text-center text-stone-500 shadow-sm">
              No matching safety events.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Render classifier signals: crisis categories, moderation flags, raw payload toggle. */
function ClassifierLabels({ labels }: { labels: ClassifierPayload | null }) {
  if (!labels || typeof labels !== "object") return null;
  if (Array.isArray(labels) && labels.length === 0) return null;
  if (!Array.isArray(labels) && Object.keys(labels).length === 0) return null;

  // Derive crisis categories from boolean-true keys (excluding meta) and
  // also accept categories[] for forward compatibility.
  const META_KEYS = new Set([
    "moderation", "flagged", "model", "categories", "category_scores",
    "confidence", "reason", "purpose", "kind", "source", "messageId",
    "internal", "moderation_run", "regex", "turnIndex",
  ]);
  const arrayCats: string[] = Array.isArray(labels.categories)
    ? labels.categories.filter((c: unknown) => typeof c === "string")
    : [];
  const flatCats: string[] = Object.entries(labels)
    .filter(([k, v]) => v === true && !META_KEYS.has(k))
    .map(([k]) => k);
  const cats: string[] = Array.from(new Set([...arrayCats, ...flatCats]));

  const conf =
    typeof labels.confidence === "number" ? labels.confidence : null;

  // Moderation payload — accept both flat (current) and nested (legacy) shapes.
  const modSrc: Record<string, unknown> | null =
    labels.moderation === true
      ? labels
      : labels.moderation && typeof labels.moderation === "object"
        ? (labels.moderation as Record<string, unknown>)
        : null;
  const modCats = modSrc && typeof modSrc.categories === "object" && modSrc.categories !== null
    ? (modSrc.categories as Record<string, unknown>)
    : null;
  const modScores = modSrc && typeof modSrc.category_scores === "object" && modSrc.category_scores !== null
    ? (modSrc.category_scores as Record<string, unknown>)
    : null;
  const modFlagged: string[] = modCats
    ? Object.entries(modCats).filter(([, v]) => v === true).map(([k]) => k)
    : [];
  const modTop: Array<[string, number]> = modScores
    ? Object.entries(modScores)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => [k, v as number] as [string, number])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  return (
    <div className="mt-2 border-t border-stone-100 pt-2 space-y-1">
      {cats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-stone-500">classifier</span>
          {cats.map((c) => (
            <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800">
              {c}
            </span>
          ))}
          {conf !== null && (
            <span className="text-xs text-stone-500">conf {conf.toFixed(2)}</span>
          )}
        </div>
      )}
      {(modFlagged.length > 0 || modTop.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-stone-500">moderation</span>
          {modFlagged.map((c) => (
            <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-800">
              {c}
            </span>
          ))}
          {modTop.map(([k, v]) => (
            <span key={`s-${k}`} className="text-xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
              {k} {v.toFixed(3)}
            </span>
          ))}
        </div>
      )}
      <details className="mt-1">
        <summary className="text-xs text-stone-500 cursor-pointer">Raw classifier payload</summary>
        <pre className="text-[11px] text-stone-700 mt-1 whitespace-pre-wrap break-words bg-stone-50 p-2 rounded">
{JSON.stringify(labels, null, 2)}
        </pre>
      </details>
    </div>
  );
}
