export const MASTER_EMAILS = ["lula1973@gmail.com", "lula1973@gmail.com.br"];
export const isMasterEmail = (email?: string | null) =>
  !!email && MASTER_EMAILS.includes(email.toLowerCase());
