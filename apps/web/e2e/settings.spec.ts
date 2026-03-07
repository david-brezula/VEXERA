import { test, expect } from "@playwright/test"
import { signIn } from "./helpers/auth"

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("settings page loads with org form", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible()
    // Should have org name field
    await expect(page.getByLabel(/organization name|company name/i)).toBeVisible()
  })

  test("integrations section shows Gmail connect", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByText(/gmail|integrations/i).first()).toBeVisible()
  })
})
