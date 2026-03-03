import { NextResponse } from "next/server"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createClient } from "@/lib/supabase/server"
import { getS3Client, getS3BucketName } from "@/lib/s3/client"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get("path")

    if (!filePath) {
      return NextResponse.json(
        { data: null, error: "Missing file path" },
        { status: 400 }
      )
    }

    // Extract organizationId from the path (first segment)
    const organizationId = filePath.split("/")[0]

    if (!organizationId) {
      return NextResponse.json(
        { data: null, error: "Invalid file path" },
        { status: 400 }
      )
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    const { data: accountantAccess } = await supabase
      .from("accountant_clients")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("accountant_id", user.id)
      .eq("status", "active")
      .single()

    if (!membership && !accountantAccess) {
      return NextResponse.json(
        { data: null, error: "Access denied" },
        { status: 403 }
      )
    }

    const s3 = getS3Client()
    const bucket = getS3BucketName()

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: filePath,
    })

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }) // 5 min

    return NextResponse.json({
      data: { downloadUrl },
      error: null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Download failed"
    return NextResponse.json(
      { data: null, error: message },
      { status: 500 }
    )
  }
}
