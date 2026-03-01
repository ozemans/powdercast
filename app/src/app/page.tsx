import { promises as fs } from "fs";
import path from "path";
import type { ResortWithConditions } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import HomeClient from "./HomeClient";

async function getResorts(): Promise<ResortWithConditions[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "resorts.json");
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as ResortWithConditions[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const resorts = await getResorts();

  return <HomeClient resorts={resorts} regions={REGIONS as string[]} />;
}
