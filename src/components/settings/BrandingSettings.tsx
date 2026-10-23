'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Palette, Upload, Zap, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { saveBranding } from '@/app/actions/branding'
import { BRAND_COLORS } from '@/lib/brand'
import { cn } from '@/lib/utils'

export function BrandingSettings({ initial }: { initial: { name: string; color: string | null; logoUrl: string | null } }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState<string | null>(initial.color)
  const [preview, setPreview] = useState<string | null>(initial.logoUrl)
  const [file, setFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setMsg({ t: 'Use a PNG, JPG or WebP image.', ok: false }); return }
    if (f.size > 1024 * 1024) { setMsg({ t: 'Logo must be under 1 MB.', ok: false }); return }
    setFile(f); setRemoveLogo(false); setMsg(null)
    setPreview(URL.createObjectURL(f))
  }

  async function save() {
    setBusy(true); setMsg(null)
    let logoPath: string | null = null
    if (file) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setBusy(false); setMsg({ t: 'Please sign in again.', ok: false }); return }
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      logoPath = `${user.id}/logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('brand-logos').upload(logoPath, file, { contentType: file.type })
      if (error) { setBusy(false); setMsg({ t: `Logo upload failed: ${error.message}`, ok: false }); return }
    }
    const res = await saveBranding({ name, color, logoPath, removeLogo })
    setBusy(false)
    if (res && 'error' in res && res.error) { setMsg({ t: res.error, ok: false }); return }
    setFile(null)
    setMsg({ t: 'Saved — your athletes will see it next time they open PEAC.', ok: true })
    router.refresh()
  }

  const shown = color ?? '#2563eb'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="w-4 h-4 text-blue-400" /> Team branding</CardTitle>
        <p className="text-xs text-zinc-500 mt-1">Your logo, team name and color show for you, your staff and your athletes — on their menu, the Weight Room screen and your invite link.</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <label className="block text-xs text-zinc-400 space-y-1">
          Team name
          <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="e.g. Vela Performance" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>

        <div className="space-y-1.5">
          <p className="text-xs text-zinc-400">Color</p>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ backgroundColor: c, borderColor: shown === c ? '#fff' : 'transparent' }} aria-label={c}>
                {shown === c && <Check className="w-4 h-4 text-white" />}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <input type="color" value={shown} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded bg-transparent border border-zinc-700" />
              Custom
            </label>
            {color && <button onClick={() => setColor(null)} className="text-xs text-zinc-500 hover:text-white">Use PEAC blue</button>}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-zinc-400">Logo (PNG/JPG, under 1 MB — a square or wide logo on a clear background looks best)</p>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()}><Upload className="w-4 h-4" /> {preview ? 'Change logo' : 'Upload logo'}</Button>
            {preview && !removeLogo && (
              <button onClick={() => { setRemoveLogo(true); setFile(null); setPreview(null) }} className="text-xs text-zinc-500 hover:text-red-400">Remove logo</button>
            )}
          </div>
        </div>

        {/* Preview of the athlete's top bar */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Preview</p>
          <div className="flex items-center gap-2.5">
            {preview && !removeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-8 w-auto max-w-[7rem] object-contain" />
            ) : (
              <Zap className="w-6 h-6" style={{ color: shown, fill: shown }} />
            )}
            <span className="text-lg font-bold">{name.trim() || 'PEAC'}</span>
          </div>
          <div className="flex gap-2">
            <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: shown }}>Start workout</span>
            <span className={cn('rounded-lg px-3 py-1.5 text-sm font-medium border')} style={{ borderColor: shown, color: shown }}>Messages</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} loading={busy}>Save branding</Button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.t}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
