import { describe, expect, it } from "vitest";

describe("frontend smoke", () => {
  it("runs in jsdom", () => {
    document.body.innerHTML = "<main>hello test</main>";
    expect(document.querySelector("main")).not.toBeNull();
  });
});
