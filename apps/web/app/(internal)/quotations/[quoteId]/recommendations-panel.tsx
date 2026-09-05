"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, X, Plus } from "lucide-react";
import { quotesApi } from "@/lib/api/resources";
import { Card, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";

export function RecommendationsPanel({ quoteId }: { quoteId: string }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["quote-recommendations", quoteId],
    queryFn: () => quotesApi.recommendations(quoteId),
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["quote-recommendations", quoteId] }),
      queryClient.invalidateQueries({ queryKey: ["quote", quoteId] }),
    ]);

  const addMutation = useMutation({
    mutationFn: (productId: string) => quotesApi.addRecommendation(quoteId, productId),
    onSuccess: async () => {
      await invalidate();
      notify({ title: "Product added to quote", variant: "success" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (productId: string) => quotesApi.dismissRecommendation(quoteId, productId),
    onSuccess: () => invalidate(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Upsell recommendations" />
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Upsell recommendations" description="Suggested add-ons based on this deal." />
      <ul className="divide-y divide-hairline-soft">
        {data.map((rec) => (
          <li key={rec.productId} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles size={15} className="shrink-0 text-accent-amber" />
              <div>
                <p className="text-sm font-medium text-ink">{rec.product?.name ?? rec.productId}</p>
                {rec.reason ? <p className="text-xs text-muted">{rec.reason}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => addMutation.mutate(rec.productId)}
                className="rounded-md p-1.5 text-success hover:bg-success/10"
                aria-label="Add to quote"
                title="Add to quote"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => dismissMutation.mutate(rec.productId)}
                className="rounded-md p-1.5 text-muted-soft hover:bg-surface-soft hover:text-ink"
                aria-label="Dismiss"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
