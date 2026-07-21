"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type JnvAiResourcePayload = {
  resourceId: string;
  title: string;
  classLevel: number;
  initialQuestion?: string;
};

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  payload: JnvAiResourcePayload | null;
  askAboutResource: (p: JnvAiResourcePayload) => void;
  openGeneral: () => void;
};

const AiCtx = createContext<Ctx | null>(null);

/**
 * Lets `ResourceViewer` (deep in the tree) hand Byte a resource to be
 * "aware" of without prop-drilling — the launcher is mounted once in
 * app/jnv/layout.tsx, siblings apart from the page content.
 */
export function JnvAiContextProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<JnvAiResourcePayload | null>(null);

  const askAboutResource = useCallback((p: JnvAiResourcePayload) => {
    setPayload(p);
    setOpen(true);
  }, []);

  const openGeneral = useCallback(() => {
    setPayload(null);
    setOpen(true);
  }, []);

  return (
    <AiCtx.Provider value={{ open, setOpen, payload, askAboutResource, openGeneral }}>
      {children}
    </AiCtx.Provider>
  );
}

export function useJnvAiContext(): Ctx {
  const ctx = useContext(AiCtx);
  if (!ctx) throw new Error("useJnvAiContext must be used within JnvAiContextProvider");
  return ctx;
}
