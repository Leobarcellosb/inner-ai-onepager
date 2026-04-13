import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 10_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedForRef = useRef<string | null>(null);

  const loadUserData = useCallback(async (userId: string) => {
    // Prevent duplicate fetches for the same user
    if (fetchedForRef.current === userId) return;
    fetchedForRef.current = userId;

    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (rolesRes.data) setRoles(rolesRes.data.map((r) => r.role as AppRole));
    } catch (err) {
      console.error('[AUTH] Failed to load user data:', err);
      // Clear ref so retry is possible on next auth event
      fetchedForRef.current = null;
    }
  }, []);

  const clearUserData = useCallback(() => {
    setProfile(null);
    setRoles([]);
    fetchedForRef.current = null;
  }, []);

  useEffect(() => {
    let mounted = true;

    // Safety timeout — never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[AUTH] Bootstrap timeout — forcing loading=false');
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          return loadUserData(s.user.id);
        }
      })
      .catch((err) => {
        console.error('[AUTH] getSession error:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
        clearTimeout(timeout);
      });

    // Listen for auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          loadUserData(s.user.id);
        } else {
          clearUserData();
        }
      },
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadUserData, clearUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearUserData();
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data as Profile);
    } catch (err) {
      console.error('[AUTH] refreshProfile error:', err);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, signIn, signUp, signOut, hasRole, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
