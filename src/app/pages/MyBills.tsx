import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Search } from "lucide-react";
import { Navigation } from "../components/Navigation";
import { fetchMyBillsForCurrentClass } from "../services/bills";
import { BillRecord } from "../types/domain";
import { toast } from "sonner";

type SortKey = "newest" | "oldest" | "number" | "title";

function statusClass(status: string) {
  if (status === "draft") return "bg-gray-100 text-gray-700";
  if (status === "submitted") return "bg-blue-100 text-blue-700";
  if (status === "in_committee") return "bg-slate-100 text-slate-700";
  if (status === "reported") return "bg-green-100 text-green-700";
  return "bg-blue-100 text-blue-700";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function MyBills() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setBills(await fetchMyBillsForCurrentClass());
      } catch (e: any) {
        toast.error(e.message || "Could not load your bills");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statuses = useMemo(() => Array.from(new Set(bills.map((bill) => bill.status))), [bills]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = bills.filter((bill) => {
      const matchesQuery =
        !q ||
        bill.title.toLowerCase().includes(q) ||
        bill.hr_label.toLowerCase().includes(q) ||
        statusLabel(bill.status).toLowerCase().includes(q);
      const matchesStatus = status === "all" || bill.status === status;
      return matchesQuery && matchesStatus;
    });
    return rows.sort((a, b) => {
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "number") return (a as any).bill_number - (b as any).bill_number;
      if (sort === "title") return a.title.localeCompare(b.title);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [bills, query, sort, status]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Bills</h1>
            <p className="mt-1 text-gray-600">{filtered.length} bills found</p>
          </div>
          <Link to="/bills/create" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Bill
          </Link>
        </div>

        <div className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your bills..."
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="number">Bill number</option>
            <option value="title">Title</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading bills...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No bills found.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filtered.map((bill) => (
                <Link
                  key={bill.id}
                  to={bill.status === "draft" ? `/bills/create?draft=${bill.id}` : `/bills/${bill.id}`}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900">{bill.hr_label}</span>
                      <span className={`rounded px-2 py-1 text-xs font-medium ${statusClass(bill.status)}`}>{statusLabel(bill.status)}</span>
                    </div>
                    <h2 className="truncate font-semibold text-gray-900">{bill.title}</h2>
                    <p className="mt-1 text-xs text-gray-500">{new Date(bill.created_at).toLocaleDateString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
