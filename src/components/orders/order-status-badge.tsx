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
    className: "border-status-pending text-status-pending",
  },
  reserved: {
    label: "Зарезервирован",
    className: "border-status-reserved text-status-reserved",
  },
  paid: {
    label: "Оплачен",
    className: "border-status-paid text-status-paid",
  },
  cancelled: {
    label: "Отменён",
    className: "border-status-cancelled text-status-cancelled",
  },
  expired: {
    label: "Истёк",
    className: "border-status-expired text-status-expired",
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
