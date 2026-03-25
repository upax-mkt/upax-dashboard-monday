import { NextResponse } from 'next/server'

const MONDAY_API_URL = 'https://api.monday.com/v2'

export async function GET() {
  try {
    const boardId = process.env.MONDAY_BOARD_ID || '18044324200'

    const query = `
      query {
        boards(ids: [${boardId}]) {
          id
          name
          columns { id title type }
          groups { id title color }
          items_page(limit: 200) {
            items {
              id
              name
              group { id title color }
              column_values {
                id text value
                column { title type }
              }
              created_at
              updated_at
            }
          }
        }
      }
    `

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MONDAY_API_KEY,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Monday API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'Monday API error')
    }

    return NextResponse.json({ board: data.data.boards[0] })
  } catch (error) {
    console.error('Monday API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch board data' },
      { status: 500 }
    )
  }
}
