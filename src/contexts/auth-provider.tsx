'use client';

import type { ReactNode } from 'react';
import { createContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import SplashScreen from '@/components/layout/splash-screen';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  role: 'admin' | 'student' | null;
  branch: string | null;
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLoggedIn: false,
  role: null,
  branch: null,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'student' | null>(null);
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!user) {
        if (!isMounted) return;
        setRole(null);
        setBranch(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userRef);
        if (!isMounted) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          const dbRole = data.role === 'admin' ? 'admin' : 'student';
          const dbBranch = typeof data.branch === 'string' ? data.branch : null;
          setRole(dbRole);
          setBranch(dbBranch);
        } else {
          setRole(null);
          setBranch(null);
        }
      } catch (error) {
        console.error('Failed to load user profile', error);
        if (isMounted) {
          setRole(null);
          setBranch(null);
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const combinedLoading = loading || profileLoading;
  const contextValue = useMemo(
    () => ({
      user,
      loading: combinedLoading,
      isLoggedIn: !!user,
      role,
      branch,
      isAdmin: role === 'admin',
    }),
    [user, combinedLoading, role, branch]
  );

  // Show a global loader only during the initial auth/profile state check
  if (combinedLoading) {
    return <SplashScreen />;
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
