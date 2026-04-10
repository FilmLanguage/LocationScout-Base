import { z } from "zod";
export const TestDummySchema = z.object({ name: z.string() });
export type TestDummy = z.infer<typeof TestDummySchema>;
