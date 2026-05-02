import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/queryClient";

interface CalibrationSession {
  id: string;
  scenarioName: string;
  syntheticClientProfile: any;
  transcript: any[];
  status: "in_progress" | "completed" | "abandoned";
  createdAt: string;
}

const SCENARIOS = [
  { name: "Anxious about a job change", profile: { presenting: "considering leaving a stable job for a startup", tone: "anxious, second-guessing" } },
  { name: "Recurring relationship conflict", profile: { presenting: "same fight with partner keeps happening", tone: "frustrated, tired" } },
  { name: "Burnout & boundaries", profile: { presenting: "exhausted, overcommitted, can't say no", tone: "flat, depleted" } },
  { name: "Grief, six months in", profile: { presenting: "lost a parent six months ago", tone: "tender, sometimes numb" } },
];

export default function Calibration() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sessionsQ = useQuery<CalibrationSession[]>({
    queryKey: ["/api/twin/calibration"],
    queryFn: async () => (await apiRequest("GET", "/api/twin/calibration")).json(),
  });

  const activeQ = useQuery<CalibrationSession>({
    queryKey: ["/api/twin/calibration", activeId],
    queryFn: async () => (await apiRequest("GET", `/api/twin/calibration/${activeId}`)).json(),
    enabled: !!activeId,
  });

  const createMut = useMutation({
    mutationFn: async (s: typeof SCENARIOS[number]) => {
      const res = await apiRequest("POST", "/api/twin/calibration", {
        scenarioName: s.name,
        syntheticClientProfile: s.profile,
      });
      return res.json();
    },
    onSuccess: (s: CalibrationSession) => {
      qc.invalidateQueries({ queryKey: ["/api/twin/calibration"] });
      setActiveId(s.id);
    },
  });

  const turnMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/twin/calibration/${activeId}/turn`)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/twin/calibration", activeId] }),
  });

  const labelMut = useMutation({
    mutationFn: async (vars: { turnIndex: number; label: string; approvedEdit?: string }) => {
      return (await apiRequest("POST", `/api/twin/calibration/${activeId}/approve`, vars)).json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/twin/calibration", activeId] }),
  });

  const completeMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/twin/calibration/${activeId}/complete`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/calibration"] });
      qc.invalidateQueries({ queryKey: ["/api/twin/calibration", activeId] });
    },
  });

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Calibration</h1>
            <p className="text-stone-600 text-sm">Practice the twin against synthetic clients. Your edits become the persona.</p>
          </div>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-stone-600 hover:text-stone-900">← Back to dashboard</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h2 className="font-medium text-stone-900 mb-3">Start a new run</h2>
              <div className="space-y-2">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => createMut.mutate(s)}
                    disabled={createMut.isPending}
                    className="w-full text-left px-3 py-2 rounded border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-sm"
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <h3 className="font-medium text-stone-900 mt-6 mb-3">Past runs</h3>
              <div className="space-y-1 max-h-96 overflow-auto">
                {sessionsQ.data?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-stone-100 ${activeId === s.id ? "bg-amber-50 text-amber-900" : "text-stone-700"}`}
                  >
                    <div className="truncate">{s.scenarioName}</div>
                    <div className="text-xs text-stone-500">{(s.transcript || []).length} turns · {s.status}</div>
                  </button>
                ))}
                {sessionsQ.data?.length === 0 && <p className="text-xs text-stone-500">No runs yet — pick a scenario above.</p>}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {!activeId && (
              <div className="bg-white rounded-lg p-8 shadow-sm text-center text-stone-500">
                Pick a scenario to begin a calibration run.
              </div>
            )}
            {activeId && activeQ.data && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="font-medium text-stone-900">{activeQ.data.scenarioName}</h2>
                    <p className="text-xs text-stone-500">Profile: {JSON.stringify(activeQ.data.syntheticClientProfile)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => turnMut.mutate()}
                      disabled={turnMut.isPending || activeQ.data.status !== "in_progress"}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      {turnMut.isPending ? "Generating…" : "Next turn"}
                    </button>
                    {activeQ.data.status === "in_progress" && (
                      <button
                        onClick={() => completeMut.mutate()}
                        className="px-3 py-1.5 border border-stone-300 hover:bg-stone-100 rounded text-sm"
                      >
                        Finish run
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {(activeQ.data.transcript || []).map((t: any, i: number) => (
                    <TurnCard
                      key={i}
                      turn={t}
                      index={i}
                      onLabel={(label, approvedEdit) => labelMut.mutate({ turnIndex: i, label, approvedEdit })}
                      busy={labelMut.isPending}
                    />
                  ))}
                  {(activeQ.data.transcript || []).length === 0 && (
                    <p className="text-sm text-stone-500">No turns yet. Click "Next turn" to begin the conversation.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TurnCard({ turn, index, onLabel, busy }: { turn: any; index: number; onLabel: (label: string, approvedEdit?: string) => void; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(turn.draft);

  return (
    <div className="border border-stone-200 rounded-lg p-3">
      <div className="text-xs text-stone-500 mb-2">Turn {index + 1}</div>
      <div className="mb-2">
        <div className="text-xs uppercase tracking-wide text-stone-500">Synthetic client</div>
        <div className="text-stone-900">{turn.client}</div>
      </div>
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wide text-stone-500">Twin's draft {turn.templated && <span className="ml-1 text-amber-700">(templated)</span>}</div>
        {!editing ? (
          <div className="text-stone-900 whitespace-pre-wrap">{turn.draft}</div>
        ) : (
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            className="w-full border border-stone-300 rounded p-2 text-sm"
            rows={4}
          />
        )}
      </div>
      {turn.label && (
        <div className="text-xs text-stone-600 mb-2">
          Labeled: <span className="font-medium">{turn.label}</span>
          {turn.approvedEdit && turn.approvedEdit !== turn.draft && (
            <div className="mt-1 italic text-stone-700">Approved: {turn.approvedEdit}</div>
          )}
        </div>
      )}
      {!turn.label && (
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => onLabel("this_is_me")} className="px-2 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded">
            This is me
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (!editing) { setEditing(true); return; }
              onLabel("needs_edit", edited);
              setEditing(false);
            }}
            className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 rounded"
          >
            {editing ? "Save edit" : "Needs edit"}
          </button>
          <button disabled={busy} onClick={() => onLabel("not_me")} className="px-2 py-1 text-xs bg-stone-200 hover:bg-stone-300 text-stone-800 rounded">
            Not me
          </button>
          <button disabled={busy} onClick={() => onLabel("never_say_this")} className="px-2 py-1 text-xs bg-rose-100 hover:bg-rose-200 text-rose-900 rounded">
            Never say this
          </button>
        </div>
      )}
    </div>
  );
}
