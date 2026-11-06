import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { AppVersion } from "./app-version";

describe("app version", () => {
  it("shows the package version in a fixed bottom-right label", () => {
    const html = renderToStaticMarkup(createElement(AppVersion));
    expect(html).toContain(`v${packageJson.version}`);
    expect(html).toContain("fixed bottom-3 right-3");
  });
});
