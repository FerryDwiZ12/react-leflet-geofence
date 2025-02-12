import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, useMapEvents, CircleMarker } from 'react-leaflet';
import { LatLng, LatLngExpression } from 'leaflet';
import { Square, Circle, RectangleVertical as Rectangle, Triangle, Car } from 'lucide-react';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';

interface MapClickHandler {
  onClick: (latlng: LatLng) => void;
}

const MapClickComponent = ({ onClick }: MapClickHandler) => {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng);
    },
  });
  return null;
};

// Shape generator functions
const generateSquare = (center: LatLng, size: number = 0.01): [number, number][] => {
  const half = size / 2;
  return [
    [center.lat + half, center.lng - half],
    [center.lat + half, center.lng + half],
    [center.lat - half, center.lng + half],
    [center.lat - half, center.lng - half],
  ];
};

const generateRectangle = (center: LatLng, width: number = 0.015, height: number = 0.01): [number, number][] => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return [
    [center.lat + halfHeight, center.lng - halfWidth],
    [center.lat + halfHeight, center.lng + halfWidth],
    [center.lat - halfHeight, center.lng + halfWidth],
    [center.lat - halfHeight, center.lng - halfWidth],
  ];
};

const generateCircle = (center: LatLng, radius: number = 0.01, segments: number = 32): [number, number][] => {
  const points: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    points.push([
      center.lat + radius * Math.cos(angle),
      center.lng + radius * Math.sin(angle),
    ]);
  }
  return points;
};

const generateParallelogram = (center: LatLng, width: number = 0.015, height: number = 0.01, skew: number = 0.005): [number, number][] => {
  return [
    [center.lat + height/2, center.lng - width/2 + skew],
    [center.lat + height/2, center.lng + width/2 + skew],
    [center.lat - height/2, center.lng + width/2 - skew],
    [center.lat - height/2, center.lng - width/2 - skew],
  ];
};

export default function Map() {
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [drawMode, setDrawMode] = useState<'free' | 'square' | 'rectangle' | 'circle' | 'parallelogram'>('free');
  const [vehicle, setVehicle] = useState<[number, number] | null>(null);
  const [isOutsideGeofence, setIsOutsideGeofence] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  
  const handleMapClick = useCallback((latlng: LatLng) => {
    if (drawMode === 'free') {
      setPolygon((prev) => [...prev, [latlng.lat, latlng.lng]]);
    } else {
      let newPoints: [number, number][] = [];
      switch (drawMode) {
        case 'square':
          newPoints = generateSquare(latlng);
          break;
        case 'rectangle':
          newPoints = generateRectangle(latlng);
          break;
        case 'circle':
          newPoints = generateCircle(latlng);
          break;
        case 'parallelogram':
          newPoints = generateParallelogram(latlng);
          break;
      }
      setPolygon(newPoints);
      setDrawMode('free'); // Reset to free draw mode after creating a shape
    }
  }, [drawMode]);

  const handleReset = () => {
    setPolygon([]);
    setSelectedPoint(null);
    setDrawMode('free');
    setVehicle(null);
    setIsOutsideGeofence(false);
    setShowAlert(false);
  };

  const handlePointDrag = (index: number, latlng: LatLng) => {
    setPolygon((prev) => {
      const newPolygon = [...prev];
      newPolygon[index] = [latlng.lat, latlng.lng];
      return newPolygon;
    });
  };

  const handlePointDelete = (index: number) => {
    setPolygon((prev) => prev.filter((_, i) => i !== index));
    setSelectedPoint(null);
  };

  const handleVehicleDrag = (latlng: LatLng) => {
    setVehicle([latlng.lat, latlng.lng]);
  };

  const addVehicle = () => {
    if (polygon.length >= 3) {
      // Place vehicle at the center of the polygon
      const bounds = polygon.reduce(
        (acc, point) => ({
          minLat: Math.min(acc.minLat, point[0]),
          maxLat: Math.max(acc.maxLat, point[0]),
          minLng: Math.min(acc.minLng, point[1]),
          maxLng: Math.max(acc.maxLng, point[1]),
        }),
        {
          minLat: Infinity,
          maxLat: -Infinity,
          minLng: Infinity,
          maxLng: -Infinity,
        }
      );
      
      setVehicle([
        (bounds.minLat + bounds.maxLat) / 2,
        (bounds.minLng + bounds.maxLng) / 2,
      ]);
    }
  };

  // Check if vehicle is inside geofence
  useEffect(() => {
    if (vehicle && polygon.length >= 3) {
      const point = turf.point([vehicle[1], vehicle[0]]);
      const polygonCoords = [...polygon, polygon[0]].map(p => [p[1], p[0]]);
      const poly = turf.polygon([polygonCoords]);
      
      const isInside = turf.booleanPointInPolygon(point, poly);
      setIsOutsideGeofence(!isInside);
      
      if (!isInside) {
        setShowAlert(true);
        setTimeout(() => setShowAlert(false), 3000);
      }
    }
  }, [vehicle, polygon]);

  return (
    <div className="h-screen w-full relative">
      {/* Alert */}
      {showAlert && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <span className="font-bold">⚠️ Warning:</span>
          <span>Vehicle has left the geofence area!</span>
        </div>
      )}

      {/* Shape Templates Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white p-2 rounded-lg shadow-lg flex gap-2">
        <button
          onClick={() => setDrawMode('square')}
          className={`p-2 rounded-md hover:bg-gray-100 ${drawMode === 'square' ? 'bg-blue-100' : ''}`}
          title="Square"
        >
          <Square className="w-6 h-6" />
        </button>
        <button
          onClick={() => setDrawMode('rectangle')}
          className={`p-2 rounded-md hover:bg-gray-100 ${drawMode === 'rectangle' ? 'bg-blue-100' : ''}`}
          title="Rectangle"
        >
          <Rectangle className="w-6 h-6" />
        </button>
        <button
          onClick={() => setDrawMode('circle')}
          className={`p-2 rounded-md hover:bg-gray-100 ${drawMode === 'circle' ? 'bg-blue-100' : ''}`}
          title="Circle"
        >
          <Circle className="w-6 h-6" />
        </button>
        <button
          onClick={() => setDrawMode('parallelogram')}
          className={`p-2 rounded-md hover:bg-gray-100 ${drawMode === 'parallelogram' ? 'bg-blue-100' : ''}`}
          title="Parallelogram"
        >
          <Triangle className="w-6 h-6 rotate-45" />
        </button>
      </div>

      {/* Coordinates Panel */}
      <div className="absolute top-20 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg max-h-[80vh] overflow-y-auto">
        <h3 className="font-bold mb-2 text-lg">Selected Points</h3>
        {polygon.length === 0 ? (
          <p className="text-gray-500">No points selected</p>
        ) : (
          <div className="space-y-2">
            {polygon.map((point, index) => (
              <div key={index} className="text-sm flex items-center justify-between">
                <div>
                  <span className="font-medium">Point {index + 1}:</span>
                  <div className="ml-2">
                    <div>Latitude: {point[0].toFixed(6)}</div>
                    <div>Longitude: {point[1].toFixed(6)}</div>
                  </div>
                </div>
                <button
                  onClick={() => handlePointDelete(index)}
                  className="ml-4 bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600 text-xs"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <button
          onClick={handleReset}
          className="block w-full bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
        >
          Reset Shape
        </button>
        {polygon.length >= 3 && !vehicle && (
          <button
            onClick={addVehicle}
            className="block w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
          >
            Add Vehicle
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg">
        <h4 className="font-bold mb-2">Instructions:</h4>
        <ul className="text-sm list-disc list-inside">
          <li>Select a shape from the toolbar or use free draw mode</li>
          <li>Click on the map to place the shape or add points</li>
          <li>Drag points to adjust their position</li>
          <li>Click "Add Vehicle" to place a vehicle inside the geofence</li>
          <li>Drag the vehicle to test geofence boundaries</li>
          <li>Click "Reset Shape" to start over</li>
        </ul>
      </div>
      
      <MapContainer
        center={[-6.200000, 106.816666]} // Jakarta coordinates
        zoom={13}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickComponent onClick={handleMapClick} />
        
        {polygon.length >= 3 && (
          <Polygon
            positions={polygon}
            pathOptions={{
              color: 'blue',
              fillColor: 'blue',
              fillOpacity: 0.2,
            }}
          />
        )}

        {/* Draggable Markers */}
        {polygon.map((point, index) => (
          <CircleMarker
            key={index}
            center={[point[0], point[1]]}
            radius={selectedPoint === index ? 8 : 6}
            eventHandlers={{
              click: () => setSelectedPoint(index),
              dragstart: () => setSelectedPoint(index),
              drag: (e) => handlePointDrag(index, e.target.getLatLng()),
            }}
            draggable={true}
            pathOptions={{
              color: selectedPoint === index ? 'red' : 'blue',
              fillColor: selectedPoint === index ? 'red' : 'blue',
              fillOpacity: 0.7,
            }}
          />
        ))}

        {/* Vehicle Marker */}
        {vehicle && (
          <CircleMarker
            center={vehicle}
            radius={8}
            draggable={true}
            eventHandlers={{
              drag: (e) => handleVehicleDrag(e.target.getLatLng()),
            }}
            pathOptions={{
              color: isOutsideGeofence ? 'red' : 'green',
              fillColor: isOutsideGeofence ? 'red' : 'green',
              fillOpacity: 0.7,
            }}
          >
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}