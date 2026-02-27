"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Profile {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  status: string;
  offerings_count: number;
}

export default function ProviderProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [regForm, setRegForm] = useState({ name: "", slug: "", description: "", contact_email: "" });
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetch("/api/provider/profile")
      .then(async (r) => {
        if (r.ok) {
          const json = await r.json();
          setProfile(json.data);
        } else {
          setNeedsRegistration(true);
        }
      })
      .catch(() => setNeedsRegistration(true))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/provider/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          description: profile.description,
          logo_url: profile.logo_url,
          website: profile.website,
          contact_email: profile.contact_email,
          contact_phone: profile.contact_phone,
          address: profile.address,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка");
        return;
      }
      toast.success("Профиль обновлён!");
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await fetch("/api/provider/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.message ?? "Ошибка регистрации");
        return;
      }
      const json = await res.json();
      setProfile(json.data);
      setNeedsRegistration(false);
      toast.success("Профиль создан! Ожидайте верификации.");
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setRegistering(false);
    }
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Загрузка...</div>;

  if (needsRegistration) {
    return (
      <div className="page-transition space-y-6 p-6 max-w-lg">
        <h1 className="text-2xl font-heading font-bold">Регистрация провайдера</h1>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Название компании</Label>
                <Input value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL-имя)</Label>
                <Input value={regForm.slug} onChange={(e) => setRegForm({ ...regForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} required placeholder="my-company" />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea value={regForm.description} onChange={(e) => setRegForm({ ...regForm, description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Контактный email</Label>
                <Input type="email" value={regForm.contact_email} onChange={(e) => setRegForm({ ...regForm, contact_email: e.target.value })} />
              </div>
              <Button type="submit" disabled={registering} className="w-full">
                {registering ? "Регистрация..." : "Зарегистрировать"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) return null;

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    verified: "default",
    suspended: "destructive",
    rejected: "destructive",
  };

  return (
    <div className="page-transition space-y-6 p-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-heading font-bold">Профиль провайдера</h1>
        <Badge variant={statusColors[profile.status] ?? "secondary"}>{profile.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Информация</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={profile.slug} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.contact_email ?? ""} onChange={(e) => setProfile({ ...profile, contact_email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input value={profile.contact_phone ?? ""} onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Сайт</Label>
            <Input value={profile.website ?? ""} onChange={(e) => setProfile({ ...profile, website: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Адрес</Label>
            <Input value={profile.address ?? ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
