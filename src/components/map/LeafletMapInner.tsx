'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapConfig } from './MapProvider';
import { Place } from '@/lib/domain/types';

export interface MapMarkerItem {
  id: string;
  name: string;
  category?: string;
  address?: string;
  latitude: number;
  longitude: number;
  isPrivate?: boolean;
  onClick?: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface LeafletMapInnerProps {
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

export default function LeafletMapInner({
  center,
  zoom = 15,
  draggablePin,
  markers = [],
  places = [],
  onPlaceSelect,
  height = '400px',
}: LeafletMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const draggableMarkerRef = useRef<L.Marker | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const { tileUrl, attribution } = useMapConfig();

  // Khởi tạo Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: true,
      });

      L.tileLayer(tileUrl, {
        attribution,
        maxZoom: 19,
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Cập nhật tâm bản đồ
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom, { animate: true });
    }
  }, [center[0], center[1], zoom]);

  // Cập nhật draggable pin
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (draggablePin) {
      const pinIcon = L.divIcon({
        className: 'custom-draggable-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            border: 3px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 14px rgba(234, 88, 12, 0.45);
            cursor: grab;
          ">
            <div style="
              width: 12px;
              height: 12px;
              background: #ffffff;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      if (!draggableMarkerRef.current) {
        const marker = L.marker([draggablePin.latitude, draggablePin.longitude], {
          draggable: true,
          icon: pinIcon,
          title: 'Kéo để chọn vị trí chính xác',
        }).addTo(mapInstanceRef.current);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          draggablePin.onDragEnd(pos.lat, pos.lng);
        });

        draggableMarkerRef.current = marker;
      } else {
        draggableMarkerRef.current.setLatLng([draggablePin.latitude, draggablePin.longitude]);
      }
    } else if (draggableMarkerRef.current) {
      draggableMarkerRef.current.remove();
      draggableMarkerRef.current = null;
    }
  }, [draggablePin?.latitude, draggablePin?.longitude]);

  // Cập nhật danh sách Place markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();

    // Kết hợp markers và places
    const allItems: MapMarkerItem[] = [
      ...markers,
      ...places.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        isPrivate: p.isPrivate,
        onClick: onPlaceSelect ? () => onPlaceSelect(p) : undefined,
      })),
    ];

    allItems.forEach((item) => {
      const isPriv = item.isPrivate;
      const markerColor = isPriv ? '#6366f1' : '#0284c7';

      const icon = L.divIcon({
        className: 'place-marker-icon',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            background: ${markerColor};
            color: #ffffff;
            border: 2px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            font-size: 14px;
            font-weight: bold;
          ">
            ${isPriv ? '🔒' : '📍'}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([item.latitude, item.longitude], { icon });

      const popupContent = `
        <div style="font-family: inherit; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1e293b;">${escapeHtml(item.name)}</h4>
          ${item.address ? `<p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">${escapeHtml(item.address)}</p>` : ''}
          <div style="display: flex; gap: 4px; align-items: center;">
            <span style="font-size: 11px; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; color: #475569;">
              ${escapeHtml(item.category || 'Địa điểm')}
            </span>
            ${isPriv ? '<span style="font-size: 11px; padding: 2px 6px; background: #e0e7ff; color: #4338ca; border-radius: 4px;">Riêng tư</span>' : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      if (item.onClick) {
        marker.on('click', () => {
          if (item.onClick) item.onClick();
        });
      }

      markerLayerRef.current?.addLayer(marker);
    });
  }, [markers, places]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%', borderRadius: '12px', zIndex: 1 }}
      className="shadow-inner border border-stone-200"
    />
  );
}
