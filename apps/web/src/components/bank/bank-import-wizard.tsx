"use client"

import { useRef, useState } from "react"
import { UploadIcon, Loader2Icon, CheckCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBankAccounts, useBankImport } from "@/hooks/use-bank"
import type { ImportResult } from "@/hooks/use-bank"

export function BankImportWizard() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const { data: accounts = [], isLoading: accountsLoading } = useBankAccounts()
  const bankImport = useBankImport()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setResult(null)
  }

  async function handleImport() {
    if (!selectedFile || !selectedAccountId) return
    const res = await bankImport.mutateAsync({
      file: selectedFile,
      bankAccountId: selectedAccountId,
    })
    setResult(res)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Import Bank Statement</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV or XML bank statement to import transactions.
        </p>
      </div>

      {/* Account selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Bank Account</label>
        <Select
          value={selectedAccountId}
          onValueChange={setSelectedAccountId}
          disabled={accountsLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an account…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.bank_name} — {account.iban}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* File picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Statement File</label>
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="size-8 mx-auto mb-2 text-muted-foreground" />
          {selectedFile ? (
            <p className="text-sm font-medium">{selectedFile.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click to select a CSV or XML file
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <Button
        onClick={handleImport}
        disabled={!selectedFile || !selectedAccountId || bankImport.isPending}
        className="w-full"
      >
        {bankImport.isPending ? (
          <>
            <Loader2Icon className="size-4 animate-spin mr-2" />
            Importing…
          </>
        ) : (
          <>
            <UploadIcon className="size-4 mr-2" />
            Import Transactions
          </>
        )}
      </Button>

      {/* Result summary */}
      {result && (
        <div className="rounded-lg border bg-card backdrop-blur-xl p-4 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircleIcon className="size-4 text-green-500" />
            Import complete
          </div>
          <p className="text-sm text-muted-foreground">
            {result.imported} imported · {result.duplicates} duplicates skipped ·{" "}
            {result.reconciled} auto-matched
          </p>
          {result.errors.length > 0 && (
            <p className="text-sm text-destructive">
              {result.errors.length} error(s): {result.errors[0]}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
