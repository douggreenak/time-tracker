import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TimeTrack",
    short_name: "TimeTrack",
    description: "Time tracking for engineers, with review and QuickBooks export.",
    start_url: "/engineer",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafb",
    theme_color: "#0b6a8c",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
