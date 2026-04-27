import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const SECRET_KEY = process.env.AUTH_SECRET || "fallback_secret_for_development";
const key = new TextEncoder().encode(SECRET_KEY);

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(key);
}

export async function decrypt(token: string) {
    try {
        const { payload } = await jwtVerify(token, key, {
            algorithms: ["HS256"],
        });
        return payload;
    } catch (error) {
        return null;
    }
}

export async function getSession(req?: NextRequest) {
    let token;
    if (req) {
        token = req.cookies.get("session")?.value;
    } else {
        const cookieStore = await cookies();
        token = cookieStore.get("session")?.value;
    }

    if (!token) return null;
    return await decrypt(token);
}
