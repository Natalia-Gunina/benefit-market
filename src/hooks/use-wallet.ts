"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Wallet, PointLedger } from "@/lib/types";

interface WalletResponse {
  wallet?: Wallet;
  ledger?: PointLedger[];
  balance: number;
  reserved: number;
  available: number;
  period: string;
  expires_at: string;
  history: PointLedger[];
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletResponse>("/api/wallets/me"),
  });
}
