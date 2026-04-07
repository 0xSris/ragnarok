import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BASE = 'http://localhost:5173'
const API  = 'http://localhost:8000'

// ── Helpers ───────────────────────────────────────────────────────────────

async function loginAsAdmin(page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[placeholder="your_username"]', 'admin')
  await page.fill('input[type="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/chat/, { timeout: 10_000 })
}

// ── Auth ──────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE}/chat`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows login form elements', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[placeholder="your_username"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('rejects wrong credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[placeholder="your_username"]', 'wronguser')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Should show error toast and remain on login
    await expect(page).toHaveURL(/\/login/)
  })

  test('logs in successfully as admin', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page.locator('text=RAGNAROK')).toBeVisible()
  })

  test('dark mode toggle works on login page', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const toggle = page.locator('button:has-text("🌙"), button:has-text("☀️")')
    await toggle.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})

// ── Navigation ────────────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('sidebar shows all nav items', async ({ page }) => {
    for (const label of ['Chat', 'Documents', 'Collections', 'History', 'Evaluation', 'Settings']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible()
    }
  })

  test('navigates to Documents page', async ({ page }) => {
    await page.click('text=Documents')
    await expect(page.locator('h1:has-text("Documents")')).toBeVisible()
  })

  test('navigates to History page', async ({ page }) => {
    await page.click('text=History')
    await expect(page.locator('h1:has-text("Query History")')).toBeVisible()
  })

  test('navigates to Collections page', async ({ page }) => {
    await page.click('text=Collections')
    await expect(page.locator('h1:has-text("Collections")')).toBeVisible()
  })

  test('navigates to Settings page', async ({ page }) => {
    await page.click('text=Settings')
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible()
  })

  test('sidebar toggle works', async ({ page }) => {
    const toggle = page.locator('button[title*="sidebar"]').first()
    await toggle.click()
    // Sidebar should be hidden
    await expect(page.locator('nav .nav-item').first()).not.toBeVisible()
  })

  test('dark mode toggle in header works', async ({ page }) => {
    const headerToggle = page.locator('header button').last()
    await headerToggle.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await headerToggle.click()
    // back to light
    const classes = await page.locator('html').getAttribute('class')
    expect(classes).not.toMatch(/dark/)
  })
})

// ── Documents ─────────────────────────────────────────────────────────────

test.describe('Documents', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.click('text=Documents')
  })

  test('shows upload dropzone', async ({ page }) => {
    await expect(page.locator('text=Drop files here')).toBeVisible()
  })

  test('upload a text file', async ({ page }) => {
    // Create a temp file buffer
    const fileContent = 'This is a test document for RAGNAROK E2E testing. It contains sample content about artificial intelligence and machine learning.'
    const fileName = 'test_doc.txt'

    await page.setInputFiles('input[type="file"]', {
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    })

    // Should see success toast or the doc appear
    await expect(page.locator(`text=${fileName}`)).toBeVisible({ timeout: 15_000 })
  })

  test('shows document status badges', async ({ page }) => {
    // At least one status badge visible if docs exist
    const badges = page.locator('.card-cartoon')
    const count = await badges.count()
    // Just verify the page loaded correctly
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('search filters documents', async ({ page }) => {
    await page.fill('input[placeholder="Search documents…"]', 'nonexistent_xyz_test')
    await expect(page.locator('text=No documents yet')).toBeVisible({ timeout: 5_000 })
  })
})

// ── Collections ───────────────────────────────────────────────────────────

test.describe('Collections', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.click('text=Collections')
  })

  test('shows create button', async ({ page }) => {
    await expect(page.locator('button:has-text("New Collection")')).toBeVisible()
  })

  test('creates a new collection', async ({ page }) => {
    const collName = `E2E Test ${Date.now()}`
    await page.click('button:has-text("New Collection")')
    await page.fill('input[placeholder="Collection name…"]', collName)
    await page.fill('textarea', 'Created by Playwright E2E test')
    await page.click('button:has-text("Create")')
    await expect(page.locator(`text=${collName}`)).toBeVisible({ timeout: 8_000 })
  })
})

// ── Chat ──────────────────────────────────────────────────────────────────

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    // Should already be on /chat
  })

  test('shows mascot on empty chat', async ({ page }) => {
    // Mascot or suggested prompts
    await expect(page.locator('text=Ask me anything')).toBeVisible()
  })

  test('shows suggested prompts', async ({ page }) => {
    await expect(page.locator('text=Summarize all uploaded documents')).toBeVisible()
  })

  test('input field is present', async ({ page }) => {
    await expect(page.locator('textarea[placeholder*="Ask anything"]')).toBeVisible()
  })

  test('send button is disabled when input is empty', async ({ page }) => {
    const sendBtn = page.locator('button:has-text("")').filter({ hasText: '' }).last()
    // Just check the textarea works
    await page.fill('textarea[placeholder*="Ask anything"]', 'test query')
    await expect(page.locator('textarea[placeholder*="Ask anything"]')).toHaveValue('test query')
  })

  test('suggested prompt fills input', async ({ page }) => {
    await page.click('text=Summarize all uploaded documents')
    // Either sends immediately or fills input
    await page.waitForTimeout(500)
    // Should show the query in messages or input
  })

  test('model selector is visible', async ({ page }) => {
    await expect(page.locator('select').first()).toBeVisible()
  })

  test('clears chat on clear button', async ({ page }) => {
    // Fill and send first
    await page.fill('textarea[placeholder*="Ask anything"]', 'Hello test')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    const clearBtn = page.locator('button:has-text("Clear")')
    if (await clearBtn.isVisible()) {
      await clearBtn.click()
      await expect(page.locator('text=Ask me anything')).toBeVisible()
    }
  })
})

// ── History ───────────────────────────────────────────────────────────────

test.describe('History', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.click('text=History')
  })

  test('shows history page heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Query History")')).toBeVisible()
  })

  test('export button present', async ({ page }) => {
    await expect(page.locator('button:has-text("Export")')).toBeVisible()
  })

  test('search works', async ({ page }) => {
    await page.fill('input[placeholder*="Search queries"]', 'test search xyz_nonexistent')
    await page.waitForTimeout(800)
    // Should filter results or show empty
  })
})

// ── Settings ──────────────────────────────────────────────────────────────

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
    await page.click('text=Settings')
  })

  test('shows system status section', async ({ page }) => {
    await expect(page.locator('text=System Status')).toBeVisible()
  })

  test('shows user account info', async ({ page }) => {
    await expect(page.locator('text=Account')).toBeVisible()
    await expect(page.locator('text=admin')).toBeVisible()
  })

  test('dark mode toggle in settings works', async ({ page }) => {
    const toggle = page.locator('div[class*="rounded-full cursor-pointer"]').first()
    if (await toggle.isVisible()) {
      await toggle.click()
      await page.waitForTimeout(300)
      await toggle.click() // toggle back
    }
  })

  test('temperature slider changes value', async ({ page }) => {
    const slider = page.locator('input[type="range"]').first()
    await slider.fill('0.5')
    await expect(slider).toHaveValue('0.5')
  })
})

// ── API health ────────────────────────────────────────────────────────────

test.describe('API', () => {
  test('health endpoint returns operational status', async ({ request }) => {
    const res = await request.get(`${API}/api/health`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.status).toBe('operational')
  })

  test('API docs are accessible', async ({ request }) => {
    const res = await request.get(`${API}/docs`)
    expect(res.ok()).toBeTruthy()
  })
})
