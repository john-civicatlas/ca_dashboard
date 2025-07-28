import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './App.css';

const COLORS = ['#FF5950', '#0F2490', '#FF7C66', '#3549B3', '#424242', '#181818'];
const qualityColorMapping = {
    'Very Good': '#557C55', // Muted Green
    'Good': '#829E82',      // Lighter Muted Green
    'Normal': '#E3B448',    // Muted Yellow/Ochre
    'Poor': '#C85C5C'       // Muted Red
};

function Dashboard() {
  const [tableData, setTableData] = useState([]);
  const [pieData, setPieData] = useState(null);
  const [topNumbersData, setTopNumbersData] = useState(null);

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
                    'Descriptions', 'Locations', 'Contacts', 'Links to Extra Documents', 'Minutes Posted'
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
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <img src="/logo.png" alt="Civic Atlas Logo" className="header-logo" />
        <h2>North Texas Zoning Case Dashboard</h2>
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
        {pieData && (
          <>
            <h2>Data Completeness</h2>
            <div className="pie-charts-container">
                {pieData.completenessCharts.map((chart, index) => (
                    <div className="chart-container pie-chart-item" key={index}>
                        <h3>{chart.title}</h3>
                        <div className="donut-chart-wrapper">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie 
                                        data={chart.data} 
                                        dataKey="value" 
                                        nameKey="name" 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        label={false}
                                        labelLine={false}
                                    >
                                        {chart.data.map((entry, i) => (
                                            <Cell 
                                                key={`cell-${i}`} 
                                                fill={entry.name === 'Yes' ? COLORS[0] : '#C4C4C4'}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            {chart.data[0]?.name === 'Yes' && (
                                <div className="donut-center-label">
                                    <span className="donut-percentage">{chart.data[0].value.toFixed(0)}%</span>
                                </div>
                            )}
                        </div>
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
                <div className="donut-chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie 
                                data={pieData.quality} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={70}
                                outerRadius={100} 
                                fill="#8884d8" 
                                label={false}
                                labelLine={false}
                            >
                                {pieData.quality.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={qualityColorMapping[entry.name]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                    {pieData.quality.length > 0 && (
                        <div className="donut-center-label">
                            <span className="donut-percentage">{pieData.quality[0].value.toFixed(0)}%</span>
                        </div>
                    )}
                </div>
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
