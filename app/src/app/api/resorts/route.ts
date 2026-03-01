import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { ResortWithConditions } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "resorts.json"
    );
    const data = await fs.readFile(filePath, "utf-8");
    let resorts: ResortWithConditions[] = JSON.parse(data);

    // Apply optional filters
    const { searchParams } = request.nextUrl;
    const region = searchParams.get("region");
    const country = searchParams.get("country");

    if (region) {
      resorts = resorts.filter((r) => r.region === region);
    }
    if (country) {
      resorts = resorts.filter((r) => r.country === country);
    }

    return NextResponse.json(resorts);
  } catch {
    return NextResponse.json(
      { error: "Resort data not available" },
      { status: 404 }
    );
  }
}
