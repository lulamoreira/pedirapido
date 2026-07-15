export const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const formatBRL = (v: number | string | null | undefined) =>
  BRL.format(Number(v ?? 0));

export const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

export const daysUntil = (date: string | Date) => {
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

/** "20 L", "1,5 L", "500 ml" — retorna null se não tiver volume */
export const formatVolume = (
  valor: number | string | null | undefined,
  unidade: string | null | undefined,
): string | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unidade === "ml" ? "ml" : "L";
  // formata sem casas quando inteiro; senão até 2 casas com vírgula
  const label = Number.isInteger(n)
    ? String(n)
    : n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  return `${label} ${u}`;
};

/** Nome comercial de uma distribuidora — sempre prioriza nome_fantasia */
export const displayNomeLoja = (
  d: { nome_fantasia?: string | null; nome?: string | null } | null | undefined,
): string => {
  if (!d) return "";
  return (d.nome_fantasia && d.nome_fantasia.trim()) || d.nome || "";
};
