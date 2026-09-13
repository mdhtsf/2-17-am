// Run with Playwright browser_run_code_unsafe(filename=...).
// This explicitly mocks HTTP at the browser boundary; it is NOT vercel dev E2E.
async (page) => {
  const requests = []
  let mode = 'success'
  let delay = 350
  const fake = {
    kai: '夜班。总得有人醒着。',
    mira: '论文还没写完。准确地说，是我还不愿意承认它没写完。',
  }
  await page.route('**/api/chat', async route => {
    const body = route.request().postDataJSON()
    requests.push(body)
    const responseMode = mode
    await page.waitForTimeout(delay)
    await route.fulfill({
      status: responseMode === 'error' ? 500 : 200,
      contentType: 'application/json',
      body: JSON.stringify(responseMode === 'error' ? { error: 'unavailable' } : { reply: fake[body.npc] }),
    }).catch(() => {}) // The abort-on-close case can dispose this route.
  })
  const check = (value, label) => { if (!value) throw new Error(label) }
  try {
    await page.goto('http://127.0.0.1:5173/')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: '与 KAI 对话' }).click()
    const input = page.getByRole('textbox')
    await input.fill('   ')
    check(await page.getByRole('button', { name: '发送', exact: true }).isDisabled(), 'empty message must be disabled')
    await input.fill('今晚忙吗？')
    // Composition-confirmation Enter must not submit the form.
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
    check(requests.length === 0, 'IME Enter sent a request')
    await input.press('Enter')
    await page.waitForFunction(() => document.querySelector('.request-status').textContent === '…')
    check(await page.getByRole('button', { name: '发送', exact: true }).isDisabled(), 'loading must lock send')
    await input.press('Enter')
    await page.waitForFunction(() => document.querySelector('.spoken').textContent === '夜班。总得有人醒着。')
    check(requests.length === 1, 'duplicate send was not blocked')
    await input.fill('你经常上夜班吗？')
    await input.press('Enter')
    await page.waitForFunction(() => document.querySelector('.dialogue-input input').value === '')
    check(requests.length === 2 && requests[1].history.length === 2, 'second round history invalid')
    check(requests[1].history[0].role === 'user' && requests[1].history[1].role === 'assistant', 'history roles invalid')
    await page.getByRole('button', { name: '与 MIRA 对话' }).click()
    await page.getByRole('textbox').fill('论文怎么样了？')
    await page.getByRole('textbox').press('Enter')
    await page.waitForFunction(() => document.querySelector('.spoken').textContent.startsWith('论文还没写完。'))
    check(requests[2].npc === 'mira' && requests[2].history.length === 0, 'NPC history mixed')
    mode = 'error'
    await page.getByRole('textbox').fill('还需要多久？')
    await page.getByRole('textbox').press('Enter')
    await page.getByRole('alert').waitFor()
    check(await page.getByRole('textbox').inputValue() === '还需要多久？', 'failure lost draft')
    check(await page.locator('.spoken').innerText() === fake.mira, 'failure destroyed prior reply')
    mode = 'success'
    await page.getByRole('textbox').press('Enter')
    await page.waitForFunction(() => document.querySelector('.dialogue-input input').value === '')
    check(requests[3].history.length === 2 && requests[4].history.length === 2, 'failed turn polluted history')
    await page.getByRole('button', { name: '与 KAI 对话' }).click()
    check(await page.locator('.spoken').innerText() === fake.kai, 'switch lost successful history')
    delay = 650
    await page.getByRole('textbox').fill('这句取消')
    await page.getByRole('textbox').press('Enter')
    await page.waitForFunction(() => document.querySelector('.request-status').textContent === '…')
    await page.getByRole('button', { name: '与 MIRA 对话' }).click()
    await page.waitForTimeout(750)
    check(await page.locator('.spoken').innerText() === fake.mira, 'cancelled reply crossed NPCs')
    for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size)
      const panel = await page.locator('.dialogue').boundingBox()
      check(panel.y >= 0 && panel.y + panel.height <= size.height, 'panel outside viewport')
    }
    await page.getByRole('button', { name: '摸摸猫' }).click()
    check((await page.getByRole('status').filter({ hasText: '猫看了' }).innerText()).includes('没什么意思'), 'cat feedback changed')
    return { passed: true, requestCount: requests.length, historyLengths: requests.map(r => r.history.length), checks: ['empty', 'IME Enter', 'loading', 'duplicate guard', 'two turns', 'NPC isolation', 'failure/retry', 'abort on switch', 'responsive', 'cat'] }
  } finally {
    await page.unroute('**/api/chat')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.reload()
  }
}
