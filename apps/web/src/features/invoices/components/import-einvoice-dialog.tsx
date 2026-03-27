"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UploadIcon, FileIcon, XIcon } from "lucide-react"
import { importEInvoiceAction } from "../actions-e-invoice"
import { Button } from "@/shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog"

export function ImportEInvoiceDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleFile = useCallback((f: File | null) => {
    if (f && !f.name.endsWith(".xml")) {
      toast.error("Vyberte XML súbor")
      return
    }
    setFile(f)
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleImport() {
    if (!file) return
    startTransition(async () => {
      try {
        const xmlContent = await file.text()
        const result = await importEInvoiceAction(xmlContent)
        if ("error" in result) {
          toast.error(result.error)
          return
        }
        toast.success("E-faktúra úspešne importovaná")
        setOpen(false)
        setFile(null)
        router.push(`/invoices/${result.invoiceId}`)
      } catch {
        toast.error("Nepodarilo sa prečítať XML súbor")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFile(null) }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadIcon className="size-4" />
          Importovať e-faktúru
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importovať e-faktúru</DialogTitle>
          <DialogDescription>
            Nahrajte UBL 2.1 alebo CII XML súbor pre automatické vytvorenie prijatej faktúry.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="flex items-center gap-2 text-sm">
              <FileIcon className="size-4 text-muted-foreground" />
              <span className="font-medium">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded-full p-0.5 hover:bg-muted"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ) : (
            <>
              <UploadIcon className="size-8 text-muted-foreground" />
              <div className="text-center text-sm text-muted-foreground">
                <p>Presuňte XML súbor sem, alebo</p>
                <label className="cursor-pointer font-medium text-primary hover:underline">
                  vyberte súbor
                  <input
                    type="file"
                    accept=".xml"
                    className="sr-only"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Zrušiť
          </Button>
          <Button onClick={handleImport} disabled={isPending || !file}>
            {isPending ? "Importujem..." : "Importovať"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
