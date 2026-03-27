"use client"

import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Input } from "@/shared/components/ui/input"
import { Switch } from "@/shared/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { Shield, AlertTriangle } from "lucide-react"

interface ArchivePolicy {
  id: string
  document_type: string
  retention_years: number
  auto_archive: boolean
  notify_before_expiry_days: number
}

interface ExpiringDocument {
  id: string
  document_type: string
  supplier_name: string | null
  issue_date: string | null
  retention_expires_at: string
  days_until_expiry: number
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json() as Promise<T>
}

const typeLabels: Record<string, string> = {
  invoice_received: "Prijaté faktúry",
  invoice_issued: "Vydané faktúry",
  receipt: "Pokladničné bločky",
  bank_statement: "Bankové výpisy",
  tax_document: "Daňové dokumenty",
  payroll: "Mzdové dokumenty",
  contract: "Zmluvy",
  other: "Ostatné",
}

export function ArchiveSettings() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  const { data: policies, isLoading: policiesLoading } = useQuery({
    queryKey: ["archive-policies", orgId],
    queryFn: async () => {
      const result = await fetchJson<{ data: ArchivePolicy[] }>(
        `/api/archive?organization_id=${orgId}`
      )
      return result.data
    },
    enabled: !!orgId,
  })

  const { data: expiring } = useQuery({
    queryKey: ["archive-expiring", orgId],
    queryFn: async () => {
      const result = await fetchJson<{ data: ExpiringDocument[] }>(
        `/api/archive?organization_id=${orgId}&type=expiring&days=90`
      )
      return result.data
    },
    enabled: !!orgId,
  })

  const initPolicies = useMutation({
    mutationFn: async () => {
      return fetchJson<{ data: { created: number } }>("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId }),
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["archive-policies", orgId] })
      toast.success(`Vytvorených ${result.data.created} archivačných pravidiel`)
    },
  })

  const updatePolicy = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      return fetchJson(`/api/archive/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive-policies", orgId] })
      toast.success("Pravidlo aktualizované")
    },
  })

  // Auto-initialize policies if none exist
  useEffect(() => {
    if (policies && policies.length === 0 && orgId) {
      initPolicies.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies, orgId])

  if (policiesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Retention Policies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <CardTitle>Archivačné pravidlá</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {policies && policies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ dokumentu</TableHead>
                  <TableHead className="text-right">Doba uchovávania (roky)</TableHead>
                  <TableHead>Auto-archivácia</TableHead>
                  <TableHead className="text-right">Upozornenie (dni pred)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">
                      {typeLabels[policy.document_type] ?? policy.document_type}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        className="w-20 text-right ml-auto"
                        defaultValue={policy.retention_years}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value)
                          if (val && val !== policy.retention_years) {
                            updatePolicy.mutate({ id: policy.id, retention_years: val })
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={policy.auto_archive}
                        onCheckedChange={(v) =>
                          updatePolicy.mutate({ id: policy.id, auto_archive: v })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={7}
                        max={365}
                        className="w-20 text-right ml-auto"
                        defaultValue={policy.notify_before_expiry_days}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value)
                          if (val && val !== policy.notify_before_expiry_days) {
                            updatePolicy.mutate({ id: policy.id, notify_before_expiry_days: val })
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Žiadne archivačné pravidlá</p>
              <Button onClick={() => initPolicies.mutate()} disabled={initPolicies.isPending}>
                Inicializovať predvolené pravidlá
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expiring Documents */}
      {expiring && expiring.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <CardTitle>Dokumenty s blížiacou sa expiráciou</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Dodávateľ</TableHead>
                  <TableHead>Dátum vydania</TableHead>
                  <TableHead>Expirácia</TableHead>
                  <TableHead className="text-right">Zostáva dní</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiring.slice(0, 20).map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {typeLabels[doc.document_type] ?? doc.document_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{doc.supplier_name ?? "—"}</TableCell>
                    <TableCell>{doc.issue_date ?? "—"}</TableCell>
                    <TableCell>{doc.retention_expires_at}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={doc.days_until_expiry <= 7 ? "destructive" : "secondary"}>
                        {doc.days_until_expiry} dní
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
