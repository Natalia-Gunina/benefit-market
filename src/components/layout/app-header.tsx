"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

interface AppHeaderProps {
  title: string;
  role: "employee" | "hr" | "admin";
  pointsBalance?: number;
}

export function AppHeader({ title, role, pointsBalance }: AppHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-3">
        {role === "employee" && typeof pointsBalance === "number" && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            <span>&#9889;</span>
            <span className="tabular-nums">
              {pointsBalance.toLocaleString("ru-RU")} баллов
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
