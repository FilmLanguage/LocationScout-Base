import { z } from "zod";
export declare const ArtifactRefSchema: z.ZodObject<{
    uri: z.ZodString;
    type: z.ZodString;
    mime_type: z.ZodString;
    version: z.ZodOptional<z.ZodNumber>;
    checksum: z.ZodOptional<z.ZodString>;
    storage_path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    uri: string;
    mime_type: string;
    version?: number | undefined;
    checksum?: string | undefined;
    storage_path?: string | undefined;
}, {
    type: string;
    uri: string;
    mime_type: string;
    version?: number | undefined;
    checksum?: string | undefined;
    storage_path?: string | undefined;
}>;
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;
export declare const ArtifactRefJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
