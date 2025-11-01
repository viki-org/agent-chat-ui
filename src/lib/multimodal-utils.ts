import type { ContentBlock } from "@langchain/core/messages";
import { toast } from "sonner";

// Returns a Promise of a typed multimodal block for images or PDFs
export async function fileToContentBlock(
  file: File,
): Promise<ContentBlock.Multimodal.Standard> {
  const supportedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const supportedFileTypes = [...supportedImageTypes, "application/pdf"];

  if (!supportedFileTypes.includes(file.type)) {
    toast.error(
      `Unsupported file type: ${file.type}. Supported types are: ${supportedFileTypes.join(", ")}`,
    );
    return Promise.reject(new Error(`Unsupported file type: ${file.type}`));
  }

  const data = await fileToBase64(file);

  if (supportedImageTypes.includes(file.type)) {
    return {
      type: "image",
      mimeType: file.type,
      data,
      metadata: { name: file.name },
    } as ContentBlock.Multimodal.Image;
  }

  // PDF
  return {
    type: "file",
    mimeType: "application/pdf",
    data,
    metadata: { filename: file.name },
  } as ContentBlock.Multimodal.File;
}

// Helper to convert File to base64 string
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Type guard for ContentBlock.Multimodal.Standard
// Also handles legacy format and server responses
export function isBase64ContentBlock(
  block: unknown,
): block is ContentBlock.Multimodal.Standard {
  if (typeof block !== "object" || block === null || !("type" in block))
    return false;

  // New format: file type with mimeType
  if (
    (block as { type: unknown }).type === "file" &&
    "data" in block &&
    "mimeType" in block &&
    typeof (block as { mimeType?: unknown }).mimeType === "string" &&
    ((block as { mimeType: string }).mimeType.startsWith("image/") ||
      (block as { mimeType: string }).mimeType === "application/pdf")
  ) {
    return true;
  }

  // Legacy format: file type with mime_type and source_type (from server)
  if (
    (block as { type: unknown }).type === "file" &&
    "source_type" in block &&
    (block as { source_type: unknown }).source_type === "base64" &&
    "mime_type" in block &&
    typeof (block as { mime_type?: unknown }).mime_type === "string" &&
    ((block as { mime_type: string }).mime_type.startsWith("image/") ||
      (block as { mime_type: string }).mime_type === "application/pdf")
  ) {
    return true;
  }

  // New format: image type with mimeType
  if (
    (block as { type: unknown }).type === "image" &&
    "data" in block &&
    "mimeType" in block &&
    typeof (block as { mimeType?: unknown }).mimeType === "string" &&
    (block as { mimeType: string }).mimeType.startsWith("image/")
  ) {
    return true;
  }

  // Legacy format: image type with mime_type and source_type (from server)
  if (
    (block as { type: unknown }).type === "image" &&
    "source_type" in block &&
    (block as { source_type: unknown }).source_type === "base64" &&
    "mime_type" in block &&
    typeof (block as { mime_type?: unknown }).mime_type === "string" &&
    (block as { mime_type: string }).mime_type.startsWith("image/")
  ) {
    return true;
  }

  // Image URL format (converted images from server)
  if (
    (block as { type: unknown }).type === "image_url" &&
    "image_url" in block
  ) {
    return true;
  }

  return false;
}

// Convert ContentBlock.Multimodal.Standard to SDK's MessageContent format
// Note: The SDK's TypeScript types only officially support text and image_url,
// but the backend can handle additional content block types (like PDFs).
// For PDFs, we convert back to the legacy format for backward compatibility.
export function contentBlockToMessageContent(
  block: ContentBlock.Multimodal.Standard,
):
  | { type: "image_url"; image_url: string }
  | {
      type: "file";
      source_type: "base64";
      mime_type: string;
      data: string;
      metadata?: Record<string, any>;
    } {
  if (block.type === "image" && "data" in block && block.mimeType) {
    // Convert base64 data to data URL format for images
    return {
      type: "image_url",
      image_url: `data:${block.mimeType};base64,${block.data}`,
    };
  }

  // For files (PDFs), convert to the legacy Base64ContentBlock format
  // that the backend expects
  if (block.type === "file" && "data" in block && block.mimeType) {
    return {
      type: "file",
      source_type: "base64",
      mime_type: block.mimeType,
      data: block.data as string,
      metadata: block.metadata,
    };
  }

  throw new Error(`Unsupported content block type: ${block.type}`);
}
