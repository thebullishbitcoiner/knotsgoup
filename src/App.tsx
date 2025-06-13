import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  Plugin,
  PointElement,
  LineElement,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, ChartDataLabels, PointElement, LineElement);

interface NodeData {
  [key: string]: [
    number,
    string,
    number,
    number,
    number,
    string | null,
    string | null,
    string | null,
    number,
    number,
    string | null,
    string,
    string
  ];
}

interface ApiResponse {
  timestamp: number;
  total_nodes: number;
  latest_height: number;
  nodes: NodeData;
}

interface Snapshot {
  url: string;
  timestamp: number;
  total_nodes: number;
  latest_height: number;
}

interface SnapshotResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Snapshot[];
}

function App() {
  const [nodeData, setNodeData] = useState<ApiResponse | null>(null);
  const [versionCounts, setVersionCounts] = useState<{ [key: string]: number }>({});
  const [knotsCount, setKnotsCount] = useState(0);
  const [otherCount, setOtherCount] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState<{ timestamp: number; knotsCount: number }[]>([]);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Check cache first
        const cachedData = localStorage.getItem('nodeData');
        const cachedTimestamp = localStorage.getItem('nodeDataTimestamp');
        const currentTime = Date.now();
        const CACHE_DURATION = 21 * 60 * 1000; // 5 minutes in milliseconds

        if (cachedData && cachedTimestamp && (currentTime - parseInt(cachedTimestamp)) < CACHE_DURATION) {
          // Use cached data if it's less than 5 minutes old
          const parsedData = JSON.parse(cachedData);
          // Add a small delay when using cached data
          await new Promise(resolve => setTimeout(resolve, 3000));
          setNodeData(parsedData);
          setTotalNodes(parsedData.total_nodes);
          processNodeData(parsedData);
        } else {
          // Fetch new data if cache is expired or doesn't exist
          const response = await axios.get<ApiResponse>('https://bitnodes.io/api/v1/snapshots/latest/');
          setNodeData(response.data);
          setTotalNodes(response.data.total_nodes);
          processNodeData(response.data);

          // Update cache
          localStorage.setItem('nodeData', JSON.stringify(response.data));
          localStorage.setItem('nodeDataTimestamp', currentTime.toString());
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchHistoricalData = async () => {
      try {
        setIsLoadingHistorical(true);
        
        // Check cache first
        const cachedData = localStorage.getItem('knotsgoup_snapshots');
        const cachedTimestamp = localStorage.getItem('knotsgoup_snapshots_timestamp');
        const currentTime = Date.now();
        const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (cachedData && cachedTimestamp && (currentTime - parseInt(cachedTimestamp)) < CACHE_DURATION) {
          console.log('Using cached historical data');
          const parsedData = JSON.parse(cachedData);
          setHistoricalData(parsedData);
          setIsLoadingHistorical(false);
          return;
        }

        console.log('Fetching new historical data...');
        const historicalData: { timestamp: number; knotsCount: number }[] = [];
        let nextUrl: string | null = 'https://bitnodes.io/api/v1/snapshots/';
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        let lastTimestamp: number | null = null;
        let apiCallCount = 0;
        const MAX_API_CALLS = 12; // Maximum number of API calls (60 days / 7 days ≈ 8-9 calls, rounded up to 12 for safety)

        while (nextUrl && apiCallCount < MAX_API_CALLS) {
          apiCallCount++;
          console.log(`API Call ${apiCallCount}: Fetching ${nextUrl}`);
          
          const response: { data: SnapshotResponse } = await axios.get<SnapshotResponse>(nextUrl);
          const snapshots = response.data.results;
          console.log(`Received ${snapshots.length} snapshots in this page`);
          
          // Filter snapshots to be at least one week apart
          const filteredSnapshots = snapshots.filter((snapshot: Snapshot) => {
            if (!lastTimestamp) {
              lastTimestamp = snapshot.timestamp;
              return true;
            }
            
            const timeDiff = Math.abs(snapshot.timestamp - lastTimestamp);
            if (timeDiff >= ONE_WEEK_MS / 1000) { // Convert to seconds since timestamps are in seconds
              lastTimestamp = snapshot.timestamp;
              return true;
            }
            return false;
          });
          
          console.log(`Filtered to ${filteredSnapshots.length} snapshots that are at least a week apart`);

          // Process filtered snapshots
          for (const snapshot of filteredSnapshots) {
            console.log(`Fetching snapshot data from ${snapshot.url}`);
            const snapshotResponse = await axios.get<ApiResponse>(snapshot.url);
            let knotsCount = 0;
            
            Object.values(snapshotResponse.data.nodes).forEach((node) => {
              const version = node[1];
              if (version.includes('Knots')) {
                knotsCount++;
              }
            });
            
            historicalData.push({
              timestamp: snapshot.timestamp,
              knotsCount
            });
            console.log(`Added data point: ${new Date(snapshot.timestamp * 1000).toLocaleDateString()} - ${knotsCount} Knots nodes`);
          }

          // Update nextUrl with the next page URL from the response
          nextUrl = response.data.next;
          console.log(`Next URL for pagination: ${nextUrl}`);
          
          // Add a small delay between API calls to avoid rate limiting
          if (nextUrl) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`Finished fetching data. Total data points: ${historicalData.length}`);
        
        // Sort data by timestamp
        const sortedData = historicalData.sort((a, b) => a.timestamp - b.timestamp);
        
        // Update cache
        localStorage.setItem('knotsgoup_snapshots', JSON.stringify(sortedData));
        localStorage.setItem('knotsgoup_snapshots_timestamp', currentTime.toString());
        
        // Update state
        setHistoricalData(sortedData);
      } catch (error) {
        console.error('Error fetching historical data:', error);
      } finally {
        setIsLoadingHistorical(false);
      }
    };

    const processNodeData = (data: ApiResponse) => {
      const counts: { [key: string]: number } = {};
      let knots = 0;
      let others = 0;

      Object.values(data.nodes).forEach((node) => {
        const version = node[1];
        counts[version] = (counts[version] || 0) + 1;
        
        if (version.includes('Knots')) {
          knots++;
        } else {
          others++;
        }
      });

      setVersionCounts(counts);
      setKnotsCount(knots);
      setOtherCount(others);
    };

    fetchData();
    fetchHistoricalData();
  }, []);

  const sortedVersions = Object.entries(versionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 21)
    .map(([version, count]): [string, number] => [
      version.replace('/Satoshi:', '').replace(/\/$/, ''),
      count
    ]);

  const pieChartData = {
    labels: ['Knots', 'Core'],
    datasets: [
      {
        data: [knotsCount, otherCount],
        backgroundColor: ['#00702B', '#4a4a4a'],
        borderColor: ['#005a23', '#2a2a2a'],
        borderWidth: 1,
      },
    ],
  };

  const pieChartOptions = {
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: 'white',
          font: {
            size: 14,
            weight: 'bold' as const
          },
          padding: 20
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.raw as number;
            const percentage = ((value / totalNodes) * 100).toFixed(2);
            return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
          }
        }
      },
      datalabels: {
        color: 'white',
        font: {
          weight: 'bold' as const,
          size: 16
        },
        formatter: (value: number) => {
          const percentage = ((value / totalNodes) * 100).toFixed(1);
          return `${percentage}%`;
        }
      }
    },
    layout: {
      padding: {
        bottom: 20
      }
    },
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1
  };

  const lineChartData = {
    labels: historicalData.map(data => new Date(data.timestamp * 1000).toLocaleDateString()),
    datasets: [
      {
        label: 'Knots Nodes',
        data: historicalData.map(data => data.knotsCount),
        borderColor: '#00702B',
        backgroundColor: 'rgba(0, 112, 43, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'white',
          font: {
            size: 14,
            weight: 'bold' as const
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `Knots Nodes: ${context.raw}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'white'
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'white'
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center">
      <div className="relative w-full max-w-[1400px] mx-auto px-4">
        <div className="relative">
          <div className="w-full mx-auto">
            {isLoading ? (
              <div className="flex justify-center items-center min-h-screen">
                <img 
                  src="/media/knots-glitch.gif" 
                  alt="Loading..." 
                  className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
                />
              </div>
            ) : (
              <div className="pt-8 sm:pt-0 pb-2 text-base leading-6 space-y-4 text-gray-300 sm:text-lg sm:leading-7">
                <h1 className="text-3xl font-bold text-center mb-8 text-[#00702B]">Knots Go Up</h1>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-12">
                  <div>
                    <div className="overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-gray-700">
                          <thead>
                            <tr>
                              <th scope="col" className="w-[40%] px-2 sm:px-4 py-1.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Version</th>
                              <th scope="col" className="w-[30%] px-2 sm:px-4 py-1.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Count</th>
                              <th scope="col" className="w-[30%] px-2 sm:px-4 py-1.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">% of Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedVersions.map(([version, count]) => (
                              <tr key={version} className="hover:bg-gray-900">
                                <td className={`w-[40%] px-2 sm:px-4 py-1.5 text-sm font-medium ${version.includes('Knots') ? 'text-[#00702B]' : 'text-gray-300'} truncate`}>{version}</td>
                                <td className={`w-[30%] px-2 sm:px-4 py-1.5 text-sm ${version.includes('Knots') ? 'text-[#00702B]' : 'text-gray-300'} text-right`}>{count.toLocaleString()}</td>
                                <td className={`w-[30%] px-2 sm:px-4 py-1.5 text-sm ${version.includes('Knots') ? 'text-[#00702B]' : 'text-gray-300'} text-right`}>
                                  {((count / totalNodes) * 100).toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center items-center">
                    <div className="w-full lg:w-[800px] p-2 sm:p-8">
                      <Pie 
                        data={pieChartData}
                        options={pieChartOptions}
                        className="pie-chart-container"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-8">
                  <h2 className="text-2xl font-bold text-center mb-4 text-[#00702B]">Historical Knots Node Count</h2>
                  <div className="w-full max-w-[1200px] mx-auto p-4">
                    {isLoadingHistorical ? (
                      <div className="flex justify-center items-center h-64">
                        <img 
                          src="/media/knots-glitch.gif" 
                          alt="Loading..." 
                          className="w-16 h-16 sm:w-24 sm:h-24 object-contain"
                        />
                      </div>
                    ) : (
                      <Line 
                        data={lineChartData}
                        options={lineChartOptions}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 