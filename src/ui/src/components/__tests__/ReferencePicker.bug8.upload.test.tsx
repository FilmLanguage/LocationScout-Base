/**
 * Bug 8 (Wave 2, 2026-05-22) — behavioral verification of LS ReferencePicker
 * UploadTile.
 *
 * Audit summary (docs/sessions/2026-05-21-wave2/bug-8-audit.md):
 *   The audit concluded the Upload tile is rendered + wired correctly across
 *   all four agents (LS, CD, AD, ShotGen). User asked for behavioral
 *   confirmation in LS specifically — this test fulfills that ask.
 *
 * What this test verifies (LS only — sibling agents have their own tests):
 *   1) ReferencePicker renders an Upload control (label + file input pair)
 *      AND a Gallery control. Neither hidden by a conditional.
 *   2) The file input has type="file" and accept="image/*" — standard browser
 *      file picker semantics.
 *   3) Although the raw <input type="file"> has `display: none`, it lives
 *      inside a <label> wrapper that acts as the click surface — standard
 *      HTML accessibility pattern, fully keyboard + screen-reader operable.
 *   4) Simulating `change` on the input with a fake File triggers
 *      `callTool("upload_reference", { entity_id, base64_data, content_type, note })`
 *      with the right payload shape.
 *   5) After the upload resolves with a ReferenceRef, `onChange` fires with
 *      the new ref appended.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import {
  ReferencePicker,
  type ReferenceRef,
} from "../ReferencePicker";

// vi.mock hoists to the top of the file — replace the api/mcp module so we
// can spy on callTool without spinning the JSON-RPC transport.
const callToolSpy = vi.fn();
vi.mock("../../api/mcp", () => ({
  callTool: (...args: unknown[]) => callToolSpy(...args),
}));

beforeEach(() => {
  callToolSpy.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPicker(initialRefs: ReferenceRef[] = []) {
  const onChange = vi.fn();
  const utils = render(
    <ReferencePicker
      entity_id="loc_test_proj_001"
      value={initialRefs}
      onChange={onChange}
      bible_id="loc_test_proj_001"
    />,
  );
  return { ...utils, onChange };
}

describe("Bug 8 — LS ReferencePicker UploadTile renders and uploads", () => {
  it("renders an Upload control with the user-facing 'Upload' label", () => {
    const { container } = renderPicker();
    // The UploadTile uses a <label> wrapper with data-ref-upload. Both the
    // accessible label text and the data attribute should be present.
    const uploadLabel = container.querySelector("[data-ref-upload]");
    expect(uploadLabel).toBeInTheDocument();
    // User-visible text ("Upload" when idle, "Uploading" when busy)
    expect(screen.getByText(/upload/i)).toBeInTheDocument();
  });

  it("renders a sibling Gallery control (both controls visible by default)", () => {
    const { container } = renderPicker();
    const galleryBtn = container.querySelector("[data-ref-gallery]");
    expect(galleryBtn).toBeInTheDocument();
  });

  it("the Upload control contains a real <input type='file'> with accept='image/*'", () => {
    const { container } = renderPicker();
    const fileInput = container.querySelector(
      "[data-ref-upload] input[type='file']",
    ) as HTMLInputElement | null;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput?.accept).toBe("image/*");
  });

  it("the file input is inside a <label> wrapper — clicking the label opens the OS picker", () => {
    const { container } = renderPicker();
    const uploadLabel = container.querySelector("[data-ref-upload]");
    // The wrapper IS a <label>; this is the standard HTML pattern for
    // making a hidden <input type="file"> clickable across browsers /
    // screen readers.
    expect(uploadLabel?.tagName).toBe("LABEL");
    // The input is inside the label (so a click on the label propagates
    // to the input, opening the OS picker).
    const inputInside = uploadLabel?.querySelector("input[type='file']");
    expect(inputInside).toBeInTheDocument();
  });

  it("simulating a file change calls upload_reference with the right payload", async () => {
    callToolSpy.mockResolvedValueOnce({
      raw: {},
      data: {
        image_id: "abc12345",
        uri: "agent://location-scout/user-ref/loc_test_proj_001",
        kind: "user_upload",
        source_agent: "user",
      } as ReferenceRef,
    });

    const { container, onChange } = renderPicker();
    const fileInput = container.querySelector(
      "[data-ref-upload] input[type='file']",
    ) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Build a fake image file. The component encodes it as base64 via
    // FileReader.readAsDataURL — jsdom supports FileReader, so this round-trips.
    const fakeFile = new File(["fake png bytes"], "tiger.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    await waitFor(() => expect(callToolSpy).toHaveBeenCalled());
    expect(callToolSpy).toHaveBeenCalledTimes(1);
    const [toolName, args] = callToolSpy.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(toolName).toBe("upload_reference");
    expect(args.entity_id).toBe("loc_test_proj_001");
    expect(args.content_type).toBe("image/png");
    expect(typeof args.base64_data).toBe("string");
    expect((args.base64_data as string).length).toBeGreaterThan(0);
    expect(args.note).toMatch(/tiger\.png/);

    // After the mock resolves, onChange should be called with the new ref appended.
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const newValue = onChange.mock.calls[0][0] as ReferenceRef[];
    expect(newValue).toHaveLength(1);
    expect(newValue[0].image_id).toBe("abc12345");
  });

  it("when disabled prop is set, the file input has disabled attribute", () => {
    const { container } = render(
      <ReferencePicker
        entity_id="x"
        value={[]}
        onChange={() => {}}
        disabled
      />,
    );
    const fileInput = container.querySelector(
      "[data-ref-upload] input[type='file']",
    ) as HTMLInputElement;
    expect(fileInput).toBeDisabled();
  });
});
