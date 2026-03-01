import { promises as fs } from "fs";
import path from "path";
import type { Metadata } from "next";
import type { ResortWithConditions } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import MapClient from "./MapClient";

export const metadata: Metadata = {
  title: "Resort Map — PowderCast",
  description: "Interactive map of snow conditions at North American ski resorts.",
};

async function getResorts(): Promise<ResortWithConditions[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "resorts.json");
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as ResortWithConditions[];
  } catch {
    return [];
  }
}

export default async function MapPage() {
  const resorts = await getResorts();

  return <MapClient resorts={resorts} regions={REGIONS as string[]} />;
}
