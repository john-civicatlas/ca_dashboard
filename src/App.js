import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const COLORS = ['#FF5950', '#0F2490', '#FF7C66', '#3549B3', '#424242', '#181818'];
const qualityColorMapping = {
    'Very Good': '#557C55', // Muted Green
    'Good': '#829E82',      // Lighter Muted Green
    'Normal': '#E3B448',    // Muted Yellow/Ochre
    'Poor': '#C85C5C'       // Muted Red
};
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const renderCompletenessLabel = ({ data }) => {
    const yesData = data.find(item => item.name === 'Yes');
    const yesPercentage = yesData ? yesData.value : 0;
    
    return (
        <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="bold" fill="#333">
            {`${yesPercentage.toFixed(0)}%`}
        </text>
    );
};

const geoJsonStyle = (feature) => {
    return {
        fillColor: '#FF5950',
        weight: 3,
        opacity: 1,
        color: '#0F2490',
        fillOpacity: 0.5
    };
};

const onEachFeature = (feature, layer) => {
    if (feature.properties && feature.properties.CITY_NM) {
        layer.bindPopup(`<b>${feature.properties.CITY_NM}</b><br/>Population 2022: ${feature.properties.POP2022 || 'N/A'}`);
    }
};

const calculateBounds = (features) => {
    if (!features || features.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates.forEach(ring => {
                ring.forEach(coord => {
                    const [lng, lat] = coord;
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                    minLng = Math.min(minLng, lng);
                    maxLng = Math.max(maxLng, lng);
                });
            });
        }
    });
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    
    // Calculate appropriate zoom level
    const maxDiff = Math.max(latDiff, lngDiff);
    let zoom = 9; // Default zoom
    
    if (maxDiff > 3) zoom = 7;
    else if (maxDiff > 2) zoom = 8;
    else if (maxDiff > 1) zoom = 9;
    else if (maxDiff > 0.5) zoom = 10;
    else if (maxDiff > 0.2) zoom = 11;
    else if (maxDiff > 0.1) zoom = 12;
    else if (maxDiff > 0.05) zoom = 13;
    else zoom = 14;
    
    return {
        center: [centerLat, centerLng],
        zoom: zoom
    };
};

function Dashboard() {
  const [tableData, setTableData] = useState([]);
  const [pieData, setPieData] = useState(null);
  const [topNumbersData, setTopNumbersData] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [mapView, setMapView] = useState({ center: [32.9750, -96.7970], zoom: 9 });

  useEffect(() => {
    Papa.parse('/sample_data.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (result) => {
        setTableData(result.data);
      },
    });

    Papa.parse('/top_numbers.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: (result) => {
            if(result.data.length > 0) {
                setTopNumbersData(result.data[0]);
            }
        },
    });

    Papa.parse('/sample_data_2.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: (result) => {
            if(result.data.length > 0) {
                const summaryData = result.data[0];
                const totalCases = summaryData['Total Cases'];

                const qualityData = [
                    { name: 'Very Good', value: summaryData['Very Good'] },
                    { name: 'Good', value: summaryData['Good'] },
                    { name: 'Normal', value: summaryData['Normal'] },
                    { name: 'Poor', value: summaryData['Poor'] },
                ].filter(item => item.value > 0);

                const completenessMetrics = [
                    'Descriptions', 'Locations', 'Contacts', 'Links to Extra Documents'
                ];

                const completenessCharts = completenessMetrics.map(metric => {
                    const yesPercentage = parseFloat(summaryData[metric]);
                    if (isNaN(yesPercentage)) {
                        return null; // Skip charts with invalid data
                    }

                    return {
                        title: metric,
                        data: [
                            { name: 'Yes', value: yesPercentage * 100 },
                            { name: 'No', value: (1 - yesPercentage) * 100 },
                        ]
                    };
                }).filter(Boolean); // Remove null entries

                setPieData({ quality: qualityData, completenessCharts: completenessCharts });
            }
        },
      });

    // Fetch GeoJSON data
    fetch('/coverage_areas.geojson')
      .then(response => response.json())
      .then(data => {
        console.log('GeoJSON data loaded:', data);
        // Filter to only show cities with last_edited value
        const filteredData = {
          ...data,
          features: data.features.filter(feature => 
            feature.properties && feature.properties.last_edited
          )
        };
        console.log('Filtered GeoJSON data:', filteredData);
        
        // Calculate bounds for the filtered features
        const mapView = calculateBounds(filteredData.features);
        console.log('Calculated map view:', mapView);
        console.log('Filtered features count:', filteredData.features.length);
        if (mapView) {
            setMapView(mapView);
        }
        setGeoJsonData(filteredData);
      })
      .catch(error => {
        console.error('Error fetching GeoJSON:', error);
      });
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <img src="/logo_2.png" alt="Civic Atlas Logo" className="header-logo" />
        <h2>Civic Atlas Data Coverage Dashboard</h2>
      </header>
      <main>
        {topNumbersData && (
          <div className="top-numbers-container">
            <div className="callout-box">
              <h3>Cities Covered</h3>
              <p>{topNumbersData['Cities Covered']}</p>
            </div>
            <div className="callout-box">
              <h3>Total Cases</h3>
              <p>{topNumbersData['Total Cases']}</p>
            </div>
            <div className="callout-box">
              <h3>Identified Contacts</h3>
              <p>{topNumbersData['Identified Contacts']}</p>
            </div>
          </div>
        )}
        <div className="chart-container">
          <h2>Coverage Area</h2>
          <div style={{ height: '600px', width: '100%' }}>
            <MapContainer 
              center={mapView.center} 
              zoom={mapView.zoom} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {geoJsonData && (
                <GeoJSON 
                  key="coverage-areas"
                  data={geoJsonData} 
                  style={geoJsonStyle}
                  onEachFeature={onEachFeature}
                />
              )}
              {!geoJsonData && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, background: 'white', padding: '10px', border: '1px solid #ccc' }}>
                  Loading coverage areas...
                </div>
              )}
            </MapContainer>
          </div>
        </div>
        {pieData && (
          <>
            <h2>Data Completeness</h2>
            <div className="pie-charts-container">
                {pieData.completenessCharts.map((chart, index) => (
                    <div className="chart-container pie-chart-item" key={index}>
                        <h3>{chart.title}</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} fill="#8884d8" labelLine={false}>
                                    {chart.data.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.name === 'No' ? '#C4C4C4' : COLORS[0]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                                {renderCompletenessLabel({ data: chart.data })}
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ))}
            </div>
          </>
        )}
        <div className="chart-container">
          <h2>Total Score by City</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={tableData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="City" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Total Score" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {pieData && (
            <div className="chart-container">
                <h2>Case Quality Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                    <Pie data={pieData.quality} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} fill="#8884d8" label={renderCustomizedLabel} labelLine={false}>
                        {pieData.quality.map((entry, index) => <Cell key={`cell-${index}`} fill={qualityColorMapping[entry.name]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        )}
        <div className="table-container">
          <h2>Zoning Case Data</h2>
          <table>
            <thead>
              <tr>
                {tableData.length > 0 && tableData[0] && Object.keys(tableData[0]).map((key) => <th key={key}>{key}</th>)}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index}>
                  {row && Object.values(row).map((value, i) => <td key={i}>{String(value)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
