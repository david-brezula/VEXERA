import { S3Client } from "@aws-sdk/client-s3"

export function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "eu-central-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  })
}

export function getS3BucketName() {
  const bucket = process.env.AWS_S3_BUCKET_NAME
  if (!bucket) throw new Error("AWS_S3_BUCKET_NAME is not configured")
  return bucket
}

/**
 * Generate an S3 key for a file upload.
 * Format: {organizationId}/{year}/{month}/{uuid}/{filename}
 */
export function generateS3Key(
  organizationId: string,
  filename: string
): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const uuid = crypto.randomUUID()
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${organizationId}/${year}/${month}/${uuid}/${sanitized}`
}
