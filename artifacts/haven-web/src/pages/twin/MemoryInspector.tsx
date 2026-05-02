import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Memory {
  id: string;
  engagementId: string;
  sessionId: string | null;
  kind: string;
  content: string;
  tags: string[];
  importance: number;
  createdAt: string;
  redactedAt: string | null;
}

const KIND_COLORS: Record<string, string> = {
  preference: "bg-sky-50 text-sky-800",
  boundary: "bg-rose-50 text-rose-800",
  fact: "bg-stone-100 text-stone-700",
  trigger: "bg-amber-50 text-amber-800",
  goal_progress: "bg-emerald-50 text-emerald-800",
  rapport: "bg-violet-50 text-violet-800",
};

export default function MemoryInspector() {
  const { engagementId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  const memQ = useQuery<Memory[]>({
    queryKey: [`/api/twin/memory/${engagementId}`],
    queryFn: async () => (await apiRequest("GET", `/api/twin/memory/${engagementId}`)).json(),
    enabled: !!engagementId,
  });

  const redactMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/twin/memory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/twin/memory/${engagementId}`] }),
  });

  const editMut = useMutation({
    mutationFn: async (args: { id: string; content: string }) =>
      apiRequest("PATCH", `/api/twin/memory/${args.id}`, { content: args.content }),
    onSuccess: () => {
      setEditId(null);
      setDraft("");
      qc.invalidateQueries({ queryKey: [`/api/twin/memory/${engagementId}`] });
    },
  });

  const safetyEventsQ = useQuery<unknown[]>({
    queryKey: [`/api/clients/${engagementId}/safety-events`],
    queryFn: async () =>
      (await apiRequest("GET", `/api/clients/${engagementId}/safety-events`)).json(),
    enabled: !!engagementId,
  });

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Client Memory</h1>
            <p className="text-stone-600 text-sm">
              Everything the twin remembers about this client. Edit or redact anything that shouldn't be there.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            {engagementId && (
              <button
                onClick={() => navigate(`/provider/twin/audit?engagementId=${engagementId}`)}
                className="text-sm text-stone-600 hover:text-stone-900"
                data-testid="link-client-safety-events"
              >
                Safety events ({safetyEventsQ.data?.length ?? 0})
              </button>
            )}
            <button onClick={() => navigate(-1)} className="text-sm text-stone-600 hover:text-stone-900">← Back</button>
          </div>
        </div>

        {memQ.isLoading && <p className="text-stone-500">Loading…</p>}
        {memQ.data?.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center text-stone-500 shadow-sm">
            No memory entries yet. New entries are written when sessions end.
          </div>
        )}

        <div className="space-y-3">
          {memQ.data?.map((m) => {
            const isEditing = editId === m.id;
            return (
              <div key={m.id} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${KIND_COLORS[m.kind] || "bg-stone-100 text-stone-700"}`}>{m.kind}</span>
                      {m.tags?.map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600">{t}</span>
                      ))}
                      <span className="text-xs text-stone-400">importance {m.importance.toFixed(2)}</span>
                    </div>
                    {isEditing ? (
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="w-full border border-stone-300 rounded p-2 text-sm"
                        rows={3}
                        data-testid={`edit-textarea-${m.id}`}
                      />
                    ) : (
                      <p className="text-stone-900 whitespace-pre-wrap">{m.content}</p>
                    )}
                    <p className="text-xs text-stone-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => editMut.mutate({ id: m.id, content: draft })}
                          disabled={editMut.isPending || !draft.trim() || draft === m.content}
                          className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          data-testid={`save-${m.id}`}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditId(null);
                            setDraft("");
                          }}
                          className="text-xs text-stone-600 hover:text-stone-900"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditId(m.id);
                            setDraft(m.content);
                          }}
                          className="text-xs text-stone-600 hover:text-stone-900"
                          data-testid={`edit-${m.id}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => redactMut.mutate(m.id)}
                          className="text-xs text-rose-600 hover:text-rose-800"
                          data-testid={`redact-${m.id}`}
                        >
                          Redact
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
