export function createSharePayload(text: string): string {
  return `SQLForge\n${text}`;
}

export function createWhatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(createSharePayload(text))}`;
}
