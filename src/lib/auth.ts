import { createAuthClient } from '@neondatabase/neon-js/auth';

const AUTH_URL: string = import.meta.env.VITE_NEON_AUTH_URL

export const authClient = createAuthClient(AUTH_URL)

// header.payload.signature (base64url). The opaque session token doesn't look like this.
const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/

/**
 * A Neon Auth JWT (they live ~15 minutes) for the backend to verify.
 *
 * 1. The session. The SDK puts the JWT from the `set-auth-jwt` response header into `session.token`
 *    and refreshes the cached session before the JWT expires.
 * 2. Fallback: Neon's JWT endpoint, which returns the token in the response body, so it still works if
 *    the browser isn't allowed to read that header cross-origin. (`authClient.token()` isn't usable:
 *    in this SDK it just returns the session.)
 *
 * If both fail the reasons are logged to the console (never the token) to make sign-in problems diagnosable.
 */
export async function getAccessToken(): Promise<string | null> {
    const reasons: string[] = []

    try {
        const { data } = await authClient.getSession()
        const token = data?.session?.token
        if (token && JWT_SHAPE.test(token)) return token
        reasons.push(
            token
                ? 'session.token is not a JWT (the set-auth-jwt response header was probably not readable cross-origin)'
                : 'there is no session (not signed in?)',
        )
    } catch (err) {
        reasons.push(`getSession failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    try {
        const res = await fetch(`${AUTH_URL.replace(/\/+$/, '')}/token`, { credentials: 'include' })
        if (res.ok) {
            const { token } = await res.json()
            if (typeof token === 'string' && JWT_SHAPE.test(token)) return token
            reasons.push('/token responded OK but did not contain a JWT')
        } else {
            reasons.push(`/token responded HTTP ${res.status}`)
        }
    } catch (err) {
        reasons.push(`/token request failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    console.warn('[auth] could not get an access token for the API:', reasons.join('; '))
    return null
}
