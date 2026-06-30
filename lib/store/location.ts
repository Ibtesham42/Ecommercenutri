"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-side delivery location (country is India today; PIN is user-chosen).
 * Persisted to localStorage so the header chip reflects the choice everywhere.
 * Purely presentational — pricing/serviceability stay server-authoritative.
 */
type LocationState = {
  pincode: string | null;
  setPincode: (pincode: string | null) => void;
};

export const useLocation = create<LocationState>()(
  persist(
    (set) => ({
      pincode: null,
      setPincode: (pincode) => set({ pincode }),
    }),
    { name: "nutriyet-location" },
  ),
);
