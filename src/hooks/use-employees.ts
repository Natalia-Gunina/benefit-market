"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

interface Employee {
  id: string;
  email: string;
  role: string;
  full_name: string;
  department: string;
  grade: string;
  tenure_months: number;
  location: string;
  legal_entity: string;
  is_active: boolean;
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get<Employee[]>("/api/hr/employees"),
  });
}
