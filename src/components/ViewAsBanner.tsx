import { Eye, LogOut } from 'lucide-react'
import { stopViewAs } from '@/app/actions/viewAs'
import type { ViewAs } from '@/lib/acting'

export function ViewAsBanner({ viewAs }: { viewAs: ViewAs }) {
  return (
    <div className="sticky top-14 md:top-0 z-30 bg-amber-500 text-black">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-2 flex items-center gap-3 text-sm">
        <Eye className="w-4 h-4 shrink-0" />
        <p className="flex-1 min-w-0 truncate">
          <span className="font-semibold">Viewing as {viewAs.name}</span>
          <span className="hidden sm:inline"> ({viewAs.kind}) — changes you make are saved to their account</span>
        </p>
        <form action={stopViewAs}>
          <button type="submit" className="flex items-center gap-1.5 rounded-md bg-black/80 text-white px-3 py-1 text-xs font-medium hover:bg-black">
            <LogOut className="w-3.5 h-3.5" /> Exit
          </button>
        </form>
      </div>
    </div>
  )
}
