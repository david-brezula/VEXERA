/**
 * Storage Service — S3 presigned URL generation for document upload and download.
 *
 * Wraps the raw S3 client (lib/s3/client.ts) with typed helper functions.
 * Used by document.service.ts and any API route that needs direct S3 URLs.
 */

import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getS3Client, getS3BucketName, generateS3Key } from "@/lib/s3/client"

/** Presigned PUT URL expires in 15 minutes */
export const UPLOAD_EXPIRES_IN = 900

/** Presigned GET URL expires in 1 hour */
export const DOWNLOAD_EXPIRES_IN = 3600

/**
 * Generate a presigned PUT URL for client-side direct upload to S3.
 * Returns both the URL and the S3 key to store in the DB.
 */
export async function getUploadPresignedUrl(params: {
  organizationId: string
  fileName: string
  mimeType: string
}): Promise<{ uploadUrl: string; filePath: string }> {
  const s3 = getS3Client()
  const bucket = getS3BucketName()
  const filePath = generateS3Key(params.organizationId, params.fileName)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: filePath,
    ContentType: params.mimeType,
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: UPLOAD_EXPIRES_IN })
  return { uploadUrl, filePath }
}

/**
 * Generate a presigned GET URL for reading/downloading a stored file.
 */
export async function getDownloadPresignedUrl(filePath: string): Promise<string> {
  const s3 = getS3Client()
  const bucket = getS3BucketName()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: filePath,
  })

  return getSignedUrl(s3, command, { expiresIn: DOWNLOAD_EXPIRES_IN })
}
