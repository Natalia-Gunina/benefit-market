import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Ожидает",
    className: "border-[var(--status-pending)] text-[var(--status-pending)]",
  },
  reserved: {
    label: "Зарезервирован",
    className: "border-[var(--status-reserved)] text-[var(--status-reserved)]",
  },
  paid: {
    label: "Оплачен",
    className: "border-[var(--status-paid)] text-[var(--status-paid)]",
  },
  cancelled: {
    label: "Отменён",
    className: "border-[var(--status-cancelled)] text-[var(--status-cancelled)]",
  },
  expired: {
    label: "Истёк",
    className: "border-[var(--status-expired)] text-[var(--status-expired)]",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
