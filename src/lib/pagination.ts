/**
 * Cursor-based pagination helper.
 * Encodes/decodes opaque cursors as base64 offset strings.
 */

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64");
}

export function decodeCursor(cursor: string): { offset: number } {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
  } catch {
    return { offset: 0 };
  }
}

export function paginate<T>(items: T[], cursor: string | undefined, limit: number) {
  const { offset } = cursor ? decodeCursor(cursor) : { offset: 0 };
  const page = items.slice(offset, offset + limit);
  const hasMore = offset + limit < items.length;
  return {
    items: page,
    next_cursor: hasMore ? encodeCursor(offset + limit) : null,
    has_more: hasMore,
    total_count: items.length,
  };
}
