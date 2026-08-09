import { describe, expect, it } from 'vitest'
import { parseQoderCliModelList } from './qodercli-model-list'

const LISTING = `MODEL
Auto
Ultimate
Qwen3.8-Max
Peach-07-17-DogFooding (qwen3.8-v98-dogfood-crit)
`

describe('parseQoderCliModelList', () => {
  it('parses display names, skipping the header row', () => {
    expect(parseQoderCliModelList(LISTING)).toEqual([
      { id: 'Auto', label: 'Auto' },
      { id: 'Ultimate', label: 'Ultimate' },
      { id: 'Qwen3.8-Max', label: 'Qwen3.8-Max' },
      {
        id: 'Peach-07-17-DogFooding',
        label: 'Peach-07-17-DogFooding',
        description: 'qwen3.8-v98-dogfood-crit'
      }
    ])
  })

  it('dedupes repeated names and tolerates CRLF and blank lines', () => {
    expect(parseQoderCliModelList('MODEL\r\n\r\nAuto\r\nAuto\r\n')).toEqual([
      { id: 'Auto', label: 'Auto' }
    ])
  })

  it('returns no models for error or empty output', () => {
    expect(parseQoderCliModelList('')).toEqual([])
    expect(parseQoderCliModelList('\n\n')).toEqual([])
    // Header-less output (a logged-out CLI printing an error with exit 0)
    // must not be mistaken for a listing.
    expect(parseQoderCliModelList('Not logged in\nRun qodercli login\n')).toEqual([])
  })
})
