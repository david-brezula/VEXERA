import { test, expect } from "@playwright/test"
import { signIn } from "./helpers/auth"

test.describe("Inbox", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("inbox page loads", async ({ page }) => {
    await page.goto("/inbox")
    await expect(page.getByRole("heading", { name: /inbox/i })).toBeVisible()
  })

  test("shows stats cards", async ({ page }) => {
    await page.goto("/inbox")
    // Stats cards should be visible (new, auto-processed, awaiting review, approved today)
    await expect(page.getByText(/new|auto.processed|awaiting/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
