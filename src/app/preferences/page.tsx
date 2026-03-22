import { getRestaurantData } from "@/lib/data";
import { PreferencesView } from "@/components/PreferencesView";

export default async function PreferencesPage() {
  const data = await getRestaurantData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PreferencesView restaurants={data.restaurants} />
    </div>
  );
}
