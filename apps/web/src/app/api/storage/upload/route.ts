import { NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createClient } from "@/lib/supabase/server"
import { getS3Client, getS3BucketName, generateS3Key } from "@/lib/s3/client"

export async function POST(request: Request) {
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

    const body = await request.json()
    const { fileName, mimeType, organizationId } = body as {
      fileName: string
      mimeType: string
      organizationId: string
    }

    if (!fileName || !mimeType || !organizationId) {
      return NextResponse.json(
        { data: null, error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify user is a member of the organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { data: null, error: "Not a member of this organization" },
        { status: 403 }
      )
    }

    const s3 = getS3Client()
    const bucket = getS3BucketName()
    const filePath = generateS3Key(organizationId, fileName)

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      ContentType: mimeType,
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }) // 15 min

    return NextResponse.json({
      data: { uploadUrl, filePath },
      error: null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json(
      { data: null, error: message },
      { status: 500 }
    )
  }
}
