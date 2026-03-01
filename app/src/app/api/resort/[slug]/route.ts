import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "forecasts",
      `${slug}.json`
    );
    const data = await fs.readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json(
      { error: "Forecast not found" },
      { status: 404 }
    );
  }
}
