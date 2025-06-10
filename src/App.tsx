import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  Plugin,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, ChartDataLabels);

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

function App() {
  const [nodeData, setNodeData] = useState<ApiResponse | null>(null);
  const [versionCounts, setVersionCounts] = useState<{ [key: string]: number }>({});
  const [knotsCount, setKnotsCount] = useState(0);
  const [otherCount, setOtherCount] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 