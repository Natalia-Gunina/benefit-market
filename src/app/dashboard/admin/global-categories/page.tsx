"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GlobalCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export default function AdminGlobalCategoriesPage() {
  const [categories, setCategories] = useState<GlobalCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");

  const load = useCallback(() => {
    setIsLoading(true);
    fetch("/api/admin/global-categories")
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => toast.error("Ошибка загрузки данных"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/admin/global-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, icon: newIcon, sort_order: categories.length + 1 }),
      });
      if (res.ok) {
        toast.success("Категория создана");
        setNewName("");
        setNewIcon("");
        load();
      } else {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/global-categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Категория удалена");
        load();
      } else {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка удаления");
      }
    } catch {
      toast.error("Ошибка сети");
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Глобальные категории</h1>

      <Card>
        <CardHeader><CardTitle>Добавить категорию</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Название" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Иконка" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} className="w-40" />
            <Button onClick={handleCreate}><Plus className="mr-1 size-4" />Добавить</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : (
        <Card>
          <CardHeader><CardTitle>Категории ({categories.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{c.icon || "—"}</span>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-sm text-muted-foreground">#{c.sort_order}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
