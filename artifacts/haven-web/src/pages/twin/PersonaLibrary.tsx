import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PersonaExample {
  id: string;
  source: string;
  scenario: string;
  approvedResponse: string;
  rejectedResponse: string | null;
  notes: string | null;
  tags: string[];
  weight: number;
  createdAt: string;
}

export default function PersonaLibrary() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [scenario, setScenario] = useState("");
  const [approvedResponse, setApprovedResponse] = useState("");
  const [tags, setTags] = useState("");

  const examplesQ = useQuery<PersonaExample[]>({
    queryKey: ["/api/twin/persona-examples"],
    queryFn: async () => (await apiRequest("GET", "/api/twin/persona-examples")).json(),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      return (await apiRequest("POST", "/api/twin/persona-examples", {
        scenario,
        approvedResponse,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        source: "manual",
      })).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/persona-examples"] });
      setScenario(""); setApprovedResponse(""); setTags("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/twin/persona-examples/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/twin/persona-examples"] }),
  });

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Persona Library</h1>
            <p className="text-stone-600 text-sm">Approved examples that shape how the twin speaks for you.</p>
          </div>
          <button onClick={() => navigate("/dashboard")} className="text-sm text-stone-600 hover:text-stone-900">← Back to dashboard</button>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
          <h2 className="font-medium text-stone-900 mb-3">Add an example by hand</h2>
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="What might a client say? e.g. 'I'm scared I'm going to fail this interview tomorrow.'"
            className="w-full border border-stone-300 rounded p-2 text-sm mb-2"
            rows={2}
          />
          <textarea
            value={approvedResponse}
            onChange={(e) => setApprovedResponse(e.target.value)}
            placeholder="How would you respond, in your own voice?"
            className="w-full border border-stone-300 rounded p-2 text-sm mb-2"
            rows={3}
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags (comma-separated): anxiety, work, validation"
            className="w-full border border-stone-300 rounded p-2 text-sm mb-2"
          />
          <button
            onClick={() => createMut.mutate()}
            disabled={!scenario || !approvedResponse || createMut.isPending}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm disabled:opacity-50"
          >
            {createMut.isPending ? "Saving…" : "Add to library"}
          </button>
        </div>

        <div className="space-y-3">
          {examplesQ.data?.map((ex) => (
            <div key={ex.id} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700">{ex.source}</span>
                    {ex.tags?.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-800">{t}</span>
                    ))}
                  </div>
                  <p className="text-xs uppercase tracking-wide text-stone-500 mt-2">Client said</p>
                  <p className="text-sm text-stone-800">{ex.scenario}</p>
                  <p className="text-xs uppercase tracking-wide text-stone-500 mt-2">Approved response</p>
                  <p className="text-sm text-stone-800 whitespace-pre-wrap">{ex.approvedResponse}</p>
                  {ex.rejectedResponse && (
                    <>
                      <p className="text-xs uppercase tracking-wide text-stone-500 mt-2">Avoid</p>
                      <p className="text-sm text-stone-600 italic">{ex.rejectedResponse}</p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => deleteMut.mutate(ex.id)}
                  className="text-xs text-rose-600 hover:text-rose-800"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {examplesQ.data?.length === 0 && (
            <div className="bg-white rounded-lg p-8 text-center text-stone-500 shadow-sm">
              No examples yet. Run a calibration session or add some by hand.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
