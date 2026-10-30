import type { Metadata } from "next";
import { HomeView } from "./home-view";

export const metadata: Metadata = { title: { absolute: "mintsy" } };

export default function HomePage() {
  return <HomeView />;
}
