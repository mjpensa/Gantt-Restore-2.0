/**
 * This is the main frontend script.
 * It handles form submission, API calls, and chart rendering.
 */

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
// ... existing code ...
  const fileList = document.getElementById('file-list');

  fileInput.addEventListener('change', () => {
// ... existing code ...
  // --- END: File input listener ---
});

/**
 * Handles the "Generate Chart" button click
 */
async function handleChartGenerate(event) {
// ... existing code ...
  errorMessage.style.display = 'none';
  chartOutput.innerHTML = ''; // Clear old chart

  try {
// ... existing code ...
    // *** FIX: The server sends the object *directly* now. ***
    const ganttData = await response.json();

    // 5. Validate the data structure
// ... existing code ...
    if (ganttData.timeColumns.length === 0 || ganttData.data.length === 0) {
      console.warn("AI returned valid but empty data.", ganttData);
      throw new Error('The AI was unable to find any tasks or time columns in the provided documents. Please check your files or try a different prompt.');
    }
    // --- END: New validation ---

    // 6. --- MODIFICATION: Open in new tab instead of rendering here ---
    // Store the data in sessionStorage so the new tab can access it
    sessionStorage.setItem('ganttData', JSON.stringify(ganttData));
    
    // Open chart.html in a new tab
    window.open('/chart.html', '_blank');
    
    // --- REMOVED: setupChart(ganttData); ---

  } catch (error) {
// ... existing code ...
    loadingIndicator.style.display = 'none';
  }
}

/**
 * The Dynamic Renderer.
 * This function builds the chart *based on* the data from the server.
 */
// --- ALL FUNCTIONS MOVED to chart-renderer.js ---
// - setupChart
// - addExportListener
// - addTodayLine
// - findTodayColumnPosition
// - getWeek
// - showAnalysisModal
// - handleAskQuestion
// - buildAnalysisSection
// - buildAnalysisList
// ---