'use client'

import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Power } from 'lucide-react'
import { deleteForm, setFormActive } from '@/app/actions/forms'
import type { FormRow } from '@/lib/forms'
import { FormEditor } from './FormEditor'

export function FormRowActions({ form }: { form: FormRow }) {
  const router = useRouter()
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={async () => { await setFormActive(form.id, !form.active); router.refresh() }}
        className="p-1.5 text-zinc-500 hover:text-white"
        title={form.active ? 'Turn off' : 'Turn on'}
      >
        <Power className="w-4 h-4" />
      </button>
      <FormEditor form={form} trigger={<button className="p-1.5 text-zinc-500 hover:text-white" title="Edit"><Pencil className="w-4 h-4" /></button>} />
      <button
        onClick={async () => { if (confirm(`Delete "${form.title}" and all its responses?`)) { await deleteForm(form.id); router.refresh() } }}
        className="p-1.5 text-zinc-500 hover:text-red-400"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </span>
  )
}
