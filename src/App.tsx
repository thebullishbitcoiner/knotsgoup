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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get<ApiResponse>('https://bitnodes.io/api/v1/snapshots/latest/');
        setNodeData(response.data);
        setTotalNodes(response.data.total_nodes);
        
        // Process version counts
        const counts: { [key: string]: number } = {};
        let knots = 0;
        let others = 0;

        Object.values(response.data.nodes).forEach((node) => {
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
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const sortedVersions = Object.entries(versionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 21);

  const pieChartData = {
    labels: ['Knots', 'Core'],
    datasets: [
      {
        data: [knotsCount, otherCount],
        backgroundColor: ['#ff9900', '#4a4a4a'],
        borderColor: ['#cc7a00', '#2a2a2a'],
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
          color: '#ff9900',
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
        bottom: 40
      }
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center">
      <div className="relative w-full max-w-[1400px] mx-auto px-4">
        <div className="relative">
          <div className="w-full mx-auto">
            <div className="pt-8 sm:pt-0 pb-2 text-base leading-6 space-y-4 text-gray-300 sm:text-lg sm:leading-7">
              <h1 className="text-3xl font-bold text-center mb-8 text-[#ff9900]">Knots Go Up</h1>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-12">
                <div>
                  <div className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-700">
                        <thead>
                          <tr>
                            <th scope="col" className="w-1/2 px-4 py-1.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Version</th>
                            <th scope="col" className="w-1/4 px-4 py-1.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Count</th>
                            <th scope="col" className="w-1/4 px-4 py-1.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">% of Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {sortedVersions.map(([version, count]) => (
                            <tr key={version} className="hover:bg-gray-900">
                              <td className={`w-1/2 px-4 py-1.5 text-sm font-medium ${version.includes('Knots') ? 'text-[#ff9900]' : 'text-gray-300'} truncate`}>{version}</td>
                              <td className={`w-1/4 px-4 py-1.5 text-sm ${version.includes('Knots') ? 'text-[#ff9900]' : 'text-gray-300'} text-right`}>{count.toLocaleString()}</td>
                              <td className={`w-1/4 px-4 py-1.5 text-sm ${version.includes('Knots') ? 'text-[#ff9900]' : 'text-gray-300'} text-right`}>
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
                  <div className="w-full lg:w-[800px] p-8">
                    <Pie 
                      data={pieChartData}
                      options={{
                        ...pieChartOptions,
                        maintainAspectRatio: false,
                        responsive: true
                      }}
                      style={{ height: '700px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App; 