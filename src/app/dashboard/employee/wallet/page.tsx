"use client";

import { useEffect, useMemo, useState } from "react";
import type { Wallet, PointLedger, LedgerType } from "@/lib/types";
import { WalletBalanceCard } from "@/components/wallet/wallet-balance-card";
import { TransactionRow } from "@/components/wallet/transaction-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ReceiptText } from "lucide-react";

type TxnFilter = "all" | "accrual" | "spend";

const filterMap: Record<TxnFilter, LedgerType[] | null> = {
  all: null,
  accrual: ["accrual", "release"],
  spend: ["spend", "reserve", "expire"],
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<PointLedger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [txnFilter, setTxnFilter] = useState<TxnFilter>("all");

  useEffect(() => {
    async function fetchWallet() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/wallets/me");
        if (res.ok) {
          const json = await res.json();
          const payload = json.data ?? json;
          setWallet(payload.wallet ?? null);
          setLedger(payload.ledger ?? []);
        }
      } catch {
        // network error — leave empty
      } finally {
        setIsLoading(false);
      }
    }
    fetchWallet();
  }, []);

  const filteredLedger = useMemo(() => {
    const types = filterMap[txnFilter];
    if (!types) return ledger;
    return ledger.filter((entry) => types.includes(entry.type));
  }, [ledger, txnFilter]);

  if (isLoading) {
    return (
      <div className="page-transition space-y-6 p-6">
        <h1 className="text-2xl font-heading font-bold">Кошелёк</h1>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-56" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 pt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const available = wallet ? wallet.balance - wallet.reserved : 0;

  return (
    <div className="page-transition space-y-6 p-6">
      <h1 className="text-2xl font-heading font-bold">Кошелёк</h1>

      {wallet && (
        <WalletBalanceCard
          balance={wallet.balance}
          reserved={wallet.reserved}
          available={available}
          period={wallet.period}
          expiresAt={wallet.expires_at}
        />
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            История операций
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={txnFilter}
            onValueChange={(v) => setTxnFilter(v as TxnFilter)}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="accrual">Начисления</TabsTrigger>
              <TabsTrigger value="spend">Списания</TabsTrigger>
            </TabsList>

            <TabsContent value={txnFilter}>
              {filteredLedger.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title="Нет операций"
                  description="Здесь будут отображаться все операции с вашими баллами"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Операция</TableHead>
                      <TableHead>Дата</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLedger.map((entry) => (
                      <TransactionRow key={entry.id} entry={entry} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
