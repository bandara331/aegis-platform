"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DeleteRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete request #${id}?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ops/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button type="button" variant="danger" disabled={deleting} onClick={handleDelete}>
      {deleting ? "Deleting…" : "Delete"}
    </Button>
  );
}
