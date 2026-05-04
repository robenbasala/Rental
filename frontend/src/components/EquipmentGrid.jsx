import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function EquipmentGrid() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => (await api.get("/equipment")).data
  });

  if (isLoading) return <p className="text-slate-600">Loading equipment…</p>;

  return (
    <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.Id}
          className="card flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden transition hover:shadow-md"
        >
          <div className="product-media-frame">
            <img
              src={item.PrimaryImageUrl || "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=60"}
              alt={item.Name}
              loading="lazy"
              className="product-media-img"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            {item.CategoryName && (
              <span className="mb-2 inline-block rounded-full bg-orange-100 px-2 py-1 text-xs text-orange-700">
                {item.CategoryName}
              </span>
            )}
            <h3 className="line-clamp-2 font-semibold leading-snug">{item.Name}</h3>
            <p className="mt-1 flex-1 text-sm text-slate-500">{item.Description || "Perfect for birthday fun."}</p>
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100/80 pt-4">
              <span className="font-bold">${Number(item.PricePerRental).toFixed(2)}</span>
              <Link to={`/products/${item.Id}`} className="btn-gradient shrink-0 px-4 py-2 text-sm">
                Book This
              </Link>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
