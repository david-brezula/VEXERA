import { test, expect } from "@playwright/test"
import { signIn } from "./helpers/auth"

test.describe("Bank", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("bank page loads with tabs", async ({ page }) => {
    await page.goto("/bank")
    await expect(page.getByRole("heading", { name: /bank/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /transactions/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /import/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /reconcile/i })).toBeVisible()
  })

  test("import tab shows file upload area", async ({ page }) => {
    await page.goto("/bank?tab=import")
    const importEl = page.getByRole("tab", { name: /import/i })
    await importEl.click()
    await expect(page.getByText(/csv|mt940|import/i).first()).toBeVisible()
  })
})
