import { describe, expect, it } from 'vitest'
import { botAvatarUrls, userAvatarUrl } from './avatars'

describe('avatar locations', () => {
  it('lists where a bot picture can be, png first', () => {
    expect(botAvatarUrls('easy')).toEqual(['/avatars/bots/easy.png', '/avatars/bots/easy.webp', '/avatars/bots/easy.jpg'])
    expect(botAvatarUrls('maia-1500')[0]).toBe('/avatars/bots/maia-1500.png')
  })

  it('keeps odd characters out of the path', () => {
    expect(botAvatarUrls('a/b ?')[0]).toBe('/avatars/bots/a%2Fb%20%3F.png')
  })

  it('treats an empty picture setting as no picture', () => {
    expect(userAvatarUrl(undefined)).toBeNull()
    expect(userAvatarUrl('  ')).toBeNull()
    expect(userAvatarUrl(' https://x.test/me.png ')).toBe('https://x.test/me.png')
  })
})
