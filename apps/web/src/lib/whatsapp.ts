// Utilidades para enlaces de WhatsApp (wa.me) hacia el contacto del cliente.

/** Teléfono chileno a formato internacional para wa.me (solo dígitos, con 56). */
export function telefonoWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const d = telefono.replace(/\D/g, '')
  if (d.startsWith('56')) return d
  if (d.length === 9 && d.startsWith('9')) return `56${d}`
  if (d.length === 8) return `569${d}`
  return d || null
}

/**
 * Enlace wa.me. Si hay teléfono válido, abre el chat DIRECTO con ese contacto;
 * si no, abre el selector de WhatsApp con el mensaje precargado.
 */
export function waLink(telefono: string | null | undefined, texto: string): string {
  const tel = telefonoWhatsapp(telefono)
  const t = encodeURIComponent(texto)
  return tel ? `https://wa.me/${tel}?text=${t}` : `https://wa.me/?text=${t}`
}
