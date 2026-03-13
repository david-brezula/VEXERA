"use client"

import { useTransition } from "react"
import { FileCodeIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportPeppolUblAction } from "@/lib/actions/xml-export"

interface ExportUblButtonProps {
  invoiceId: string
}

export function ExportUblButton({ invoiceId }: ExportUblButtonProps) {
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    startTransition(async () => {
      const result = await exportPeppolUblAction(invoiceId)
      if ("error" in result) {
        // Could use toast here, but for now alert
        alert(result.error)
        return
      }
      const blob = new Blob([result.xml], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending}>
      {isPending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <FileCodeIcon className="size-4" />
      )}
      Export UBL
    </Button>
  )
}
