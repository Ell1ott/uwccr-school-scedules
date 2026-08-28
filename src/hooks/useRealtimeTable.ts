import { useEffect, useState } from "react";
import type { Database } from "../lib/database.types";
import { supabase } from "../lib/supabase";

type PublicTable = keyof Database["public"]["Tables"];

export function useRealtimeTable<T>(
  table: PublicTable,
  select: string,
  mapRows: (rows: unknown[]) => T[],
): T[] {
  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    async function refresh() {
      const { data } = await client.from(table).select(select);
      if (!active || !data) return;
      setRows(mapRows(data));
    }

    void refresh();
    const channel = client
      .channel(`${table}-live`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
    // mapRows is a stable module-level function at each call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, select]);

  return rows;
}
