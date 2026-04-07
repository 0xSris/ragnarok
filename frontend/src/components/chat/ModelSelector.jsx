import { ChevronDown, Cpu } from 'lucide-react'

export default function ModelSelector({ models, value, onChange }) {
  return (
    <div className="relative flex items-center gap-2">
      <Cpu size={14} className="text-purple-400 shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rag-input py-1.5 pr-8 text-sm w-36 appearance-none cursor-pointer"
      >
        {models.length === 0 && <option value="llama3">llama3</option>}
        {models.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
    </div>
  )
}
