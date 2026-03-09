"use client"

import { PrinterIcon, XIcon } from "lucide-react"

export function PrintControls() {
  return (
    <div className="no-print fixed bottom-4 right-4 flex gap-2 z-10">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-white text-sm font-medium shadow hover:bg-gray-800"
      >
        <PrinterIcon className="size-4" />
        Save as PDF
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-gray-50"
      >
        <XIcon className="size-4" />
        Close
      </button>
    </div>
  )
}
