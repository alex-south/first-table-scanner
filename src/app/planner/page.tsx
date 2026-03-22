import { getRestaurantData } from "@/lib/data";
import { PlannerView } from "@/components/PlannerView";

export default async function PlannerPage() {
  const data = await getRestaurantData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PlannerView restaurants={data.restaurants} />
    </div>
  );
}
