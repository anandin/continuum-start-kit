import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, BookOpen, Link as LinkIcon, FileText, Dumbbell, Trash2 } from "lucide-react";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  type: "link" | "document" | "exercise";
  url: string | null;
  content: string | null;
  createdAt: string;
}

export default function Resources() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", type: "link" as Resource["type"], url: "", content: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && (!user || role !== "provider")) navigate("/dashboard");
  }, [user, role, loading, navigate]);

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
    enabled: !!user && role === "provider",
  });

  const create = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/resources", form);
      toast({ title: "Resource added" });
      setForm({ title: "", description: "", type: "link", url: "", content: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["/api/resources"] });
    } catch (e: any) {
      toast({ title: "Couldn't add", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/resources/${id}`);
      qc.invalidateQueries({ queryKey: ["/api/resources"] });
    } catch (e: any) { toast({ title: "Couldn't delete", description: e.message, variant: "destructive" }); }
  };

  const iconFor = (t: string) => {
    if (t === "link") return <LinkIcon className="h-4 w-4" />;
    if (t === "document") return <FileText className="h-4 w-4" />;
    return <Dumbbell className="h-4 w-4" />;
  };

  return (
    <AppLayout title="Resource library" subtitle="Worksheets, links, and exercises you assign to clients">
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-resource">
              <Plus className="mr-2 h-4 w-4" /> Add resource
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>New resource</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-title" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Resource["type"] })}>
                  <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="exercise">Exercise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} data-testid="input-description" />
              </div>
              {form.type !== "exercise" && (
                <div>
                  <Label>URL</Label>
                  <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." data-testid="input-url" />
                </div>
              )}
              {form.type === "exercise" && (
                <div>
                  <Label>Content</Label>
                  <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Describe the exercise..." data-testid="input-content" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving || !form.title.trim()} data-testid="button-save-resource">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : resources.length === 0 ? (
        <Card className="shadow-warm">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">Nothing here yet</p>
            <p className="text-sm text-muted-foreground">Add your first resource to share with clients.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map(r => (
            <Card key={r.id} className="shadow-warm animate-fade-in" data-testid={`resource-${r.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge variant="secondary" className="capitalize">{iconFor(r.type)}<span className="ml-1">{r.type}</span></Badge>
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive" data-testid={`button-delete-${r.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-base mt-2">{r.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {r.description && <p className="text-sm text-muted-foreground mb-3">{r.description}</p>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all">
                    {r.url}
                  </a>
                )}
                {r.content && <p className="text-sm text-foreground/80 line-clamp-3">{r.content}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
