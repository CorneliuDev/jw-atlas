import { Suspense } from "react";
import AtlasMap from "@/components/AtlasMap";

export default function Home() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem" }}>Loading map...</div>}>
      <AtlasMap />
    </Suspense>
  );
}
