
import React from "react"
import { useEffect, useState } from "react"

interface ApiStatus {
  electronAPI: boolean
  electron: boolean
  ipcRenderer: boolean
  electronTest: boolean
}

interface TestResult {
  timestamp: string
  message: string
  success: boolean
}

const ElectronApiTester: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    electronAPI: false,
    electron: false,
    ipcRenderer: false,
    electronTest: false,
  })

  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [expandedSection, setExpandedSection] = useState<string | null>("apis")

  // Check for APIs on component mount
  useEffect(() => {
    checkApis()

    // Set up interval to periodically check APIs
    const intervalId = setInterval(checkApis, 2000)

    return () => clearInterval(intervalId)
  }, [])

  const checkApis = () => {
    const status = {
      electronAPI: !!(window as any).electronAPI,
      electron: !!(window as any).electron,
      ipcRenderer: !!(window as any).ipcRenderer,
      electronTest: !!(window as any).electronTest,
    }

    setApiStatus(status)

    // Log the first time
    if (!apiStatus.electronAPI && status.electronAPI) {
      addTestResult("electronAPI is now available", true)
    }
    if (!apiStatus.electron && status.electron) {
      addTestResult("electron is now available", true)
    }
    if (!apiStatus.ipcRenderer && status.ipcRenderer) {
      addTestResult("ipcRenderer is now available", true)
    }
    if (!apiStatus.electronTest && status.electronTest) {
      addTestResult("electronTest is now available", true)
    }
  }

  const addTestResult = (message: string, success: boolean) => {
    const now = new Date()
    const timestamp = now.toLocaleTimeString()

    setTestResults((prev) => [
      { timestamp, message, success },
      ...prev.slice(0, 49), // Keep only the last 50 results
    ])
  }

  const testPing = () => {
    try {
      if ((window as any).electronTest?.ping) {
        const result = (window as any).electronTest.ping()
        addTestResult(`Ping result: ${result}`, true)
      } else {
        addTestResult("electronTest.ping is not available", false)
      }
    } catch (error) {
      addTestResult(`Error in ping test: ${(error as Error).message}`, false)
    }
  }

  const testWindowControl = (action: string) => {
    try {
      // Try electronAPI first (preferred method)
      if ((window as any).electronAPI) {
        addTestResult(`Using electronAPI.windowControl("${action}")`, true)
        ;(window as any).electronAPI.windowControl(action)
        return
      }

      // Try direct ipcRenderer next
      if ((window as any).ipcRenderer) {
        addTestResult(`Using ipcRenderer.send("window-control", "${action}")`, true)
        ;(window as any).ipcRenderer.send("window-control", action)
        return
      }

      // Try legacy electron API as last resort
      if ((window as any).electron) {
        const frameAction = action.toUpperCase()
        addTestResult(`Using electron.sendFrameAction("${frameAction}")`, true)
        ;(window as any).electron.sendFrameAction(frameAction)
        return
      }

      // If we get here, no APIs are available
      addTestResult(`No Electron APIs available for ${action} action`, false)
    } catch (error) {
      addTestResult(`Error in ${action} handler: ${(error as Error).message}`, false)
    }
  }

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null)
    } else {
      setExpandedSection(section)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Electron API Tester</h1>

      {/* API Status Section */}
      <div className="mb-6 border rounded-lg overflow-hidden">
        <div
          className="bg-gray-100 p-3 flex justify-between items-center cursor-pointer"
          onClick={() => toggleSection("apis")}
        >
          <h2 className="text-lg font-semibold">API Availability</h2>
          <span>{expandedSection === "apis" ? "▼" : "▶"}</span>
        </div>

        {expandedSection === "apis" && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg ${apiStatus.electronAPI ? "bg-green-100" : "bg-red-100"}`}>
              <div className="font-medium">electronAPI</div>
              <div className="text-sm">{apiStatus.electronAPI ? "Available ✅" : "Not Available ���"}</div>
            </div>

            <div className={`p-3 rounded-lg ${apiStatus.electron ? "bg-green-100" : "bg-red-100"}`}>
              <div className="font-medium">electron</div>
              <div className="text-sm">{apiStatus.electron ? "Available ✅" : "Not Available ❌"}</div>
            </div>

            <div className={`p-3 rounded-lg ${apiStatus.ipcRenderer ? "bg-green-100" : "bg-red-100"}`}>
              <div className="font-medium">ipcRenderer</div>
              <div className="text-sm">{apiStatus.ipcRenderer ? "Available ✅" : "Not Available ❌"}</div>
            </div>

            <div className={`p-3 rounded-lg ${apiStatus.electronTest ? "bg-green-100" : "bg-red-100"}`}>
              <div className="font-medium">electronTest</div>
              <div className="text-sm">{apiStatus.electronTest ? "Available ✅" : "Not Available ❌"}</div>
            </div>
          </div>
        )}
      </div>

      {/* Test Actions Section */}
      <div className="mb-6 border rounded-lg overflow-hidden">
        <div
          className="bg-gray-100 p-3 flex justify-between items-center cursor-pointer"
          onClick={() => toggleSection("actions")}
        >
          <h2 className="text-lg font-semibold">Test Actions</h2>
          <span>{expandedSection === "actions" ? "▼" : "▶"}</span>
        </div>

        {expandedSection === "actions" && (
          <div className="p-4">
            <div className="mb-4">
              <h3 className="font-medium mb-2">API Tests</h3>
              <button onClick={testPing} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2">
                Test Ping
              </button>
              <button onClick={checkApis} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                Refresh API Status
              </button>
            </div>

            <div>
              <h3 className="font-medium mb-2">Window Controls</h3>
              <button
                onClick={() => testWindowControl("minimize")}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2"
              >
                Minimize
              </button>
              <button
                onClick={() => testWindowControl("maximize")}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2"
              >
                Maximize
              </button>
              <button
                onClick={() => testWindowControl("close")}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Results Section */}
      <div className="border rounded-lg overflow-hidden">
        <div
          className="bg-gray-100 p-3 flex justify-between items-center cursor-pointer"
          onClick={() => toggleSection("results")}
        >
          <h2 className="text-lg font-semibold">Test Results</h2>
          <span>{expandedSection === "results" ? "▼" : "▶"}</span>
        </div>

        {expandedSection === "results" && (
          <div className="p-4">
            <div className="max-h-80 overflow-y-auto border rounded">
              {testResults.length === 0 ? (
                <div className="p-4 text-gray-500 italic">No test results yet</div>
              ) : (
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Message</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((result, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2 text-sm">{result.timestamp}</td>
                        <td className="p-2">{result.message}</td>
                        <td className="p-2">
                          {result.success ? (
                            <span className="text-green-500">✅</span>
                          ) : (
                            <span className="text-red-500">❌</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {testResults.length > 0 && (
              <button
                onClick={() => setTestResults([])}
                className="mt-2 bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                Clear Results
              </button>
            )}
          </div>
        )}
      </div>

      {/* Debug Info Section */}
      <div className="mt-6 text-xs text-gray-500">
        <p>
          Window object keys:{" "}
          {Object.keys(window)
            .filter(
              (key) => key === "electron" || key === "electronAPI" || key === "ipcRenderer" || key === "electronTest",
            )
            .join(", ")}
        </p>
        <p>Last checked: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  )
}

export default ElectronApiTester
