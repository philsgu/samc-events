"use client";

function getMapUrl(address: string): string {
  if (typeof navigator === "undefined") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return `maps://maps.apple.com/?q=${encodeURIComponent(address)}`;
  }
  if (/Android/i.test(ua)) {
    return `geo:0,0?q=${encodeURIComponent(address)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default function MapLink({ address }: { address: string }) {
  return (
    <a
      href={getMapUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="event-location-link"
    >
      {address}
    </a>
  );
}
