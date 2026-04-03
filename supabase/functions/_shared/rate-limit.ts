import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RateLimitConfig {
  action: string;
  windowMinutes: number;
  maxRequests: number;
}

/**
 * Check and enforce rate limit for a user action.
 * Returns null if allowed, or an error message if blocked.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  config: RateLimitConfig,
): Promise<string | null> {
  const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000).toISOString();

  // Count recent requests
  const { count, error } = await supabase
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", config.action)
    .gte("created_at", windowStart);

  if (error) {
    console.warn("[rate-limit] count error:", error.message);
    return null; // Fail open — don't block on rate limit errors
  }

  if ((count ?? 0) >= config.maxRequests) {
    return `Limite atingido: máximo ${config.maxRequests} requisições a cada ${config.windowMinutes} minutos. Tente novamente em breve.`;
  }

  // Record this request
  await supabase.from("rate_limits").insert({
    user_id: userId,
    action: config.action,
  });

  // Cleanup old entries (best effort, non-blocking)
  supabase
    .from("rate_limits")
    .delete()
    .eq("user_id", userId)
    .eq("action", config.action)
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .then(() => {});

  return null;
}
