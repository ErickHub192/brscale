'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface AgentOutput {
  agentName: string;
  timestamp: Date;
  success: boolean;
  data: any;
  nextAction?: string;
  errors?: string[];
  toolCalls?: Array<{
    tool: string;
    input: any;
    output: any;
  }>;
  reasoning?: string;
}

interface WorkflowStatus {
  propertyId: string;
  currentStage: string;
  completed: boolean;
  humanInterventionRequired: boolean;
  startedAt: string;
  completedAt?: string;
  error?: string;
  agentOutputs: Record<string, AgentOutput>;
}

export default function WorkflowPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const [workflow, setWorkflow] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkflowStatus();
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchWorkflowStatus, 5000);
    return () => clearInterval(interval);
  }, [propertyId]);

  const fetchWorkflowStatus = async () => {
    try {
      const response = await fetch(`/api/properties/${propertyId}/workflow`);
      const result = await response.json();

      if (result.success) {
        setWorkflow(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch workflow status');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userMessage.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}/workflow/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          humanResponse: userMessage,
          humanRole: 'broker',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUserMessage('');
        fetchWorkflowStatus();
      } else {
        // Show better error message for timeouts
        if (result.errorType === 'TIMEOUT') {
          alert('⏱️ Request timed out. The workflow may still be processing. Please wait a moment and check if the status updates automatically.');
        } else {
          alert('Failed to send message: ' + result.error);
        }
      }
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const getStageColor = (stage: string, current: string) => {
    if (stage === current) return 'bg-blue-500 text-white';
    return 'bg-gray-200 text-gray-600';
  };

  const stages = [
    { key: 'input_validation', label: 'Input Validation' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'lead_management', label: 'Lead Management' },
    { key: 'negotiation', label: 'Negotiation' },
    { key: 'legal', label: 'Legal' },
    { key: 'closure', label: 'Closure' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workflow status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No workflow found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Workflow Status</h1>
          <p className="text-gray-600">Property ID: {propertyId}</p>
        </div>

        {/* Human Intervention Alert */}
        {workflow.humanInterventionRequired && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Human Intervention Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>The workflow is paused and requires your action to continue.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Progress</h2>
          <div className="flex items-center justify-between">
            {stages.map((stage, index) => (
              <div key={stage.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${getStageColor(
                      stage.key,
                      workflow.currentStage
                    )}`}
                  >
                    {index + 1}
                  </div>
                  <p className="text-xs mt-2 text-center">{stage.label}</p>
                </div>
                {index < stages.length - 1 && (
                  <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Agent Outputs */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Agent Outputs</h2>
          {Object.keys(workflow.agentOutputs).length === 0 ? (
            <p className="text-gray-500 text-sm">No agent outputs yet</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(workflow.agentOutputs).map(([key, output]) => (
                <div key={key} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{output.agentName}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        output.success
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {output.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {new Date(output.timestamp).toLocaleString()}
                  </p>

                  {output.nextAction && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm font-medium text-blue-900">Next Action:</p>
                      <p className="text-sm text-blue-700 mt-1">{output.nextAction}</p>
                    </div>
                  )}

                  {output.errors && output.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-medium text-red-900">Errors:</p>
                      <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                        {output.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {output.reasoning && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded">
                      <p className="text-sm font-medium text-purple-900">AI Reasoning:</p>
                      <p className="text-sm text-purple-700 mt-1">{output.reasoning}</p>
                    </div>
                  )}

                  {output.toolCalls && output.toolCalls.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        🛠️ Tools Used ({output.toolCalls.length}):
                      </p>
                      <div className="space-y-2">
                        {output.toolCalls.map((call, idx) => (
                          <details key={idx} className="bg-gray-50 border border-gray-200 rounded">
                            <summary className="cursor-pointer p-2 text-sm font-mono hover:bg-gray-100">
                              {call.tool}
                            </summary>
                            <div className="p-3 border-t border-gray-200">
                              <div className="mb-2">
                                <p className="text-xs font-semibold text-gray-700">Input:</p>
                                <pre className="text-xs bg-gray-900 text-cyan-400 p-2 rounded overflow-x-auto mt-1 border border-gray-700">
                                  {JSON.stringify(call.input, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-700">Output:</p>
                                <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto mt-1 border border-gray-700">
                                  {JSON.stringify(call.output, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}

                  {output.data && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                        📄 View Raw Data
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto border border-gray-700">
                        {JSON.stringify(output.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Interface for Human-in-the-Loop */}
        {workflow.humanInterventionRequired && !workflow.completed && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <svg
                className="h-5 w-5 mr-2 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Respond to Agent
            </h2>

            <form onSubmit={handleSendMessage}>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Type your response to the agent..."
                  className="flex-1 px-4 py-3 border-2 border-gray-400 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                />
                <button
                  type="submit"
                  disabled={submitting || !userMessage.trim()}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </div>

              <div className="mt-3 text-sm text-gray-600">
                <p>💡 Tip: The agent is waiting for your input to continue the workflow.</p>
              </div>
            </form>
          </div>
        )}

        {/* Status Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {workflow.completed ? (
            <p>Workflow completed at {new Date(workflow.completedAt!).toLocaleString()}</p>
          ) : (
            <p>Auto-refreshing every 5 seconds...</p>
          )}
        </div>
      </div>
    </div>
  );
}
