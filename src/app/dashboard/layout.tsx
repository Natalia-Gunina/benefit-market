import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { QueryProvider } from "@/components/providers/query-provider";

function getRoleFromPath(pathname: string): "employee" | "hr" | "admin" {
  if (pathname.startsWith("/dashboard/admin")) return "admin";
  if (pathname.startsWith("/dashboard/hr")) return "hr";
  return "employee";
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  let role: "employee" | "hr" | "admin" = "employee";
  let userEmail = "demo@techfuture.ru";
  let tenantName: string | undefined = "ООО Технологии Будущего";

  if (isDemo) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";
    role = getRoleFromPath(pathname);
  }

  if (!isDemo) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    role =
      (user.user_metadata?.role as "employee" | "hr" | "admin") ?? "employee";
    userEmail = user.email ?? "";
    tenantName = (user.user_metadata?.tenant_name as string) ?? undefined;
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Перейти к содержимому
      </a>
      <SidebarProvider>
        <AppSidebar
          role={role}
          userEmail={userEmail}
          tenantName={tenantName}
          isDemo={isDemo}
        />
        <SidebarInset>
          <QueryProvider>
            <ErrorBoundary>
              <main id="main-content" role="main">
                {children}
              </main>
            </ErrorBoundary>
          </QueryProvider>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
