export const fmt = (n: number) =>
  n.toLocaleString("ru-RU").replace(/\u00A0/g, " ");

export const fmtUZS = (n: number) => `${fmt(n)} UZS`;
