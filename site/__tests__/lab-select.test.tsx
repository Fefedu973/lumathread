import { describe, expect, test } from "bun:test";
import { Fragment } from "react";
import {
  SelectContent,
  SelectItem,
  collectLabSelectItems,
} from "../features/lab/controls/lab-select";

describe("lab select labels", () => {
  test("collects displayed labels from nested select items", () => {
    const items = collectLabSelectItems<string>(
      <Fragment>
        <SelectContent>
          <SelectItem value="soft-aurora">Soft aurora</SelectItem>
          <SelectItem value="center-glow">Center glow</SelectItem>
        </SelectContent>
        <SelectItem value="custom">Custom settings</SelectItem>
      </Fragment>,
    );

    expect(items).toEqual([
      { value: "soft-aurora", label: "Soft aurora" },
      { value: "center-glow", label: "Center glow" },
      { value: "custom", label: "Custom settings" },
    ]);
  });
});
