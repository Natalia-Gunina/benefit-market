"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data.user) {
        const role =
          (data.user.app_metadata?.role as string) ??
          (data.user.user_metadata?.role as string) ??
          "employee";

        switch (role) {
          case "admin":
            router.push("/dashboard/admin");
            break;
          case "hr":
            router.push("/dashboard/hr");
            break;
          case "provider":
            router.push("/dashboard/provider");
            break;
          default:
            router.push("/dashboard/employee");
        }
        router.refresh();
      }
    } catch {
      setError("Произошла непредвиденная ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mobile branding */}
      <div className="text-center lg:hidden">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-gradient-primary font-bold text-sm text-white">
          BM
        </div>
        <h1 className="text-xl font-bold">Benefit Market</h1>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold">
            Вход в систему
          </CardTitle>
          <CardDescription>
            Войдите, чтобы управлять своими льготами
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="flex flex-col gap-4">
            {justRegistered && !error && (
              <div className="rounded-lg bg-success-light p-3 text-sm text-success">
                Регистрация прошла успешно! Войдите в систему.
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-10 bg-gradient-primary hover:opacity-90 transition-opacity" disabled={loading}>
              {loading ? "Загрузка..." : "Войти"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link
                href="/auth/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Зарегистрироваться
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Вход в систему</CardTitle>
          <CardDescription>Войдите, чтобы управлять своими льготами</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="h-[200px] animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  );
}
