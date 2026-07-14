import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyCompanies } from "@/lib/companies.functions";

const STORAGE_KEY = "transcore.active_company_id";
const EVENT = "transcore:active-company-changed";

export type CompanyMembership = {
  company_id: string;
  name: string;
  gstin: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  role: "owner" | "manager" | "driver" | "broker" | "viewer";
};

function readActive(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setActiveCompanyId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
  } catch {
    /* ignore */
  }
}

export function useCompanies() {
  const listFn = useServerFn(listMyCompanies);
  const q = useQuery({ queryKey: ["my-companies"], queryFn: () => listFn(), staleTime: 30_000 });
  const [activeId, setActive] = useState<string | null>(readActive);

  useEffect(() => {
    function onChange(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      setActive(id ?? null);
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setActive(e.newValue);
    }
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Auto-select first company when none is set or previously-active company is gone.
  useEffect(() => {
    if (!q.data || q.data.length === 0) return;
    const stillThere = activeId && q.data.some((c) => c.company_id === activeId);
    if (!stillThere) {
      setActiveCompanyId(q.data[0].company_id);
    }
  }, [q.data, activeId]);

  const active = q.data?.find((c) => c.company_id === activeId) ?? q.data?.[0] ?? null;

  const setActiveCompany = useCallback((id: string) => setActiveCompanyId(id), []);

  return {
    ready: !q.isLoading,
    companies: q.data ?? [],
    active,
    activeCompanyId: active?.company_id ?? null,
    setActiveCompany,
    refetch: q.refetch,
  };
}