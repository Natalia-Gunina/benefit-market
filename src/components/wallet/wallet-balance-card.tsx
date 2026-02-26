import { Zap, Wallet, Lock, CalendarDays, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WalletBalanceCardProps {
  balance: number;
  reserved: number;
  available: number;
  period: string;
  expiresAt: string;
}

export function WalletBalanceCard({
  balance,
  reserved,
  available,
  period,
  expiresAt,
}: WalletBalanceCardProps) {
  const formattedExpiry = new Date(expiresAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Баланс кошелька</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Available — hero number */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Zap className="size-7" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Доступно</p>
            <p className="text-3xl font-bold tabular-nums text-primary">
              {available.toLocaleString("ru-RU")}
              <span className="ml-1 text-base font-medium text-muted-foreground">
                баллов
              </span>
            </p>
          </div>
        </div>

        {/* Balance & reserved breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Wallet className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Баланс</p>
              <p className="text-sm font-semibold tabular-nums">
                {balance.toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Lock className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Зарезервировано</p>
              <p className="text-sm font-semibold tabular-nums">
                {reserved.toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
        </div>

        {/* Period & expiry */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            Период: {period}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" />
            Действителен до: {formattedExpiry}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
