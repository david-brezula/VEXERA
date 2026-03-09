import { type Page } from "@playwright/test"

/**
 * Signs in to Vexera using email + password.
 * Credentials come from env vars (set in .env.test or CI secrets).
 */
export async function signIn(page: Page, options?: { email?: string; password?: string }) {
  const email = options?.email ?? process.env.E2E_USER_EMAIL ?? "test@example.com"
  const password = options?.password ?? process.env.E2E_USER_PASSWORD ?? "testpassword123"

  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /sign in/i }).click()

  // Wait for redirect to dashboard
  await page.waitForURL("/", { timeout: 15_000 })
}

/**
 * Signs out from Vexera.
 */
export async function signOut(page: Page) {
  // Click user avatar dropdown
  await page.getByRole("button", { name: /user avatar/i }).first().click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()
  await page.waitForURL("/login")
}
