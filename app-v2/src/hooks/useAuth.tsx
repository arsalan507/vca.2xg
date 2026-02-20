import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { auth, AuthUser, AuthSession } from '@/lib/api';
import type { UserRole } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithSession: (session: AuthSession) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await auth.getUser();
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = auth.onAuthStateChange((_event: string, session: AuthSession | null) => {
      if (session?.user) {
        setUser(session.user);
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithSession = useCallback((session: AuthSession) => {
    auth.saveSession(session);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    auth.signOut(); // clears session instantly, backend cleanup is fire-and-forget
    setUser(null);
  }, []);

  const role = user?.app_metadata?.role as UserRole | undefined
    || user?.user_metadata?.role as UserRole | undefined
    || null;

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isLoading,
      isAuthenticated: !!user,
      signInWithSession,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
