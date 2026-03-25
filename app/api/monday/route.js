import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MONDAY_API_URL = 'https://api.monday.com/v2'

export async function GET() {
    try {
          const boardId = process.env.MONDAY_BOARD_ID || '18044324200'
          const apiKey = process.env.MONDAY_API_KEY

      if (!apiKey) {
              return NextResponse.json(
                { error: 'MONDAY_API_KEY no configurada' },
                { status: 500 }
                      )
      }

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
                                                                                                                                                          id
                                                                                                                                                                          text
                                                                                                                                                                                          value
                                                                                                                                                                                                          column { id title type }
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
                        'Authorization': apiKey,
                        'API-Version': '2024-01',
              },
              body: JSON.stringify({ query }),
      })

      if (!response.ok) {
              const errorText = await response.text()
              console.error('Monday API HTTP error:', response.status, errorText)
              throw new Error(`Monday API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.errors) {
              console.error('Monday GraphQL errors:', data.errors)
              throw new Error(data.errors[0]?.message || 'Monday API GraphQL error')
      }

      if (!data.data || !data.data.boards) {
              throw new Error('Respuesta inesperada de Monday API')
      }

      return NextResponse.json(
        { board: data.data.boards[0] },
        {
                  headers: {
                              'Cache-Control': 'no-store, no-cache, must-revalidate',
                  },
        }
            )
    } catch (error) {
          console.error('Monday API error:', error)
          return NextResponse.json(
            { error: error.message || 'Failed to fetch board data' },
            { status: 500 }
                )
    }
}
