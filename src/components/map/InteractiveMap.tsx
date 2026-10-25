'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Place } from '@/lib/domain/types';
import { MapMarkerItem } from './LeafletMapInner';

const LeafletMapInner = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: '400px' }}
      className="w-full bg-stone-100 rounded-xl flex flex-col items-center justify-center text-stone-500 animate-pulse border border-stone-200"
    >
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
      <p className="text-sm font-medium">Đang tải bản đồ...</p>
    </div>
  ),
});

interface InteractiveMapProps {
  center: [number, number];
  zoom?: number;
  draggablePin?: {
    latitude: number;
    longitude: number;
    onDragEnd: (lat: number, lng: number) => void;
  };
  markers?: MapMarkerItem[];
  places?: Place[];
  onPlaceSelect?: (place: Place) => void;
  height?: string;
}

export default function InteractiveMap(props: InteractiveMapProps) {
  return <LeafletMapInner {...props} />;
}
