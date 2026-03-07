import { test, expect } from "@playwright/test"
import { signIn } from "./helpers/auth"

test.describe("Rules", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test("rules page loads", async ({ page }) => {
    await page.goto("/rules")
    await expect(page.getByRole("heading", { name: /rules/i })).toBeVisible()
  })

  test("can open new rule dialog", async ({ page }) => {
    await page.goto("/rules")
    const createBtn = page.getByRole("button", { name: /new rule|create rule|add rule/i })
    await expect(createBtn).toBeVisible()
    await createBtn.click()
    await expect(page.getByRole("dialog")).toBeVisible()
  })
})
