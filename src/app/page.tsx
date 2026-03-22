import { getRestaurantData } from "@/lib/data";
import { DiscoverView } from "@/components/DiscoverView";

export default async function Home() {
  const data = await getRestaurantData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <DiscoverView restaurants={data.restaurants} lastUpdated={data.last_updated} />
    </div>
  );
}
