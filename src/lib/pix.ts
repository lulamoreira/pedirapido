// Gera um "PIX Copia e Cola" simulado no formato BR Code (EMV).
// Não é validado por bancos — apenas visual para demonstração.

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const tlv = (id: string, value: string) =>
  `${id}${value.length.toString().padStart(2, "0")}${value}`;

export function generatePixCode(params: {
  chave: string;
  nome: string;
  cidade: string;
  valor: number;
  txId?: string;
}): string {
  const { chave, nome, cidade, valor, txId = "AQUAFLOW" } = params;
  const merchantAccount = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", chave);
  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", valor.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", nome.slice(0, 25)) +
    tlv("60", cidade.slice(0, 15)) +
    tlv("62", tlv("05", txId.slice(0, 25)));
  payload += "6304";
  return payload + crc16(payload);
}
