import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function initialsFrom(nameOrEmail: string | null | undefined): string {
  const s = (nameOrEmail ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/** Profile row + signed avatar URL derived from avatar_url (storage path in `avatars` bucket). */
export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const profileQ = useQuery({
    enabled: !!userId,
    queryKey: ["profile", userId],
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, company_name, avatar_url, created_at, updated_at")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfileRow | null) ?? null;
    },
    staleTime: 60_000,
  });

  const avatarPath = profileQ.data?.avatar_url ?? null;
  const signedQ = useQuery({
    enabled: !!avatarPath,
    queryKey: ["profile-avatar-url", avatarPath],
    queryFn: async (): Promise<string | null> => {
      if (!avatarPath) return null;
      const { data, error } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
    staleTime: 55 * 60_000,
  });

  return {
    profile: profileQ.data ?? null,
    avatarUrl: signedQ.data ?? null,
    isLoading: profileQ.isLoading,
    error: profileQ.error,
  };
}

export function useInvalidateProfile() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["profile-avatar-url"] });
  };
}