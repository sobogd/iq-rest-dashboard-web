"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

const containerStyle = { width: "100%", height: "300px" };
const FALLBACK_CENTER = { lat: 40.4168, lng: -3.7038 };
const libraries: ("places")[] = ["places"];

function getGeoCountryCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )geo_country=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  ES: { lat: 40.4168, lng: -3.7038 },
  US: { lat: 38.9072, lng: -77.0369 },
  PL: { lat: 52.2297, lng: 21.0122 },
  MX: { lat: 19.4326, lng: -99.1332 },
  BR: { lat: -15.7975, lng: -47.8919 },
  AR: { lat: -34.6037, lng: -58.3816 },
  CO: { lat: 4.711, lng: -74.0721 },
  CL: { lat: -33.4489, lng: -70.6693 },
  PE: { lat: -12.0464, lng: -77.0428 },
  UY: { lat: -34.9011, lng: -56.1645 },
  TR: { lat: 39.9334, lng: 32.8597 },
  DE: { lat: 52.52, lng: 13.405 },
  FR: { lat: 48.8566, lng: 2.3522 },
  IT: { lat: 41.9028, lng: 12.4964 },
  PT: { lat: 38.7223, lng: -9.1393 },
  NL: { lat: 52.3676, lng: 4.9041 },
  GB: { lat: 51.5074, lng: -0.1278 },
};

export function MapPicker({ lat, lng, onLocationSelect }: MapPickerProps) {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const apiKey = env?.VITE_GOOGLE_MAPS_API_KEY || "";

  const defaultCenter = useMemo(() => {
    const country = getGeoCountryCookie();
    if (country && COUNTRY_COORDS[country.toUpperCase()]) return COUNTRY_COORDS[country.toUpperCase()];
    return FALLBACK_CENTER;
  }, []);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    lat && lng ? { lat, lng } : null,
  );
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const center = marker || defaultCenter;

  const handleClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const newLat = e.latLng.lat();
        const newLng = e.latLng.lng();
        setMarker({ lat: newLat, lng: newLng });
        onLocationSelect(newLat, newLng);
      }
    },
    [onLocationSelect],
  );

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location) {
      const newLat = place.geometry.location.lat();
      const newLng = place.geometry.location.lng();
      setMarker({ lat: newLat, lng: newLng });
      onLocationSelect(newLat, newLng);
      map?.panTo({ lat: newLat, lng: newLng });
      map?.setZoom(15);
    }
  }, [map, onLocationSelect]);

  if (!apiKey) {
    return (
      <div className="w-full h-[300px] bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground px-4 text-center">
        Google Maps API key not configured (VITE_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[300px] bg-muted rounded-lg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-input border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 right-2 z-10">
        <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
          <input
            type="text"
            placeholder="Search location..."
            className="w-full px-3 py-2 border rounded-md shadow-sm text-sm text-black bg-white"
            style={{ color: "#000", backgroundColor: "#fff" }}
          />
        </Autocomplete>
      </div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={marker ? 15 : 5}
        onClick={handleClick}
        onLoad={onLoad}
        options={{ streetViewControl: false, mapTypeControl: false }}
      >
        {marker && <Marker position={marker} />}
      </GoogleMap>
    </div>
  );
}
