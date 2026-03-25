import { NextResponse } from 'next/server'

const SLACK_CHANNEL = process.env.SLACK_CHANNEL || 'C081Z8R4ZH9'

export async function POST(request) {
  try {
    const slackToken = process.env.SLACK_BOT_TOKEN
    if (!slackToken) {
      return NextResponse.json({ error: 'SLACK_BOT_TOKEN no configurado' }, { status: 500 })
    }

    const { text, channel } = await request.json()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${slackToken}`,
      },
      body: JSON.stringify({
        channel: channel || SLACK_CHANNEL,
        text,
        mrkdwn: true,
      }),
    })

    const data = await res.json()
    if (!data.ok) throw new Error(data.error || 'Slack API error')
    return NextResponse.json({ success: true, ts: data.ts })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
