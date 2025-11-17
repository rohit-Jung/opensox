import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

// Cache newsletters in memory for faster subsequent loads
let cachedNewsletters: any[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

export async function GET() {
  const now = Date.now();
  
  // Return cached data if available and fresh
  if (cachedNewsletters && now - lastCacheTime < CACHE_DURATION) {
    return NextResponse.json(cachedNewsletters);
  }

  const newslettersDir = path.join(process.cwd(), "src/content/newsletters");
  
  try {
    if (!fs.existsSync(newslettersDir)) {
      fs.mkdirSync(newslettersDir, { recursive: true });
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(newslettersDir);
    
    const newsletters = files
      .filter((file) => file.endsWith(".md"))
      .map((file) => {
        const filePath = path.join(newslettersDir, file);
        const fileContent = fs.readFileSync(filePath, "utf8");
        const { data } = matter(fileContent);
        
        return {
          id: file.replace(".md", ""),
          title: data.title || "Untitled",
          date: data.date || new Date().toISOString(),
          excerpt: data.excerpt || "",
          readTime: data.readTime || "5 min read",
          description: data.description || data.excerpt || "",
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Update cache
    cachedNewsletters = newsletters;
    lastCacheTime = now;
    
    return NextResponse.json(newsletters);
  } catch (error) {
    console.error("Error reading newsletters:", error);
    return NextResponse.json([]);
  }
}
