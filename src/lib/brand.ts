// Coach branding: team name, accent color and logo shown to their athletes

export interface Brand {
  name: string | null
  color: string | null
  logoUrl: string | null
}

export const BRAND_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#ca8a04', '#db2777']

export function cleanColor(c: string | null | undefined): string | null {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null
}

export function logoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/brand-logos/${path}` : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function brandFromRow(row: any): Brand | null {
  if (!row) return null
  const b = { name: row.brand_name?.trim() || null, color: cleanColor(row.brand_color), logoUrl: logoUrl(row.brand_logo_path) }
  return b.name || b.color || b.logoUrl ? b : null
}

/** Mix a color with white (amount 0..1) — used for readable text on the dark background */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/** Inline CSS variables for a branded area (see .branded rules in globals.css) */
export function brandStyle(brand: Brand | null): React.CSSProperties | undefined {
  if (!brand?.color) return undefined
  return { ['--brand' as string]: brand.color, ['--brand-text' as string]: lighten(brand.color, 0.35) } as React.CSSProperties
}
