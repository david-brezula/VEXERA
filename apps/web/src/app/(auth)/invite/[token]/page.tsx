"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// TODO: Phase 2 — Invitation acceptance flow
export default function InvitePage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Invitation</CardTitle>
        <CardDescription>
          Invitation acceptance will be available in Phase 2.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          This feature is coming soon.
        </p>
      </CardContent>
    </Card>
  )
}
