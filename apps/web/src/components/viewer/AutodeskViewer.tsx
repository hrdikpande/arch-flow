'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ds';

/**
 * Autodesk Viewer (APS Viewer SDK). The browser gets a read-only, short-lived token from our server.
 * Script and style versions follow the APS documentation; verify on the live account before go-live.
 */
const VIEWER_CSS = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
const VIEWER_JS = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';

type Autodesk = {
  Viewing: {
    Initializer: (options: Record<string, unknown>, done: () => void) => void;
    GuiViewer3D: new (el: HTMLElement) => { start: () => void; loadDocumentNode: (d: unknown, n: unknown) => void; finish?: () => void };
    Document: { load: (urn: string, ok: (doc: { getRoot: () => { getDefaultGeometry: () => unknown } }) => void, fail: (code: number, message: string) => void) => void };
  };
};

function loadOnce(tag: 'script' | 'link', attributes: Record<string, string>): Promise<void> {
  const existing = document.querySelector(`${tag}[${Object.keys(attributes)[0]}="${attributes[Object.keys(attributes)[0] as string]}"]`);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v));
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Could not load ${attributes.src ?? attributes.href}`));
    document.head.appendChild(el);
  });
}

export function AutodeskViewer({ fileId, label }: { fileId: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let viewer: { finish?: () => void } | null = null;
    (async () => {
      try {
        await loadOnce('link', { rel: 'stylesheet', href: VIEWER_CSS });
        await loadOnce('script', { src: VIEWER_JS });
        const Autodesk = (window as unknown as { Autodesk?: Autodesk }).Autodesk;
        if (!Autodesk) throw new Error('The Autodesk viewer did not load.');
        const fetchToken = async () => {
          const response = await fetch(`/api/aps/viewer-token?fileId=${encodeURIComponent(fileId)}`, { cache: 'no-store' });
          const body = (await response.json()) as { access_token?: string; expires_in?: number; urn?: string; error?: string };
          if (!response.ok || !body.access_token) throw new Error(body.error ?? 'Viewing is not available.');
          return body;
        };
        const first = await fetchToken();
        await new Promise<void>((resolve) =>
          Autodesk.Viewing.Initializer(
            { env: 'AutodeskProduction2', api: 'streamingV2', getAccessToken: async (callback: (t: string, e: number) => void) => { const t = await fetchToken(); callback(t.access_token as string, t.expires_in as number); } },
            () => resolve(),
          ),
        );
        if (cancelled || !container.current) return;
        const instance = new Autodesk.Viewing.GuiViewer3D(container.current);
        instance.start();
        viewer = instance;
        Autodesk.Viewing.Document.load(
          `urn:${first.urn}`,
          (doc) => {
            if (cancelled) return;
            instance.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry());
            setReady(true);
          },
          (code, message) => setError(`The viewer could not open this file (code ${code}: ${message}).`),
        );
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Viewing failed.');
      }
    })();
    return () => {
      cancelled = true;
      viewer?.finish?.();
    };
  }, [fileId]);

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      {!ready && !error && <p className="text-sm text-text-secondary">Loading the drawing…</p>}
      <div ref={container} role="region" aria-label={`Drawing viewer for ${label}`} className="h-[70vh] min-h-96 w-full overflow-hidden rounded-md border border-border bg-surface" />
    </div>
  );
}
