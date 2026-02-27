"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShoppingBag,
  ShoppingCart,
  ClipboardList,
  Wallet,
  LayoutDashboard,
  Users,
  Upload,
  Settings,
  Building2,
  Package,
  FolderOpen,
  Calculator,
  Filter,
  FileText,
  LogOut,
  UserRound,
  ShieldCheck,
  Store,
  BarChart,
  Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useCartStore } from "@/lib/store/cart";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

const employeeNavItems: NavItem[] = [
  { title: "Каталог", href: "/dashboard/employee/catalog", icon: ShoppingBag },
  { title: "Корзина", href: "/dashboard/employee/cart", icon: ShoppingCart },
  { title: "Мои заказы", href: "/dashboard/employee/orders", icon: ClipboardList },
  { title: "Кошелёк", href: "/dashboard/employee/wallet", icon: Wallet },
];

const hrNavItems: NavItem[] = [
  { title: "Дашборд", href: "/dashboard/hr", icon: LayoutDashboard },
  { title: "Сотрудники", href: "/dashboard/hr/employees", icon: Users },
  { title: "Импорт", href: "/dashboard/hr/import", icon: Upload },
  { title: "Политики", href: "/dashboard/hr/policies", icon: Settings },
  { title: "Маркетплейс", href: "/dashboard/hr/marketplace", icon: Store },
  { title: "Подключённые", href: "/dashboard/hr/offerings", icon: Package },
];

const adminNavItems: NavItem[] = [
  { title: "Компании", href: "/dashboard/admin/tenants", icon: Building2 },
  { title: "Каталог", href: "/dashboard/admin/benefits", icon: Package },
  { title: "Категории", href: "/dashboard/admin/categories", icon: FolderOpen },
  { title: "Политики", href: "/dashboard/admin/policies", icon: Calculator },
  { title: "Правила", href: "/dashboard/admin/rules", icon: Filter },
  { title: "Пользователи", href: "/dashboard/admin/users", icon: Users },
  { title: "Аудит", href: "/dashboard/admin/audit", icon: FileText },
  { title: "Провайдеры", href: "/dashboard/admin/providers", icon: Store },
  { title: "Модерация", href: "/dashboard/admin/offerings", icon: ShieldCheck },
  { title: "Глоб. категории", href: "/dashboard/admin/global-categories", icon: Tags },
];

const providerNavItems: NavItem[] = [
  { title: "Дашборд", href: "/dashboard/provider", icon: LayoutDashboard },
  { title: "Предложения", href: "/dashboard/provider/offerings", icon: Package },
  { title: "Заказы", href: "/dashboard/provider/orders", icon: ClipboardList },
  { title: "Аналитика", href: "/dashboard/provider/analytics", icon: BarChart },
  { title: "Профиль", href: "/dashboard/provider/profile", icon: Building2 },
];

const navItemsByRole: Record<string, NavItem[]> = {
  employee: employeeNavItems,
  hr: hrNavItems,
  admin: adminNavItems,
  provider: providerNavItems,
};

const groupLabelByRole: Record<string, string> = {
  employee: "Сотрудник",
  hr: "HR-панель",
  admin: "Администратор",
  provider: "Провайдер",
};

const demoRoles = [
  { key: "employee" as const, label: "Сотрудник", icon: UserRound, href: "/dashboard/employee/catalog" },
  { key: "hr" as const, label: "HR", icon: Users, href: "/dashboard/hr" },
  { key: "admin" as const, label: "Админ", icon: ShieldCheck, href: "/dashboard/admin/tenants" },
  { key: "provider" as const, label: "Провайдер", icon: Store, href: "/dashboard/provider" },
];

interface AppSidebarProps {
  role: "employee" | "hr" | "admin" | "provider";
  currentPath?: string;
  userEmail: string;
  tenantName?: string;
  isDemo?: boolean;
}

export function AppSidebar({ role, userEmail, tenantName, isDemo }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const cartCount = useCartStore((s) => s.items.length);

  // In demo mode, derive role from the current URL so menu updates on client navigation
  const activeRole =
    pathname.startsWith("/dashboard/admin") ? "admin" as const
    : pathname.startsWith("/dashboard/hr") ? "hr" as const
    : pathname.startsWith("/dashboard/provider") ? "provider" as const
    : "employee" as const;
  const effectiveRole = isDemo ? activeRole : role;
  const navItems = navItemsByRole[effectiveRole] ?? [];
  const groupLabel = groupLabelByRole[effectiveRole] ?? "Навигация";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sidebar-foreground"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-heading font-bold text-sm">
            BM
          </div>
          <span className="font-heading text-lg font-bold group-data-[collapsible=icon]:hidden">
            Benefit Market
          </span>
        </Link>
        {tenantName && (
          <p className="text-xs text-sidebar-foreground/60 mt-1 truncate group-data-[collapsible=icon]:hidden">
            {tenantName}
          </p>
        )}
      </SidebarHeader>

      {isDemo && (
        <div className="px-3 pb-1 group-data-[collapsible=icon]:px-1.5">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
            Demo-кабинет
          </p>
          <div className="flex gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            {demoRoles.map((r) => {
              const isActive = activeRole === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => router.push(r.href)}
                  title={r.label}
                  className={`
                    flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors
                    group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0
                    ${isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }
                  `}
                >
                  <r.icon className="size-3.5 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SidebarSeparator />

      <SidebarContent className="custom-scrollbar">
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard/hr" &&
                    pathname.startsWith(item.href + "/"));

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                        {item.href === "/dashboard/employee/cart" && cartCount > 0 && (
                          <Badge variant="secondary" className="ml-auto size-5 justify-center rounded-full p-0 text-xs">
                            {cartCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs text-sidebar-foreground/80">
              {userEmail}
            </span>
          </div>
          <ThemeToggle />
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              title="Выйти"
            >
              <LogOut className="size-4" />
              <span className="sr-only">Выйти</span>
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
