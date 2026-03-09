import { test, expect } from "@playwright/test"
import { signIn } from "./helpers/auth"

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("shows dashboard with stat cards", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible()
    await expect(page.getByText(/total invoices/i)).toBeVisible()
    await expect(page.getByText(/documents/i)).toBeVisible()
    await expect(page.getByText(/revenue/i)).toBeVisible()
  })

  test("sidebar navigation is visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: /invoices/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /documents/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /bank/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /rules/i })).toBeVisible()
  })

  test("quick actions buttons are present", async ({ page }) => {
    await expect(page.getByRole("link", { name: /new invoice/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /upload document/i })).toBeVisible()
  })
})
