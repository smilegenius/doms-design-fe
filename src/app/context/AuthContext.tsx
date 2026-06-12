import { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  email: string;
  name: string;
  portals: ('supplier' | 'admin')[];
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => void;
  logout: () => void;
}

const SESSION_KEY = 'smilegenius_user';

function loadSession(): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadSession);

  function login(email: string, _password: string) {
    const u: User = {
      email,
      name: email.split('@')[0],
      portals: ['supplier', 'admin'],
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
