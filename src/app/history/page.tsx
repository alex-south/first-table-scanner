import { getRestaurantData } from "@/lib/data";
import { HistoryView } from "@/components/HistoryView";

export default async function HistoryPage() {
  const data = await getRestaurantData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <HistoryView restaurants={data.restaurants} />
    </div>
  );
}
