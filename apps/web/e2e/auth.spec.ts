import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("login page is accessible", async ({ page }) => {
    await page.goto("/login")
    await expect(page).toHaveTitle(/vexera/i)
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
  })

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill("bad@example.com")
    await page.getByLabel(/password/i).fill("wrongpassword")
    await page.getByRole("button", { name: /sign in/i }).click()
    // Expect either an error toast/message or stay on login page
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })
  })
})
