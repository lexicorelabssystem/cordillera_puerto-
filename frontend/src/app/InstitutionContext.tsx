import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Institution } from "../types/api";

interface InstitutionContextValue {
  institutions: Institution[];
  selectedInstitution: Institution | null;
  setInstitutionId: (id: string) => void;
  isLoading: boolean;
}

const InstitutionContext = createContext<InstitutionContextValue | null>(null);

const STORAGE_KEY = "cordillera_institution_id";

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY) || ""
  );

  const { data: institutions = [], isLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: () => api.listInstitutions(),
    staleTime: 5 * 60 * 1000,
  });

  const selectedInstitution = institutions.find((i) => i.id === selectedId) || institutions[0] || null;

  useEffect(() => {
    if (!selectedId && institutions.length > 0) {
      setSelectedId(institutions[0].id);
    }
  }, [institutions, selectedId]);

  const setInstitutionId = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return (
    <InstitutionContext.Provider
      value={{ institutions, selectedInstitution, setInstitutionId, isLoading }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution(): InstitutionContextValue {
  const ctx = useContext(InstitutionContext);
  if (!ctx) {
    throw new Error("useInstitution must be used within InstitutionProvider");
  }
  return ctx;
}
