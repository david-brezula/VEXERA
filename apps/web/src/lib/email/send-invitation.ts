import { Resend } from "resend"
import { InvitationEmailHtml } from "./invitation-template"

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendInvitationParams {
  to: string
  organizationName: string
  inviterName: string
  role: string
  token: string
}

export async function sendInvitationEmail({ to, organizationName, inviterName, role, token }: SendInvitationParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const inviteUrl = `${appUrl}/auth/invite/${token}`

  const { error } = await resend.emails.send({
    from: "VEXERA <noreply@vexera.sk>",
    to,
    subject: `You've been invited to ${organizationName}`,
    html: InvitationEmailHtml({ organizationName, inviterName, role, inviteUrl }),
  })

  if (error) throw new Error(`Failed to send invitation email: ${error.message}`)
}
