import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, paginate } from "./pagination.js";

describe("encodeCursor / decodeCursor", () => {
  it("round-trips an offset", () => {
    const cursor = encodeCursor(10);
    expect(decodeCursor(cursor)).toEqual({ offset: 10 });
  });

  it("returns offset 0 for invalid cursor", () => {
    expect(decodeCursor("not-base64-json")).toEqual({ offset: 0 });
  });
});

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  it("returns first page with no cursor", () => {
    const result = paginate(items, undefined, 3);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.has_more).toBe(true);
    expect(result.total_count).toBe(7);
    expect(result.next_cursor).toBeTruthy();
  });

  it("returns second page using next_cursor", () => {
    const first = paginate(items, undefined, 3);
    const second = paginate(items, first.next_cursor!, 3);
    expect(second.items).toEqual([4, 5, 6]);
    expect(second.has_more).toBe(true);
  });

  it("returns last page with has_more false", () => {
    const first = paginate(items, undefined, 3);
    const second = paginate(items, first.next_cursor!, 3);
    const third = paginate(items, second.next_cursor!, 3);
    expect(third.items).toEqual([7]);
    expect(third.has_more).toBe(false);
    expect(third.next_cursor).toBeNull();
  });

  it("returns empty page for empty input", () => {
    const result = paginate([], undefined, 10);
    expect(result.items).toEqual([]);
    expect(result.has_more).toBe(false);
    expect(result.total_count).toBe(0);
  });
});
