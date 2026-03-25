const TOKEN_KEY = "openmatch_token";
const USER_KEY = "openmatch_user";

export type User = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    username: string;
};

export type AuthResponse = {
    access_token: string;
    token_type: string;
    user: User;
};

export function saveAuth(auth: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, auth.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
    if (typeof window === "undefined") return null;
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

export function clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
    return getToken() !== null;
}

export function authHeaders(): HeadersInit {
    const token = getToken();
    return token
        ? {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        }
        : {
            "Content-Type": "application/json",
        };
}
