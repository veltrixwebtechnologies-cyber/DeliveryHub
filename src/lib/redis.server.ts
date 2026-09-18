/**
 * DELIVERY PARTNER HUB — SERVER-ONLY REDIS UTILITY
 * (GPS Telemetry modifications deferred per Phase 9 specification)
 */

if (typeof window !== "undefined") {
  throw new Error("SECURITY ERROR: redis.server.ts must only be imported in server-side code!");
}

import Redis from "ioredis";

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisInstance) return redisInstance;

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return null;

  try {
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    });
    return redisInstance;
  } catch (err: any) {
    console.error("[Delivery Partner Hub Redis] Client init notice:", err?.message || String(err));
    return null;
  }
}
