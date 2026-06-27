import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'BIZOS <noreply@bizquad.com>'

export type NotificationType =
  | 'candidate_stuck'
  | 'new_assignment'
  | 'report_due'
  | 'interview_reminder'
  | 'weekly_summary'

interface NotifyPayload {
  type: NotificationType
  to: string
  data: Record<string, any>
}

export async function POST(request: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const { type, to, data } = (await request.json()) as NotifyPayload

  let subject = ''
  let html = ''

  switch (type) {
    case 'candidate_stuck':
      subject = `⚠️ Candidate stuck: ${data.candidateName}`
      html = `<p>Hi ${data.recruiterName},</p>
        <p><strong>${data.candidateName}</strong> has been in the <em>${data.stage}</em> stage for <strong>${data.days} days</strong> on <em>${data.openingTitle}</em>.</p>
        <p>Please review and take action.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/openings/${data.openingId}">View Opening →</a></p>`
      break

    case 'new_assignment':
      subject = `New opening assigned: ${data.openingTitle}`
      html = `<p>Hi ${data.recruiterName},</p>
        <p>You've been assigned to a new opening: <strong>${data.openingTitle}</strong> at <em>${data.clientName}</em>.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/openings/${data.openingId}">View Opening →</a></p>`
      break

    case 'report_due':
      subject = `Weekly report due: ${data.clientName}`
      html = `<p>A weekly report for <strong>${data.clientName}</strong> is due.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/reports?client=${data.clientId}&new=1">Generate Report →</a></p>`
      break

    case 'interview_reminder':
      subject = `Interview reminder: ${data.candidateName} — Round ${data.round}`
      html = `<p>Reminder: Interview with <strong>${data.candidateName}</strong> (Round ${data.round}) for <em>${data.openingTitle}</em> is scheduled for <strong>${data.scheduledAt}</strong>.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/candidates/${data.candidateId}">View Candidate →</a></p>`
      break

    case 'weekly_summary':
      subject = `BIZOS Weekly Summary — ${data.weekLabel}`
      html = `<p>Hi ${data.name},</p>
        <h3>Your week in summary:</h3>
        <ul>
          <li>Resumes sourced: <strong>${data.resumes}</strong></li>
          <li>Submissions: <strong>${data.submissions}</strong></li>
          <li>Interviews: <strong>${data.interviews}</strong></li>
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">View Dashboard →</a></p>`
      break

    default:
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
  }

  const { data: result, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject,
    html,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: result?.id })
}
