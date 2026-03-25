import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MONDAY_API_URL = 'https://api.monday.com/v2'
const BOARD_ID = process.env.MONDAY_BOARD_ID || '18044324200'

const COL_IDS = ['person', 'color_mkz0s203', 'color_mkz09na', 'timerange_mkzcqv0j', 'date_mm1b10rx', 'date_mkzchmsq']

async function fetchPage(apiKey, cursor = null) {
  const filterArg = cursor ? '' : `, filters: [{columnId: "group", compareValue: ["group_mm15cfz2"], operator: any_of}]`
  const cursorArg = cursor ? `, cursor: "${cursor}"` : ''

  const query = `
    query {
      next_items_page(limit: 100${cursorArg}) {
        cursor
        items {
          id
          name
          group { id title }
          column_values(ids: ${JSON.stringify(COL_IDS)}) {
            id
            text
            value
            column { id title type }
          }
          subitems {
            id
            name
            column_values(ids: ["person"]) {
              id text value column { id type }
            }
          }
        }
      }
    }
  `

  // First page uses boards query with filter
  const firstQuery = `
    query {
      boards(ids: [${BOARD_ID}]) {
        groups { id title color }
        columns { id title type }
        items_page(limit: 100${filterArg}) {
          cursor
          items {
            id
            name
            group { id title }
            column_values(ids: ${JSON.stringify(COL_IDS)}) {
              id text value column { id title type }
            }
            subitems {
              id name
              column_values(ids: ["person"]) {
                id text value column { id type }
              }
            }
          }
        }
      }
    }
  `

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query: cursor ? query : firstQuery }),
  })

  if (!res.ok) throw new Error(`Monday API HTTP error: ${res.status}`)
  const data = await res.json()
  if (data.errors) throw new Error(data.errors[0]?.message || 'GraphQL error')
  return data
}

export async function GET() {
  try {
    const apiKey = process.env.MONDAY_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'MONDAY_API_KEY no configurada' }, { status: 500 })

    // Fetch first page (includes groups + columns metadata)
    const firstData = await fetchPage(apiKey)
    const board = firstData.data?.boards?.[0]
    if (!board) throw new Error('No se encontró el board')

    let allItems = [...(board.items_page?.items || [])]
    let cursor = board.items_page?.cursor

    // Paginate if needed
    let page = 0
    while (cursor && page < 10) {
      const nextData = await fetchPage(apiKey, cursor)
      const nextPage = nextData.data?.next_items_page
      allItems = [...allItems, ...(nextPage?.items || [])]
      cursor = nextPage?.cursor
      page++
    }

    return NextResponse.json({
      items: allItems,
      groups: board.groups || [],
      columns: board.columns || [],
      total: allItems.length,
      ts: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    console.error('Monday API error:', error)
    return NextResponse.json({ error: error.message || 'Error al cargar datos' }, { status: 500 })
  }
}
