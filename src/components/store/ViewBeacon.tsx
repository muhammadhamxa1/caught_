"use client";

import { useEffect } from "react";
import type { Entry } from "@/db/schema";
import { track } from "./track";

export function ViewBeacon(props: {
  handle: string;
  type: "page_view" | "product_view";
  productId?: string;
  entry?: Entry;
  videoId?: string | null;
}) {
  const { handle, type, productId, entry, videoId } = props;
  useEffect(() => {
    track({ handle, type, productId, entry, videoId });
  }, [handle, type, productId, entry, videoId]);
  return null;
}
