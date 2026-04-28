"use client";

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

/** Placeholder MapPicker — Google Maps integration deferred for v0.2. */
export function MapPicker({ lat, lng, onLocationSelect }: MapPickerProps) {
  function update(field: "lat" | "lng", value: string) {
    const n = parseFloat(value);
    if (Number.isFinite(n)) {
      onLocationSelect(field === "lat" ? n : (lat ?? 0), field === "lng" ? n : (lng ?? 0));
    }
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        step="0.000001"
        value={lat ?? ""}
        onChange={(e) => update("lat", e.target.value)}
        placeholder="lat"
        className="w-full h-10 px-3 text-sm text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
      />
      <input
        type="number"
        step="0.000001"
        value={lng ?? ""}
        onChange={(e) => update("lng", e.target.value)}
        placeholder="lng"
        className="w-full h-10 px-3 text-sm text-foreground bg-card border border-input rounded-lg placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
      />
    </div>
  );
}
