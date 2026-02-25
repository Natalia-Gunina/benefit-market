import type { PointLedger, LedgerType } from "@/lib/types";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Unlock,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";

const typeConfig: Record<
  LedgerType,
  { icon: LucideIcon; colorClass: string; sign: string; label: string }
> = {
  accrual: {
    icon: ArrowDownLeft,
    colorClass: "text-[var(--txn-accrual)]",
    sign: "+",
    label: "Начисление",
  },
  spend: {
    icon: ArrowUpRight,
    colorClass: "text-[var(--txn-spend)]",
    sign: "\u2212",
    label: "Списание",
  },
  reserve: {
    icon: Lock,
    colorClass: "text-[var(--txn-reserve)]",
    sign: "\u2212",
    label: "Резерв",
  },
  release: {
    icon: Unlock,
    colorClass: "text-[var(--txn-release)]",
    sign: "+",
    label: "Разблокировка",
  },
  expire: {
    icon: Clock,
    colorClass: "text-[var(--txn-expire)]",
    sign: "\u2212",
    label: "Сгорание",
  },
};

interface TransactionRowProps {
  entry: PointLedger;
}

export function TransactionRow({ entry }: TransactionRowProps) {
  const config = typeConfig[entry.type];
  const Icon = config.icon;
  const formattedDate = new Date(entry.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedTime = new Date(entry.created_at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className={`rounded-lg bg-muted p-2 ${config.colorClass}`}>
            <Icon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {entry.description || config.label}
            </p>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <span>{formattedDate}</span>
        <span className="ml-1.5 text-xs">{formattedTime}</span>
      </TableCell>
      <TableCell className="text-right">
        <span
          className={`text-sm font-semibold tabular-nums ${config.colorClass}`}
        >
          {config.sign}
          {Math.abs(entry.amount).toLocaleString("ru-RU")}
        </span>
      </TableCell>
    </TableRow>
  );
}
