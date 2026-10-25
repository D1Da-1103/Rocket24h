'use client';

import React, { createContext, useContext } from 'react';
import { APP_CONFIG } from '@/lib/domain/config';

interface MapContextType {
  tileUrl: string;
  attribution: string;
}

const MapContext = createContext<MapContextType>({
  tileUrl: APP_CONFIG.map.tileUrl,
  attribution: APP_CONFIG.map.attribution,
});

export function MapProvider({ children }: { children: React.ReactNode }) {
  return (
    <MapContext.Provider
      value={{
        tileUrl: APP_CONFIG.map.tileUrl,
        attribution: APP_CONFIG.map.attribution,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}

export function useMapConfig() {
  return useContext(MapContext);
}
