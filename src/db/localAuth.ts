import { getLocalDb, saveLocalDb } from "./localStorageDb";

const AUTH_SESSION_KEY = "localshore_auth_session_v1";

interface AuthUser {
  id: string;
  email: string;
  user_metadata: Record<string, any>;
  created_at: string;
}

interface AuthSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: AuthUser;
}

type AuthCallback = (event: string, session: AuthSession | null) => void;
const listeners = new Set<AuthCallback>();

function emitAuthEvent(event: string, session: AuthSession | null) {
  for (const cb of listeners) {
    try {
      cb(event, session);
    } catch (e) {
      console.error("[LocalAuth] Listener error:", e);
    }
  }
}

export const localAuth = {
  async getSession(): Promise<{ data: { session: AuthSession | null }; error: null }> {
    if (typeof window === "undefined") {
      return { data: { session: null }, error: null };
    }
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      const session = raw ? JSON.parse(raw) : null;
      return { data: { session }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  async getUser(): Promise<{ data: { user: AuthUser | null }; error: null }> {
    const { data } = await this.getSession();
    return { data: { user: data.session?.user ?? null }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password?: string }) {
    const cleanEmail = email.trim().toLowerCase();
    const db = getLocalDb();

    let user = (db.auth_users || []).find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      // Auto-create user for frictionless local testing
      user = {
        id: `user-auto-${Date.now()}`,
        email: cleanEmail,
        password: password || "password123",
        user_metadata: { full_name: cleanEmail.split("@")[0] },
        created_at: new Date().toISOString(),
      };
      db.auth_users.push(user);
      saveLocalDb(db);
    }

    const session: AuthSession = {
      access_token: `mock_jwt_${user.id}_${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {},
        created_at: user.created_at,
      },
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    }

    emitAuthEvent("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password?: string;
    options?: { data?: Record<string, any>; emailRedirectTo?: string };
  }) {
    const cleanEmail = email.trim().toLowerCase();
    const db = getLocalDb();

    let user = (db.auth_users || []).find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      user = {
        id: `user-${Date.now()}`,
        email: cleanEmail,
        password: password || "password123",
        user_metadata: options?.data || { full_name: cleanEmail.split("@")[0] },
        created_at: new Date().toISOString(),
      };
      db.auth_users.push(user);
      saveLocalDb(db);
    }

    const session: AuthSession = {
      access_token: `mock_jwt_${user.id}_${Date.now()}`,
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata || {},
        created_at: user.created_at,
      },
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    }

    emitAuthEvent("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  },

  async signInWithOtp({ email }: { email: string }) {
    return { data: { messageId: `msg-${Date.now()}` }, error: null };
  },

  async verifyOtp({
    email,
    token,
    type,
  }: {
    email: string;
    token: string;
    type?: string;
  }) {
    return this.signInWithPassword({ email });
  },

  async resetPasswordForEmail(email: string) {
    return { data: {}, error: null };
  },

  async updateUser({ password }: { password?: string }) {
    const { data } = await this.getUser();
    if (data.user) {
      const db = getLocalDb();
      const user = (db.auth_users || []).find((u) => u.id === data.user!.id);
      if (user && password) {
        user.password = password;
        saveLocalDb(db);
      }
    }
    return { data: { user: data.user }, error: null };
  },

  async signOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
    emitAuthEvent("SIGNED_OUT", null);
    return { error: null };
  },

  onAuthStateChange(callback: AuthCallback) {
    listeners.add(callback);
    // Emit initial session state immediately
    this.getSession().then(({ data }) => {
      callback(data.session ? "INITIAL_SESSION" : "SIGNED_OUT", data.session);
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  },
};
