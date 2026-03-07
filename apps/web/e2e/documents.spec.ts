import { test, expect } from "@playwright/test"
import { signIn } from "./helpers/auth"

test.describe("Documents", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("documents page loads", async ({ page }) => {
    await page.goto("/documents")
    await expect(page.getByRole("heading", { name: /documents/i })).toBeVisible()
  })

  test("has upload document button or area", async ({ page }) => {
    await page.goto("/documents")
    // Either an upload button or a dropzone
    const uploadEl = page.getByRole("button", { name: /upload/i })
      .or(page.getByText(/drag.*drop/i))
    await expect(uploadEl.first()).toBeVisible({ timeout: 10_000 })
  })

  test("filter by status works", async ({ page }) => {
    await page.goto("/documents?status=approved")
    await expect(page.getByRole("heading", { name: /documents/i })).toBeVisible()
    // No errors on the page
    await expect(page.getByText(/error/i)).not.toBeVisible()
  })
})
