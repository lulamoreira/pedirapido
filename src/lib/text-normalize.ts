// Regras de tratamento de texto do Pedirápido
// A) Frases/Descrições/Endereços → PRIMEIRA palavra UPPERCASE, resto em minúsculas.
// B) Nomes próprios → TODAS as palavras UPPERCASE, exceto conectivos (de, do, da, dos, das, e).

const CONECTIVOS = new Set(["de", "do", "da", "dos", "das", "e"]);

/** Trim + colapsa espaços internos. */
function clean(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\s+/g, " ").trim();
}

/**
 * Frases: primeira palavra 100% UPPERCASE, demais em minúsculas.
 * Preserva pontuação e números.
 * Ex: "galão de água mineral" → "GALÃO de água mineral"
 *     "rua das flores, 123"   → "RUA das flores, 123"
 */
export function normalizeSentence(input: string | null | undefined): string {
  const s = clean(input);
  if (!s) return "";
  const parts = s.split(" ");
  return parts
    .map((w, i) => (i === 0 ? w.toLocaleUpperCase("pt-BR") : w.toLocaleLowerCase("pt-BR")))
    .join(" ");
}

/**
 * Nomes próprios: todas as palavras em UPPERCASE, exceto conectivos (de/do/da/dos/das/e).
 * A primeira palavra NUNCA fica minúscula, mesmo se for conectivo.
 * Ex: "luis alberto de moreira" → "LUIS ALBERTO de MOREIRA"
 *     "joão da silva e souza"   → "JOÃO da SILVA e SOUZA"
 */
export function normalizeProperName(input: string | null | undefined): string {
  const s = clean(input);
  if (!s) return "";
  const parts = s.split(" ");
  return parts
    .map((w, i) => {
      const lower = w.toLocaleLowerCase("pt-BR");
      if (i > 0 && CONECTIVOS.has(lower)) return lower;
      return w.toLocaleUpperCase("pt-BR");
    })
    .join(" ");
}

/** Helper: exibição combinada de produto — "Nome • Volume • MARCA • Embalagem" */
export function formatProdutoLinha(p: {
  volume_valor?: number | string | null;
  volume_unidade?: string | null;
  marca?: string | null;
  tipo_embalagem?: string | null;
}): string {
  const partes: string[] = [];
  if (p.volume_valor != null && p.volume_valor !== "") {
    const n = Number(p.volume_valor);
    if (Number.isFinite(n) && n > 0) {
      const u = p.volume_unidade === "ml" ? "ml" : "L";
      const label = Number.isInteger(n)
        ? String(n)
        : n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
      partes.push(`${label} ${u}`);
    }
  }
  if (p.marca && p.marca.trim()) partes.push(p.marca.trim());
  if (p.tipo_embalagem && p.tipo_embalagem.trim()) partes.push(p.tipo_embalagem.trim());
  return partes.join(" • ");
}
