import { TRPCError } from "@trpc/server";
import { isIP } from "net";

// Configuration
const ALLOWED_IMAGE_HOSTS = [
    "avatars.githubusercontent.com",
    "lh3.googleusercontent.com",
    "graph.facebook.com",
    "pbs.twimg.com",
    "cdn.discordapp.com",
    "i.imgur.com",
    "res.cloudinary.com",
    "ik.imagekit.io",
    "images.unsplash.com",
    "ui-avatars.com",
];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const REQUEST_TIMEOUT_MS = 5000; // 5 seconds

// Private IP ranges
const PRIVATE_IP_RANGES = [
    /^127\./,                    // 127.0.0.0/8 (localhost)
    /^10\./,                     // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,               // 192.168.0.0/16
    /^169\.254\./,               // 169.254.0.0/16 (link-local)
    /^::1$/,                     // IPv6 localhost
    /^fe80:/,                    // IPv6 link-local
    /^fc00:/,                    // IPv6 unique local
    /^fd00:/,                    // IPv6 unique local
];

/**
 * Validates if an IP address is private or localhost
 */
function isPrivateOrLocalIP(ip: string): boolean {
    return PRIVATE_IP_RANGES.some((range) => range.test(ip));
}

/**
 * Validates avatar URL with strict security checks
 * @param avatarUrl - The URL to validate
 * @throws TRPCError if validation fails
 */
export async function validateAvatarUrl(avatarUrl: string): Promise<void> {
    // Step 1: Basic URL format validation
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(avatarUrl);
    } catch (error) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid avatar URL format",
        });
    }

    // Step 2: Require HTTPS scheme
    if (parsedUrl.protocol !== "https:") {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Avatar URL must use HTTPS protocol",
        });
    }

    // Step 3: Extract and validate hostname
    const hostname = parsedUrl.hostname;

    // Step 4: Reject direct IP addresses
    if (isIP(hostname)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Avatar URL cannot be a direct IP address. Please use a trusted image hosting service.",
        });
    }

    // Step 5: Check for localhost or private IP ranges
    if (isPrivateOrLocalIP(hostname)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Avatar URL cannot point to localhost or private network addresses",
        });
    }

    // Step 6: Validate against allowlist of trusted hosts
    const isAllowedHost = ALLOWED_IMAGE_HOSTS.some((allowedHost) => {
        return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
    });

    if (!isAllowedHost) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Avatar URL must be from a trusted image hosting service. Allowed hosts: ${ALLOWED_IMAGE_HOSTS.join(", ")}`,
        });
    }

    // Step 7: Perform server-side HEAD request to validate the resource
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(avatarUrl, {
            method: "HEAD",
            signal: controller.signal,
            headers: {
                "User-Agent": "OpenSox-Avatar-Validator/1.0",
            },
        });

        clearTimeout(timeoutId);

        // Check if request was successful
        if (!response.ok) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Avatar URL is not accessible (HTTP ${response.status})`,
            });
        }

        // Step 8: Validate Content-Type is an image
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.startsWith("image/")) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Avatar URL must point to an image file. Received content-type: ${contentType || "unknown"}`,
            });
        }

        // Step 9: Validate Content-Length is within limits
        const contentLength = response.headers.get("content-length");
        if (contentLength) {
            const sizeBytes = parseInt(contentLength, 10);
            if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Avatar image is too large. Maximum size: ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`,
                });
            }
        }
    } catch (error) {
        // Handle fetch errors
        if (error instanceof TRPCError) {
            throw error;
        }

        if ((error as Error).name === "AbortError") {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Avatar URL validation timed out. The image may be too large or the server is unresponsive.",
            });
        }

        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Failed to validate avatar URL: ${(error as Error).message}`,
        });
    }
}

/**
 * Zod custom refinement for avatar URL validation
 * Use this with .refine() on a z.string().url() schema
 */
export async function avatarUrlRefinement(url: string): Promise<boolean> {
    try {
        await validateAvatarUrl(url);
        return true;
    } catch (error) {
        return false;
    }
}
