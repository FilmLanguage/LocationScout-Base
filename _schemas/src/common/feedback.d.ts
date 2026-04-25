import { z } from "zod";
export declare const FeedbackSchema: z.ZodObject<{
    category: z.ZodEnum<["creative", "technical", "accuracy", "consistency"]>;
    message: z.ZodString;
    priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high"]>>;
    references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    category: "creative" | "technical" | "accuracy" | "consistency";
    priority: "low" | "normal" | "high";
    references?: string[] | undefined;
}, {
    message: string;
    category: "creative" | "technical" | "accuracy" | "consistency";
    priority?: "low" | "normal" | "high" | undefined;
    references?: string[] | undefined;
}>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export declare const FeedbackJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
