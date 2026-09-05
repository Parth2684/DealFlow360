"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { quotesApi } from "@/lib/api/resources";
import { ApiError } from "@/lib/api/client";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageLoading } from "@/components/ui/feedback";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { QUOTE_STAGES } from "@/lib/constants";

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => quotesApi.list(),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((quote) => {
      const matchesStage = !stage || quote.stage === stage;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        quote.quoteNumber?.toLowerCase().includes(term) ||
        quote.customerAccount?.name?.toLowerCase().includes(term);
      return matchesStage && matchesSearch;
    });
  }, [data, search, stage]);

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Draft, price, and route deals through approval."
        action={
          <Link href="/quotations/new">
            <Button>
              <Plus size={16} /> New quotation
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-soft" />
          <Input
            placeholder="Search quote # or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stage} onChange={(e) => setStage(e.target.value)} className="w-52">
          <option value="">All stages</option>
          {QUOTE_STAGES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <PageLoading label="Loading quotations…" />
        ) : isError ? (
          <ErrorState
            message={error instanceof ApiError ? error.message : "Could not load quotations."}
            retry={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No quotations found"
            description="Create your first quotation to start the deal flow."
            action={
              <Link href="/quotations/new" className="mt-2">
                <Button size="sm">
                  <Plus size={14} /> New quotation
                </Button>
              </Link>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Quote #</Th>
                <Th>Customer</Th>
                <Th>Stage</Th>
                <Th>Total</Th>
                <Th>Owner</Th>
                <Th>Updated</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((quote) => (
                <Tr key={quote.id} className="hover:bg-surface-soft">
                  <Td className="font-medium text-ink">
                    <Link href={`/quotations/${quote.id}`} className="hover:underline">
                      {quote.quoteNumber ?? quote.id}
                    </Link>
                  </Td>
                  <Td>{quote.customerAccount?.name ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={quote.stage} />
                  </Td>
                  <Td>{formatMoney(quote.currentVersion?.total, quote.currentVersion?.currency)}</Td>
                  <Td>{quote.owner ? `${quote.owner.firstName} ${quote.owner.lastName}` : "—"}</Td>
                  <Td>{formatDate(quote.updatedAt)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
