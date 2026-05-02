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

  const memQ = useQuery<Memory[]>({
    queryKey: [`/api/twin/memory/${engagementId}`],
    queryFn: async () => (await apiRequest("GET", `/api/twin/memory/${engagementId}`)).json(),
    enabled: !!engagementId,
  });

  const redactMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/twin/memory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/twin/memory/${engagementId}`] }),
  });

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Client Memory</h1>
            <p className="text-stone-600 text-sm">Everything the twin remembers about this client. Redact anything that shouldn't be there.</p>
          </div>
          <button onClick={() => navigate(-1)} className="text-sm text-stone-600 hover:text-stone-900">← Back</button>
        </div>

        {memQ.isLoading && <p className="text-stone-500">Loading…</p>}
        {memQ.data?.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center text-stone-500 shadow-sm">
            No memory entries yet. New entries are written when sessions end.
          </div>
        )}

        <div className="space-y-3">
          {memQ.data?.map((m) => (
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
                  <p className="text-stone-900">{m.content}</p>
                  <p className="text-xs text-stone-400 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => redactMut.mutate(m.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 shrink-0"
                  data-testid={`redact-${m.id}`}
                >
                  Redact
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
