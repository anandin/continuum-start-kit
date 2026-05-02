import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ReviewItem {
  messageId: string;
  sessionId: string;
  engagementId: string;
  scenario: string;
  draft: string;
  createdAt: string | null;
}

type Label = "this_is_me" | "not_me" | "never_say_this" | "needs_edit";

export default function ReviewQueue() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState<Record<string, string>>({});

  const queueQ = useQuery<ReviewItem[]>({
    queryKey: ["/api/twin/review-queue"],
    queryFn: async () => (await apiRequest("GET", "/api/twin/review-queue")).json(),
  });

  const labelMut = useMutation({
    mutationFn: async (args: {
      item: ReviewItem;
      label: Label;
      approvedEdit?: string;
      tags?: string[];
    }) => {
      // Server re-loads draft / scenario / engagement / session from messageId.
      // We only send the label, optional edit, and optional tags.
      return apiRequest("POST", `/api/twin/review-queue/${args.item.messageId}/label`, {
        label: args.label,
        approvedEdit: args.approvedEdit,
        tags: args.tags ?? [],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/twin/review-queue"] });
      qc.invalidateQueries({ queryKey: ["/api/twin/persona-examples"] });
      qc.invalidateQueries({ queryKey: ["/api/twin/safety-events"] });
    },
  });

  const submit = (item: ReviewItem, label: Label) => {
    const tags = (tagInput[item.messageId] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const approvedEdit = editing[item.messageId];
    labelMut.mutate({ item, label, approvedEdit, tags });
  };

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Review Queue</h1>
            <p className="text-stone-600 text-sm">
              Recent things your Twin said. Mark each one as "this is me", "needs an edit",
              "not me", or "never say this" — your labels train the persona.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            ← Back to dashboard
          </button>
        </div>

        {queueQ.isLoading && (
          <div className="bg-white rounded-lg p-8 text-center text-stone-500 shadow-sm">Loading…</div>
        )}

        {queueQ.data?.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center text-stone-500 shadow-sm">
            Nothing to review yet. Once your clients chat with the Twin, recent responses will appear here.
          </div>
        )}

        <div className="space-y-3">
          {queueQ.data?.map((item) => {
            const draftText = editing[item.messageId] ?? item.draft;
            const isEdited = editing[item.messageId] !== undefined && editing[item.messageId] !== item.draft;
            return (
              <div key={item.messageId} className="bg-white rounded-lg p-4 shadow-sm">
                {item.scenario && (
                  <>
                    <p className="text-xs uppercase tracking-wide text-stone-500">Client said</p>
                    <p className="text-sm text-stone-800 mb-3">{item.scenario}</p>
                  </>
                )}
                <p className="text-xs uppercase tracking-wide text-stone-500">Twin replied</p>
                <textarea
                  value={draftText}
                  onChange={(e) =>
                    setEditing({ ...editing, [item.messageId]: e.target.value })
                  }
                  className="w-full border border-stone-300 rounded p-2 text-sm mb-2 mt-1"
                  rows={3}
                />
                <input
                  value={tagInput[item.messageId] ?? ""}
                  onChange={(e) => setTagInput({ ...tagInput, [item.messageId]: e.target.value })}
                  placeholder="optional tags (comma-separated)"
                  className="w-full border border-stone-300 rounded p-2 text-xs mb-2"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => submit(item, isEdited ? "needs_edit" : "this_is_me")}
                    disabled={labelMut.isPending}
                    className="px-3 py-1.5 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                  >
                    {isEdited ? "Save my edit" : "This is me"}
                  </button>
                  <button
                    onClick={() => submit(item, "not_me")}
                    disabled={labelMut.isPending}
                    className="px-3 py-1.5 text-xs rounded bg-stone-200 hover:bg-stone-300 text-stone-800 disabled:opacity-50"
                  >
                    Not me
                  </button>
                  <button
                    onClick={() => submit(item, "never_say_this")}
                    disabled={labelMut.isPending}
                    className="px-3 py-1.5 text-xs rounded bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                  >
                    Never say this
                  </button>
                  {item.engagementId && (
                    <button
                      onClick={() => navigate(`/provider/twin/memory/${item.engagementId}`)}
                      className="px-3 py-1.5 text-xs rounded border border-stone-300 hover:bg-stone-50 text-stone-700 ml-auto"
                    >
                      View this client's memory
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
