interface InvitationEmailProps {
  organizationName: string
  inviterName: string
  role: string
  inviteUrl: string
}

export function InvitationEmailHtml({ organizationName, inviterName, role, inviteUrl }: InvitationEmailProps) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #111; margin-bottom: 8px;">You've been invited to ${organizationName}</h2>
  <p style="color: #555; font-size: 16px; line-height: 1.5;">
    ${inviterName} has invited you to join <strong>${organizationName}</strong> as <strong>${role}</strong> on VEXERA.
  </p>
  <a href="${inviteUrl}" style="display: inline-block; background: #111; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 24px 0;">
    Accept Invitation
  </a>
  <p style="color: #999; font-size: 13px; margin-top: 32px;">
    This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
  </p>
</body>
</html>`
}
