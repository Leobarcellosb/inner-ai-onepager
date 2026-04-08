import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Load full brain context for AI prompts.
 * Structured in priority layers:
 *   1. IDENTIDADE — who the brand is and who it talks to (highest priority)
 *   2. REGRAS — hard constraints the AI must follow (enforcement)
 *   3. PADRÕES — what has worked before (inspiration)
 *   4. MEMÓRIA — what was approved/rejected (behavioral learning)
 */
export async function loadBrainContext(supabase: SupabaseClient): Promise<string> {
  const sections: string[] = [];

  try {
    const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();
    if (cfg) {
      const icp = cfg.icp_json as Record<string, string> | null;
      const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
      const voice = cfg.voice_tone_json as Record<string, string> | null;
      const rules = cfg.rules_json as Record<string, string> | null;
      const learn = cfg.learnings_json as Record<string, string[]> | null;

      // Layer 1: Identity — defines WHO the brand is
      const identity: string[] = [];
      if (icp?.persona) identity.push(`PÚBLICO: ${icp.persona}`);
      if (icp?.pain_points) identity.push(`DORES DO PÚBLICO: ${icp.pain_points}`);
      if (icp?.desires) identity.push(`DESEJOS DO PÚBLICO: ${icp.desires}`);
      if (icp?.language_style) identity.push(`COMO O PÚBLICO FALA: ${icp.language_style}`);
      if (ed?.positioning) identity.push(`POSICIONAMENTO: ${ed.positioning}`);
      if (voice?.voice) identity.push(`VOZ DA MARCA: ${voice.voice}`);
      if (ed?.pillars) identity.push(`PILARES DE CONTEÚDO: ${ed.pillars}`);
      if (identity.length > 0) sections.push(`── IDENTIDADE DA MARCA ──\n${identity.join("\n")}`);

      // Layer 2: Rules — HARD constraints (violation = failure)
      const hard: string[] = [];
      if (rules?.content_structure) hard.push(`ESTRUTURA OBRIGATÓRIA: o conteúdo DEVE seguir ${rules.content_structure}`);
      if (rules?.always_include) hard.push(`ELEMENTOS OBRIGATÓRIOS: DEVE conter ${rules.always_include}`);
      if (rules?.never_include) hard.push(`PROIBIDO: NÃO PODE conter ${rules.never_include}`);
      if (voice?.forbidden_terms) hard.push(`TERMOS BANIDOS: NUNCA usar ${voice.forbidden_terms}`);
      if (voice?.preferred_terms) hard.push(`TERMOS PREFERIDOS: usar sempre que possível ${voice.preferred_terms}`);
      if (voice?.cta_patterns) hard.push(`CTA PADRÃO: usar variações de ${voice.cta_patterns}`);
      if (ed?.copy_style) hard.push(`ESTILO: ${ed.copy_style}`);
      if (ed?.hook_patterns) hard.push(`GANCHOS PREFERIDOS: ${ed.hook_patterns}`);
      if (ed?.creative_principles) hard.push(`PRINCÍPIOS: ${ed.creative_principles}`);
      if (hard.length > 0) sections.push(`── REGRAS (descumprir = erro) ──\n${hard.map((r, i) => `${i + 1}. ${r}`).join("\n")}`);

      // Layer 3: Patterns — what has worked (inspiration, not obligation)
      const patterns: string[] = [];
      if (learn?.hooks?.length) patterns.push(`Ganchos que funcionaram: ${learn.hooks.slice(-5).join(" | ")}`);
      if (learn?.copy_patterns?.length) patterns.push(`Estruturas de copy eficazes: ${learn.copy_patterns.slice(-3).join(" | ")}`);
      if (learn?.visual_patterns?.length) patterns.push(`Padrões visuais validados: ${learn.visual_patterns.slice(-3).join(" | ")}`);
      if (learn?.ctas?.length) patterns.push(`CTAs validados: ${learn.ctas.slice(-5).join(" | ")}`);
      if (learn?.structures?.length) patterns.push(`O que performou: ${learn.structures.slice(-3).join(" | ")}`);
      if (patterns.length > 0) sections.push(`── PADRÕES VALIDADOS (inspire-se, não copie) ──\n${patterns.join("\n")}`);
    }
  } catch { /* not configured */ }

  // Knowledge entries
  try {
    const { data: kb } = await supabase.from("knowledge_entries")
      .select("extracted_insights").order("created_at", { ascending: false }).limit(5);
    if (kb) {
      const insights = kb.flatMap((e: any) => Array.isArray(e.extracted_insights) ? e.extracted_insights : []);
      if (insights.length > 0) sections.push(`── CONHECIMENTO ACUMULADO ──\n${insights.slice(0, 8).join("\n")}`);
    }
  } catch { /* no knowledge */ }

  // Layer 4: Memories — behavioral learning from human decisions
  try {
    const memoryParts: string[] = [];

    const { data: rejections } = await supabase.from("brain_memories")
      .select("context").eq("memory_type", "rejection")
      .order("created_at", { ascending: false }).limit(5);
    if (rejections?.length) {
      const reasons = rejections.map((r: any) => r.context?.reason || r.context?.feedback).filter(Boolean);
      if (reasons.length > 0) memoryParts.push(`REJEITADO pelo time (NÃO repetir):\n${reasons.map(r => `✗ ${r}`).join("\n")}`);
    }

    const { data: approvals } = await supabase.from("brain_memories")
      .select("context").eq("memory_type", "approval")
      .order("created_at", { ascending: false }).limit(5);
    if (approvals?.length) {
      const texts = approvals
        .map((a: any) => a.context?.text_preview ? `✓ ${a.context.platform}: "${String(a.context.text_preview).slice(0, 80)}..."` : null)
        .filter(Boolean);
      if (texts.length > 0) memoryParts.push(`APROVADO pelo time (este padrão funciona):\n${texts.join("\n")}`);
    }

    const { data: opts } = await supabase.from("brain_memories")
      .select("context").eq("memory_type", "optimization")
      .order("created_at", { ascending: false }).limit(3);
    if (opts?.length) {
      const wins = opts.filter((o: any) => (o.context?.improvement ?? 0) > 10)
        .map((o: any) => `↑ Score +${o.context.improvement}: "${String(o.context?.text_after || "").slice(0, 80)}..."`);
      if (wins.length > 0) memoryParts.push(`OTIMIZAÇÕES que melhoraram score:\n${wins.join("\n")}`);
    }

    if (memoryParts.length > 0) sections.push(`── MEMÓRIA DE DECISÕES ──\n${memoryParts.join("\n\n")}`);
  } catch { /* no memories */ }

  if (sections.length === 0) return "";
  return "\n\n" + sections.join("\n\n");
}
