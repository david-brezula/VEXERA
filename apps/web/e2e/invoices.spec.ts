import { test, expect } from "@playwright/test"
import { signIn } from "./helpers/auth"

test.describe("Invoices", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("invoices page loads", async ({ page }) => {
    await page.goto("/invoices")
    await expect(page.getByRole("heading", { name: /invoices/i })).toBeVisible()
  })

  test("new invoice page is accessible", async ({ page }) => {
    await page.goto("/invoices/new")
    await expect(page.getByRole("heading", { name: /new invoice|create invoice/i })).toBeVisible()
  })

  test("invoice form has required fields", async ({ page }) => {
    await page.goto("/invoices/new")
    await expect(page.getByLabel(/invoice number/i).or(page.getByPlaceholder(/INV-/i))).toBeVisible()
  })
})
